import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission, hasPermission } from '../middleware/permissions';
import { checkUsage, incrementUsage, decrementUsage } from '../middleware/plan';
import { validate } from '../middleware/validate';
import { CreateLeadSchema, UpdateLeadSchema } from '../schemas/lead.schema';
import { normalizePhone, maskPhone } from '../utils/phone';
import { triggerWorkflows } from './workflows';
import { decrypt } from '../utils/crypto';
import { parseMetaFieldData } from '../utils/meta';
import https from 'https';
import { emitToTenant } from '../socket';
import { sendNewLeadNotification } from '../utils/notifications';

const router = Router();
router.use(requireAuth);
router.use(requireTenant); // super_admin must use impersonation to access tenant data (#44)

// GET /api/leads
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId, userId, role } = req.user!;
  const {
    stage, search, pipeline_id, assigned_to, source, source_ref, meta_form_id,
    tag, date_from, date_to,
    page = '1', limit = '200',
    after,          // cursor: ISO timestamp — when present, enables keyset pagination
  } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Permission resolution: super_admin sees all; everyone else goes through
  // user_permissions. only_assigned is an absolute restriction — if ON it wins
  // over leads:view_all regardless of role. Fail-safe on DB errors (restrict).
  const isSuperAdmin = role === 'super_admin';
  let viewAll: boolean;

  if (isSuperAdmin) {
    viewAll = true;
  } else {
    let onlyAssigned = false;
    try { onlyAssigned = await hasPermission(userId, 'leads:only_assigned', tenantId); } catch { onlyAssigned = true; }

    if (onlyAssigned) {
      viewAll = false;
    } else {
      try { viewAll = await hasPermission(userId, 'leads:view_all', tenantId); } catch { viewAll = false; }
    }
  }

  let shouldMaskPhone = false;
  if (!isSuperAdmin) {
    try { shouldMaskPhone = await hasPermission(userId, 'leads:mask_phone', tenantId); } catch {}
  }

  let sql = `
    SELECT l.*, ps.name AS stage_name, p.name AS pipeline_name,
           u.name AS assigned_name,
           mf.form_name AS meta_form_name,
           cf.name AS custom_form_name
    FROM leads l
    LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
    LEFT JOIN pipelines p ON p.id = l.pipeline_id
    LEFT JOIN users u ON u.id = l.assigned_to
    LEFT JOIN meta_forms mf ON mf.form_id = l.meta_form_id AND mf.tenant_id = l.tenant_id
    LEFT JOIN custom_forms cf ON cf.id::text = l.source_ref AND l.source = 'Custom Form'
    WHERE l.tenant_id = $1 AND l.is_deleted = FALSE
  `;
  const params: any[] = [tenantId];

  if (!viewAll) {
    params.push(userId);
    sql += ` AND l.assigned_to = $${params.length}`;
  }

  if (stage)       { params.push(stage);                  sql += ` AND l.stage_id = $${params.length}`; }
  if (pipeline_id) { params.push(pipeline_id);            sql += ` AND l.pipeline_id = $${params.length}`; }
  if (assigned_to) { params.push(assigned_to);            sql += ` AND l.assigned_to = $${params.length}`; }
  if (source)         { params.push(source);       sql += ` AND l.source = $${params.length}`; }
  if (source_ref)     { params.push(source_ref);   sql += ` AND l.source_ref = $${params.length}`; }
  if (meta_form_id)   { params.push(meta_form_id); sql += ` AND l.meta_form_id = $${params.length}`; }
  if (date_from)   { params.push(date_from);              sql += ` AND l.created_at >= $${params.length}`; }
  if (date_to)     { params.push(date_to);                sql += ` AND l.created_at <= $${params.length}`; }
  if (tag) {
    params.push(tag);
    sql += ` AND EXISTS (
      SELECT 1 FROM lead_tags lt
      JOIN tags tg ON tg.id = lt.tag_id
      WHERE lt.lead_id = l.id AND tg.name = $${params.length}
    )`;
  }
  if (search) {
    params.push(`%${search}%`);
    const phoneSearchClause = shouldMaskPhone ? '' : ` OR l.phone ILIKE $${params.length}`;
    sql += ` AND (l.name ILIKE $${params.length} OR l.email ILIKE $${params.length}${phoneSearchClause})`;
  }

  const pageSize = parseInt(limit);

  if (after !== undefined) {
    // Keyset / cursor pagination — after="" means first page
    if (after) {
      params.push(after);
      sql += ` AND l.created_at < $${params.length}`;
    }
    sql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1}`;
    params.push(pageSize);
  } else {
    // Legacy offset pagination (used by initFromApi with limit=200)
    sql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);
  }

  try {
    const result = await query(sql, params);
    const rows = shouldMaskPhone
      ? result.rows.map((r: any) => ({ ...r, phone: maskPhone(r.phone) }))
      : result.rows;

    if (after !== undefined) {
      const nextCursor = rows.length === pageSize
        ? rows[rows.length - 1].created_at as string
        : null;
      res.json({ leads: rows, nextCursor });
    } else {
      res.json(rows);
    }
  } catch (err: any) {
    // 42703 = undefined_column; most likely meta_form_id column not yet added by migration
    if (err.code === '42703') {
      res.json(after !== undefined ? { leads: [], nextCursor: null } : []);
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leads/followups — follow-ups scoped by user access level
router.get('/followups', async (req: AuthRequest, res: Response) => {
  const { userId, tenantId, role } = req.user!;
  try {
    const isSuperAdmin = role === 'super_admin';
    let onlyAssigned = false;

    if (!isSuperAdmin) {
      const ownerCheck = await query('SELECT is_owner FROM users WHERE id=$1 LIMIT 1', [userId]);
      const isOwner = ownerCheck.rows[0]?.is_owner === true;
      if (!isOwner) {
        try { onlyAssigned = await hasPermission(userId, 'leads:only_assigned', tenantId); } catch { onlyAssigned = true; }
        if (!onlyAssigned) {
          const viewAll = await hasPermission(userId, 'leads:view_all', tenantId).catch(() => false);
          onlyAssigned = !viewAll;
        }
      }
    }

    let sql = `
      SELECT f.*, l.name AS lead_name, l.phone AS lead_phone, u.name AS assigned_name
      FROM lead_followups f
      LEFT JOIN leads l ON l.id = f.lead_id
      LEFT JOIN users u ON u.id = f.assigned_to
      WHERE f.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (onlyAssigned) {
      params.push(userId);
      sql += ` AND (f.assigned_to = $${params.length} OR l.assigned_to = $${params.length})`;
    }

    sql += ' ORDER BY f.due_at ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { userId, tenantId, role } = req.user!;
  try {
    const result = await query(
      `SELECT l.*, ps.name AS stage_name, p.name AS pipeline_name, u.name AS assigned_name,
              mf.form_name AS meta_form_name,
              cf.name AS custom_form_name
       FROM leads l
       LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
       LEFT JOIN pipelines p ON p.id = l.pipeline_id
       LEFT JOIN users u ON u.id = l.assigned_to
       LEFT JOIN meta_forms mf ON mf.form_id = l.meta_form_id AND mf.tenant_id = l.tenant_id
       LEFT JOIN custom_forms cf ON cf.id::text = l.source_ref AND l.source = 'Custom Form'
       WHERE l.id = $1 AND l.tenant_id = $2 AND l.is_deleted = FALSE`,
      [req.params.id, tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Lead not found' }); return; }
    let lead = result.rows[0];
    if (role !== 'super_admin') {
      let shouldMask = false;
      try { shouldMask = await hasPermission(userId, 'leads:mask_phone', tenantId); } catch {}
      if (shouldMask) lead = { ...lead, phone: maskPhone(lead.phone) };
    }
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/leads
router.post('/', checkPermission('leads:create'), checkUsage('leads'), validate(CreateLeadSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, userId } = req.user!;
  const { name, email, pipeline_id, stage_id, notes, tags } = req.body;
  const source: string = 'Manual';
  const phone = req.body.phone ? normalizePhone(req.body.phone) : req.body.phone;

  const explicitAssignee = (req.body.assigned_to as string | null) ?? null;

  try {
    // Validate assigned_to belongs to the same tenant (#51)
    if (explicitAssignee) {
      const userCheck = await query(
        `SELECT id FROM users WHERE id=$1 AND tenant_id=$2 AND is_active=TRUE`,
        [explicitAssignee, tenantId]
      );
      if (!userCheck.rows[0]) {
        res.status(400).json({ error: 'assigned_to user not found in your organization' }); return;
      }
    }

    // Phone uniqueness check
    if (phone) {
      const dupPhone = await query(
        `SELECT id, name FROM leads WHERE tenant_id=$1 AND phone=$2 AND is_deleted=FALSE LIMIT 1`,
        [tenantId, phone]
      );
      if (dupPhone.rows[0]) {
        res.status(409).json({ error: `Phone number already exists — lead "${dupPhone.rows[0].name}" has this number`, duplicate_lead_id: dupPhone.rows[0].id });
        return;
      }
    }
    // Email uniqueness check
    if (email) {
      const dupEmail = await query(
        `SELECT id, name FROM leads WHERE tenant_id=$1 AND LOWER(email)=LOWER($2) AND is_deleted=FALSE LIMIT 1`,
        [tenantId, email]
      );
      if (dupEmail.rows[0]) {
        res.status(409).json({ error: `Email already exists — lead "${dupEmail.rows[0].name}" has this email`, duplicate_lead_id: dupEmail.rows[0].id });
        return;
      }
    }

    const result = await query(
      `INSERT INTO leads (tenant_id, name, email, phone, source, pipeline_id, stage_id, assigned_to, notes, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, name, email, phone, source, pipeline_id, stage_id, explicitAssignee, notes, tags ?? []]
    );
    const lead = result.rows[0];

    await query(
      `INSERT INTO lead_activities (lead_id, tenant_id, type, title, created_by)
       VALUES ($1,$2,'created','Lead created',$3)`,
      [lead.id, tenantId, userId]
    );
    const leadWithName = await query(
      `SELECT l.*, u.name AS assigned_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = $1`,
      [lead.id]
    );
    const emitLead = leadWithName.rows[0] ?? lead;
    emitToTenant(tenantId!, 'lead:created', emitLead);
    res.status(201).json(emitLead);
    setImmediate(async () => {
      incrementUsage(tenantId!, 'leads').catch(() => null);
      triggerWorkflows('lead_created', lead, tenantId!, userId).catch(() => null);

      sendNewLeadNotification(tenantId!, lead, userId).catch((err) =>
        console.error('Failed to create lead notifications:', err)
      );
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/leads/:id
router.patch('/:id', checkPermission('leads:edit'), validate(UpdateLeadSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, userId } = req.user!;
  if (req.body.phone) req.body.phone = normalizePhone(req.body.phone);
  const allowed = ['name', 'email', 'phone', 'pipeline_id', 'stage_id', 'assigned_to', 'notes', 'tags', 'status', 'deal_value'];
  const updates: string[] = [];
  const params: any[] = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      params.push(req.body[field]);
      updates.push(`${field} = $${params.length}`);
    }
  }
  if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }

  updates.push(`updated_at = NOW()`);
  params.push(req.params.id, tenantId);

  try {
    // Phone uniqueness check (exclude current lead)
    if (req.body.phone) {
      const normPhone = normalizePhone(req.body.phone);
      const dupPhone = await query(
        `SELECT id, name FROM leads WHERE tenant_id=$1 AND phone=$2 AND is_deleted=FALSE AND id<>$3 LIMIT 1`,
        [tenantId, normPhone, req.params.id]
      );
      if (dupPhone.rows[0]) {
        res.status(409).json({ error: `Phone number already in use by "${dupPhone.rows[0].name}"`, duplicate_lead_id: dupPhone.rows[0].id });
        return;
      }
    }
    // Email uniqueness check (exclude current lead)
    if (req.body.email) {
      const dupEmail = await query(
        `SELECT id, name FROM leads WHERE tenant_id=$1 AND LOWER(email)=LOWER($2) AND is_deleted=FALSE AND id<>$3 LIMIT 1`,
        [tenantId, req.body.email, req.params.id]
      );
      if (dupEmail.rows[0]) {
        res.status(409).json({ error: `Email already in use by "${dupEmail.rows[0].name}"`, duplicate_lead_id: dupEmail.rows[0].id });
        return;
      }
    }

    // Validate assigned_to belongs to the same tenant before writing (#51)
    if (req.body.assigned_to) {
      const userCheck = await query(
        `SELECT id FROM users WHERE id=$1 AND tenant_id=$2 AND is_active=TRUE`,
        [req.body.assigned_to, tenantId]
      );
      if (!userCheck.rows[0]) {
        res.status(400).json({ error: 'assigned_to user not found in your organization' }); return;
      }
    }

    // Get current lead for activity logging
    const current = await query('SELECT stage_id, assigned_to, tags, pipeline_id FROM leads WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]);
    const old = current.rows[0];

    const result = await query(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} AND is_deleted = FALSE RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Lead not found' }); return; }

    // Log stage change activity and fire workflow
    if (old && req.body.stage_id && req.body.stage_id !== old.stage_id) {
      const stageRes = await query('SELECT name FROM pipeline_stages WHERE id=$1', [req.body.stage_id]);
      const stageName = stageRes.rows[0]?.name ?? 'Unknown';
      await query(
        `INSERT INTO lead_activities (lead_id, tenant_id, type, title, created_by)
         VALUES ($1,$2,'stage_change',$3,$4)`,
        [req.params.id, tenantId, `Stage changed to ${stageName}`, userId]
      );
      setImmediate(() => triggerWorkflows('stage_changed', { ...result.rows[0], stage_name: stageName }, tenantId!, userId).catch(() => null));
    }

    // Fire lead_created when a lead is added to a pipeline (new assignment or moved from another pipeline)
    if (old && result.rows[0].pipeline_id && old.pipeline_id !== result.rows[0].pipeline_id) {
      setImmediate(() => triggerWorkflows('lead_created', result.rows[0], tenantId!, userId).catch(() => null));
    }

    // Log tag changes
    if (old && req.body.tags !== undefined) {
      const oldTags: string[] = old.tags ?? [];
      const newTags: string[] = req.body.tags ?? [];
      const added = newTags.filter((t: string) => !oldTags.includes(t));
      const removed = oldTags.filter((t: string) => !newTags.includes(t));
      if (added.length > 0) {
        await query(
          `INSERT INTO lead_activities (lead_id, tenant_id, type, title, created_by)
           VALUES ($1,$2,'tag_added',$3,$4)`,
          [req.params.id, tenantId, `Tags added: ${added.join(', ')}`, userId]
        );
      }
      if (removed.length > 0) {
        await query(
          `INSERT INTO lead_activities (lead_id, tenant_id, type, title, created_by)
           VALUES ($1,$2,'tag_added',$3,$4)`,
          [req.params.id, tenantId, `Tags removed: ${removed.join(', ')}`, userId]
        );
      }
    }

    const withName = await query(
      `SELECT l.*, u.name AS assigned_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = $1`,
      [result.rows[0].id]
    );
    const emitPayload = withName.rows[0] ?? result.rows[0];
    emitToTenant(tenantId!, 'lead:updated', emitPayload);
    res.json(emitPayload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/leads/:id — soft delete only
router.delete('/:id', checkPermission('leads:delete'), async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'UPDATE leads SET is_deleted = TRUE WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user!.tenantId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Notes ─────────────────────────────────────────────────────────────────────

// GET /api/leads/:id/notes
router.get('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT n.*, u.name AS created_by_name
       FROM lead_notes n
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.lead_id = $1 AND n.tenant_id = $2
       ORDER BY n.created_at DESC`,
      [req.params.id, req.user!.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/leads/:id/notes
router.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  const { tenantId, userId } = req.user!;
  const { title, content } = req.body;
  if (!content) { res.status(400).json({ error: 'Content is required' }); return; }
  try {
    const result = await query(
      `INSERT INTO lead_notes (lead_id, tenant_id, title, content, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, tenantId, title, content, userId]
    );
    await query(
      `INSERT INTO lead_activities (lead_id, tenant_id, type, title, created_by)
       VALUES ($1,$2,'note',$3,$4)`,
      [req.params.id, tenantId, `Note added: ${title ?? content.slice(0, 40)}`, userId]
    );
    res.status(201).json(result.rows[0]);
    setImmediate(() => triggerWorkflows('notes_added', { id: req.params.id, name: '' }, tenantId!, userId).catch(() => null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/leads/:id/notes/:noteId
router.delete('/:id/notes/:noteId', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'DELETE FROM lead_notes WHERE id=$1 AND lead_id=$2 AND tenant_id=$3',
      [req.params.noteId, req.params.id, req.user!.tenantId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Follow-ups ─────────────────────────────────────────────────────────────────

// GET /api/leads/:id/followups
router.get('/:id/followups', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT f.*, u.name AS assigned_name
       FROM lead_followups f
       LEFT JOIN users u ON u.id = f.assigned_to
       WHERE f.lead_id = $1 AND f.tenant_id = $2
       ORDER BY f.due_at ASC`,
      [req.params.id, req.user!.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/leads/:id/followups
router.post('/:id/followups', async (req: AuthRequest, res: Response) => {
  const { tenantId, userId } = req.user!;
  const { title, description, due_at, assigned_to } = req.body;
  if (!title || !due_at) { res.status(400).json({ error: 'Title and due_at are required' }); return; }
  try {
    const result = await query(
      `INSERT INTO lead_followups (lead_id, tenant_id, title, description, due_at, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, tenantId, title, description, due_at, assigned_to ?? userId, userId]
    );
    await query(
      `INSERT INTO lead_activities (lead_id, tenant_id, type, title, created_by)
       VALUES ($1,$2,'followup',$3,$4)`,
      [req.params.id, tenantId, `Follow-up scheduled: ${title}`, userId]
    );
    res.status(201).json(result.rows[0]);
    setImmediate(() => triggerWorkflows('follow_up', { id: req.params.id, name: '' }, tenantId!, userId).catch(() => null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/leads/:id/followups/:fuId — mark complete/incomplete
router.patch('/:id/followups/:fuId', async (req: AuthRequest, res: Response) => {
  const { tenantId, userId } = req.user!;
  const { completed } = req.body;
  try {
    const result = await query(
      `UPDATE lead_followups
       SET completed=$1, completed_at=$2
       WHERE id=$3 AND lead_id=$4 AND tenant_id=$5 RETURNING *`,
      [completed, completed ? new Date().toISOString() : null, req.params.fuId, req.params.id, tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Follow-up not found' }); return; }
    if (completed) {
      await query(
        `INSERT INTO lead_activities (lead_id, tenant_id, type, title, created_by)
         VALUES ($1,$2,'followup',$3,$4)`,
        [req.params.id, tenantId, `Follow-up completed: ${result.rows[0].title}`, userId]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Activities ─────────────────────────────────────────────────────────────────

// GET /api/leads/:id/activities
router.get('/:id/activities', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT a.*, u.name AS created_by_name
       FROM lead_activities a
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.lead_id = $1 AND a.tenant_id = $2
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [req.params.id, req.user!.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Per-lead custom field values ───────────────────────────────────────────────

// GET /api/leads/:id/fields
router.get('/:id/fields', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const leadId = req.params.id;
  try {
    const result = await query(
      `SELECT lfv.*, cf.name AS field_name, cf.type AS field_type, cf.slug
       FROM lead_field_values lfv
       JOIN custom_fields cf ON cf.id = lfv.field_id
       WHERE lfv.lead_id = $1 AND lfv.tenant_id = $2`,
      [leadId, tenantId]
    );

    // Auto-backfill: if no custom field data and lead is from Custom Form,
    // look up the matching form submission and re-apply field mapping
    if (result.rows.length === 0) {
      const leadRes = await query(
        `SELECT email, phone FROM leads WHERE id=$1 AND tenant_id=$2 AND source='Custom Form'`,
        [leadId, tenantId]
      );
      const lead = leadRes.rows[0];
      if (lead) {
        // Find a submission whose data contains this lead's email or phone
        const subRes = await query(
          `SELECT fs.data, fs.form_id FROM form_submissions fs
           WHERE fs.tenant_id=$1
             AND (fs.data::text ILIKE $2 OR fs.data::text ILIKE $3)
           ORDER BY fs.submitted_at DESC LIMIT 1`,
          [tenantId, `%${lead.email || '__none__'}%`, `%${lead.phone || '__none__'}%`]
        );
        const sub = subRes.rows[0];
        if (sub && sub.form_id) {
          const formRes = await query(
            `SELECT fields FROM custom_forms WHERE id=$1`,
            [sub.form_id]
          );
          const formFields: Array<{ mapTo: string; label: string }> = formRes.rows[0]?.fields ?? [];
          const data: Record<string, string> = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
          const customFieldsData: Record<string, string> = {};
          for (const field of formFields) {
            if (!field.mapTo || ['first_name','last_name','name','full_name','email','phone'].includes(field.mapTo)) continue;
            const value = data[field.label] ?? data[field.mapTo] ?? '';
            if (value) customFieldsData[field.mapTo] = value;
          }
          if (Object.keys(customFieldsData).length > 0) {
            await backfillCustomFields(leadId, tenantId!, customFieldsData);
            // Re-fetch after backfill
            const refetch = await query(
              `SELECT lfv.*, cf.name AS field_name, cf.type AS field_type, cf.slug
               FROM lead_field_values lfv
               JOIN custom_fields cf ON cf.id = lfv.field_id
               WHERE lfv.lead_id = $1 AND lfv.tenant_id = $2`,
              [leadId, tenantId]
            );
            res.json(refetch.rows);
            return;
          }
        }
      }
    }

    // Auto-backfill for Meta Form leads
    if (result.rows.length === 0) {
      try {
        const metaLeadRes = await query(
          `SELECT l.meta_form_id, l.source_ref
           FROM leads l
           WHERE l.id=$1 AND l.tenant_id=$2 AND l.source='meta_form' AND l.meta_form_id IS NOT NULL AND l.source_ref IS NOT NULL`,
          [leadId, tenantId]
        );
        const metaLead = metaLeadRes.rows[0];
        if (metaLead) {
          const formRes = await query(
            `SELECT mf.field_mapping, mi.access_token
             FROM meta_forms mf
             JOIN meta_integrations mi ON mi.tenant_id = mf.tenant_id
             WHERE mf.form_id=$1 AND mf.tenant_id=$2 LIMIT 1`,
            [metaLead.meta_form_id, tenantId]
          );
          const form = formRes.rows[0];
          if (form?.field_mapping && form?.access_token) {
            const token = decrypt(form.access_token);
            const mapping: Array<{ fb_field: string; crm_field: string }> = form.field_mapping ?? [];
            // Fetch this specific lead's field_data from Meta API
            const metaData = await metaGraphGet(`/${metaLead.source_ref}?fields=field_data`, token).catch(() => null);
            if (metaData?.field_data) {
              const { customValues } = parseMetaFieldData(metaData.field_data, mapping);
              if (Object.keys(customValues).length > 0) {
                await backfillCustomFields(leadId, tenantId!, customValues);
                const refetch = await query(
                  `SELECT lfv.*, cf.name AS field_name, cf.type AS field_type, cf.slug
                   FROM lead_field_values lfv
                   JOIN custom_fields cf ON cf.id = lfv.field_id
                   WHERE lfv.lead_id = $1 AND lfv.tenant_id = $2`,
                  [leadId, tenantId]
                );
                res.json(refetch.rows);
                return;
              }
            }
          }
        }
      } catch (e) {
        console.error('[meta fields backfill]', e);
      }
    }

    res.json(result.rows);
  } catch (err) {
    console.error('[GET /:id/fields]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

function metaGraphGet(path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://graph.facebook.com/v21.0${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON from Meta API')); }
      });
    }).on('error', reject);
  });
}

async function backfillCustomFields(leadId: string, tenantId: string, customFieldsData: Record<string, string>) {
  for (const [slug, value] of Object.entries(customFieldsData)) {
    if (!value) continue;
    try {
      let cfRes = await query('SELECT id FROM custom_fields WHERE tenant_id=$1 AND slug=$2 LIMIT 1', [tenantId, slug]);
      if (!cfRes.rows[0]) {
        const fieldName = slug.split(/[_\-]+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        try {
          cfRes = await query(
            `INSERT INTO custom_fields (tenant_id, name, type, slug, required) VALUES ($1,$2,'Single Line',$3,false) RETURNING id`,
            [tenantId, fieldName, slug]
          );
        } catch {
          cfRes = await query('SELECT id FROM custom_fields WHERE tenant_id=$1 AND slug=$2 LIMIT 1', [tenantId, slug]);
        }
      }
      if (cfRes.rows[0]?.id) {
        await query(
          `INSERT INTO lead_field_values (lead_id, tenant_id, field_id, value)
           VALUES ($1,$2,$3,$4) ON CONFLICT (lead_id, field_id) DO UPDATE SET value=$4, updated_at=NOW()`,
          [leadId, tenantId, cfRes.rows[0].id, value]
        );
      }
    } catch (err) {
      console.error('[backfillCustomFields]', slug, err);
    }
  }
}

// PATCH /api/leads/:id/fields — upsert one or many field values
router.patch('/:id/fields', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const values: Array<{ field_id: string; value: string }> = req.body.values ?? [];
  if (!values.length) { res.status(400).json({ error: 'values array required' }); return; }
  try {
    for (const { field_id, value } of values) {
      await query(
        `INSERT INTO lead_field_values (lead_id, tenant_id, field_id, value)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (lead_id, field_id) DO UPDATE SET value=$4, updated_at=NOW()`,
        [req.params.id, tenantId, field_id, value]
      );
    }
    const result = await query(
      `SELECT lfv.*, cf.name AS field_name, cf.type AS field_type, cf.slug
       FROM lead_field_values lfv
       JOIN custom_fields cf ON cf.id = lfv.field_id
       WHERE lfv.lead_id = $1 AND lfv.tenant_id = $2`,
      [req.params.id, tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── CSV Export ─────────────────────────────────────────────────────────────────

// GET /api/leads/export
// Leak 8 fix: include all custom field values as additional columns.
router.get('/export', checkPermission('leads:view_all'), async (req: AuthRequest, res: Response) => {
  const { tenantId, userId, role } = req.user!;
  let shouldMaskPhone = false;
  if (role !== 'super_admin') {
    try { shouldMaskPhone = await hasPermission(userId, 'leads:mask_phone', tenantId); } catch {}
  }
  try {
    // Fetch tenant's custom field definitions for column headers
    const cfDefs = await query(
      `SELECT slug, name FROM custom_fields WHERE tenant_id=$1 ORDER BY name`,
      [tenantId]
    );
    const customSlugs: string[]  = cfDefs.rows.map((r: any) => r.slug);
    const customNames: string[]  = cfDefs.rows.map((r: any) => r.name);

    const result = await query(
      `SELECT l.id, l.name, l.email, l.phone, l.source, l.status,
              ps.name AS stage, p.name AS pipeline,
              u.name AS assigned_to,
              l.tags, l.notes, l.created_at
       FROM leads l
       LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
       LEFT JOIN pipelines p ON p.id = l.pipeline_id
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.tenant_id = $1 AND l.is_deleted = FALSE
       ORDER BY l.created_at DESC`,
      [tenantId]
    );

    // Bulk-fetch custom field values for all lead IDs
    const leadIds = result.rows.map((r: any) => r.id);
    const cfValMap: Record<string, Record<string, string>> = {};
    if (leadIds.length > 0 && customSlugs.length > 0) {
      const cfVals = await query(
        `SELECT lfv.lead_id, cf.slug, lfv.value
         FROM lead_field_values lfv
         JOIN custom_fields cf ON cf.id = lfv.field_id
         WHERE lfv.lead_id = ANY($1::uuid[]) AND lfv.tenant_id = $2`,
        [leadIds, tenantId]
      );
      for (const row of cfVals.rows) {
        if (!cfValMap[row.lead_id]) cfValMap[row.lead_id] = {};
        cfValMap[row.lead_id][row.slug] = row.value;
      }
    }

    const stdHeaders = ['name','email','phone','source','status','stage','pipeline','assigned_to','tags','notes','created_at'];
    const headers = [...stdHeaders, ...customNames];

    const escape = (v: unknown) => {
      const s = v == null ? '' : Array.isArray(v) ? v.join(';') : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
    };

    const csv = [
      headers.join(','),
      ...result.rows.map((r: any) => {
        const row = shouldMaskPhone ? { ...r, phone: maskPhone(r.phone) } : r;
        const stdCols = stdHeaders.map(h => escape(row[h]));
        const customCols = customSlugs.map(slug => escape(cfValMap[r.id]?.[slug] ?? ''));
        return [...stdCols, ...customCols].join(',');
      }),
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── CSV Import ─────────────────────────────────────────────────────────────────

// POST /api/leads/import
router.post('/import', checkPermission('leads:create'), async (req: AuthRequest, res: Response) => {
  const { tenantId, userId } = req.user!;
  const { rows, pipeline_id, stage_id } = req.body as {
    rows: Array<Record<string, string>>;
    pipeline_id?: string;
    stage_id?: string;
  };
  if (!Array.isArray(rows) || !rows.length) {
    res.status(400).json({ error: 'rows array required' }); return;
  }

  const imported: string[] = [];
  const errors: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name  = r.name  ?? r['Full Name'] ?? r['full_name'] ?? '';
    const email = (r.email ?? r.Email ?? '').toLowerCase().trim();
    const phone = normalizePhone(r.phone ?? r.Phone ?? '');
    if (!name) { errors.push({ row: i + 1, reason: 'Missing name' }); continue; }
    try {
      const res2 = await query(
        `INSERT INTO leads (tenant_id, name, email, phone, source, pipeline_id, stage_id)
         VALUES ($1,$2,$3,$4,'CSV Import',$5,$6) RETURNING *`,
        [tenantId, name, email, phone, pipeline_id ?? null, stage_id ?? null]
      );
      const newLead = res2.rows[0];
      const leadId  = newLead.id;
      imported.push(leadId);
      await query(
        `INSERT INTO lead_activities (lead_id, tenant_id, type, title, created_by)
         VALUES ($1,$2,'created','Imported via CSV',$3)`,
        [leadId, tenantId, userId]
      );
      sendNewLeadNotification(tenantId!, newLead, userId).catch(() => null);
      setImmediate(() => triggerWorkflows('lead_created', newLead, tenantId!, userId).catch(() => null));
    } catch (err: any) {
      errors.push({ row: i + 1, reason: err.code === '23505' ? 'Duplicate phone/email' : 'DB error' });
    }
  }

  res.json({ imported: imported.length, errors });
});

export default router;
