import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission, hasPermission } from '../middleware/permissions';
import { checkUsage, incrementUsage } from '../middleware/plan';
import { triggerWorkflows } from './workflows';
import * as XLSX from 'xlsx';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// GET /api/contacts
router.get('/', checkPermission('contacts:read'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, tenantId, role } = req.user!;
    const isSuperAdmin = role === 'super_admin';

    let onlyAssigned = false;
    if (!isSuperAdmin) {
      try { onlyAssigned = await hasPermission(userId, 'leads:only_assigned', tenantId); } catch { onlyAssigned = true; }
    }

    const params: any[] = [tenantId];
    let assignedFilter = '';
    if (onlyAssigned) {
      params.push(userId);
      assignedFilter = ` AND l.assigned_to = $${params.length}`;
    }

    const result = await query(
      `SELECT c.*, l.name AS lead_name FROM contacts c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.tenant_id = $1${assignedFilter} ORDER BY c.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/contacts/export
const CONTACT_FIELDS: Record<string, string> = {
  name: 'Name', email: 'Email', phone: 'Phone', company: 'Company',
  tags: 'Tags', created_at: 'Created At',
  source: 'Source',
  assigned_name: 'Assigned To',
  pipeline_name: 'Pipeline',
  stage_name: 'Stage',
  lead_quality: 'Lead Quality',
  deal_value: 'Deal Value',
  last_activity: 'Last Activity',
  next_followup_date: 'Next Follow-up Date',
  followup_status: 'Follow-up Status',
  team_member_names: 'Team Members',
  lead_updated_at: 'Last Updated',
};

router.get('/export', checkPermission('contacts:export'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, tenantId, role } = req.user!;
    const { fields = '', format = 'xlsx' } = req.query as Record<string, string>;
    const isSuperAdmin = role === 'super_admin';

    let onlyAssigned = false;
    if (!isSuperAdmin) {
      try { onlyAssigned = await hasPermission(userId, 'leads:only_assigned', tenantId); } catch { onlyAssigned = true; }
    }

    const params: any[] = [tenantId];
    let assignedFilter = '';
    if (onlyAssigned) {
      params.push(userId);
      assignedFilter = ` AND (l.assigned_to = $${params.length}::uuid OR $${params.length}::uuid = ANY(l.team_members))`;
    }

    const result = await query(
      `SELECT c.*,
        l.source,
        l.deal_value,
        l.updated_at AS lead_updated_at,
        l.custom_fields->>'lead_quality' AS lead_quality,
        u.name AS assigned_name,
        p.name AS pipeline_name,
        ps.name AS stage_name,
        l.updated_at AS last_activity,
        (SELECT string_agg(u2.name, ', ') FROM users u2 WHERE u2.id = ANY(l.team_members)) AS team_member_names,
        (SELECT MIN(f.due_at) FROM lead_followups f WHERE f.lead_id = l.id AND f.completed = FALSE) AS next_followup_date,
        (SELECT CASE
           WHEN MIN(f.due_at) IS NULL THEN 'None'
           WHEN MIN(f.due_at) < NOW() THEN 'Overdue'
           ELSE 'Pending'
         END FROM lead_followups f WHERE f.lead_id = l.id AND f.completed = FALSE) AS followup_status
       FROM contacts c
       LEFT JOIN leads l ON l.id = c.lead_id AND l.is_deleted = FALSE
       LEFT JOIN users u ON u.id = l.assigned_to
       LEFT JOIN pipelines p ON p.id = l.pipeline_id
       LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
       WHERE c.tenant_id = $1${assignedFilter}
       ORDER BY c.created_at DESC LIMIT 10000`,
      params
    );

    const selectedFields = fields ? fields.split(',').filter((f) => CONTACT_FIELDS[f]) : Object.keys(CONTACT_FIELDS);

    const sheetData = result.rows.map((row: any) => {
      const out: Record<string, any> = {};
      for (const f of selectedFields) {
        let val = row[f];
        if (f === 'tags' && Array.isArray(val)) val = val.join(', ');
        if ((f === 'created_at' || f === 'lead_updated_at' || f === 'last_activity') && val)
          val = new Date(val).toLocaleString();
        if (f === 'next_followup_date' && val)
          val = new Date(val).toLocaleString();
        if (f === 'deal_value' && val !== null && val !== undefined)
          val = Number(val);
        out[CONTACT_FIELDS[f]] = val ?? '';
      }
      return out;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      res.setHeader('Content-Type', 'text/csv');
      res.send(csv);
    } else {
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /api/contacts
router.post('/', checkPermission('contacts:create'), checkUsage('contacts'), async (req: AuthRequest, res: Response) => {
  const { name, email, phone, company, lead_id } = req.body;
  if (!name) { res.status(400).json({ error: 'Name required' }); return; }
  try {
    const result = await query(
      `INSERT INTO contacts (tenant_id, name, email, phone, company, lead_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user!.tenantId, name, email, phone, company, lead_id]
    );
    const contact = result.rows[0];
    res.status(201).json(contact);
    const lead = { id: contact.lead_id, name: contact.name, email: contact.email, phone: contact.phone };
    const source = (req.body.source as string) ?? 'Manual';
    setImmediate(() => {
      incrementUsage(req.user!.tenantId!, 'contacts').catch(() => null);
      triggerWorkflows('contact_created', lead, req.user!.tenantId!, req.user!.userId,
        { triggerContext: { source } }
      ).catch(() => null);
    });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/contacts/:id
router.patch('/:id', checkPermission('contacts:edit'), async (req: AuthRequest, res: Response) => {
  const { name, email, phone, company, tags } = req.body;

  const fields: string[] = [];
  const params: any[] = [];
  if (name    !== undefined) { params.push(name);    fields.push(`name=$${params.length}`); }
  if (email   !== undefined) { params.push(email);   fields.push(`email=$${params.length}`); }
  if (phone   !== undefined) { params.push(phone);   fields.push(`phone=$${params.length}`); }
  if (company !== undefined) { params.push(company); fields.push(`company=$${params.length}`); }
  if (tags    !== undefined) { params.push(tags);    fields.push(`tags=$${params.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  params.push(req.params.id, req.user!.tenantId);
  try {
    const result = await query(
      `UPDATE contacts SET ${fields.join(',')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    const contact = result.rows[0];
    res.json(contact);
    const leadCtx = { id: contact.lead_id ?? contact.id, name: contact.name, email: contact.email, phone: contact.phone };
    // contact_tagged is intentionally NOT fired here — tag changes on leads always
    // go through PATCH /api/leads/:id which is the authoritative path. Firing here
    // too would cause double-execution for the same lead.
    if (tags === undefined) {
      const changedField = ['name','email','phone','company'].find((k) => req.body[k] !== undefined) ?? '';
      setImmediate(() => triggerWorkflows('contact_updated', leadCtx, req.user!.tenantId!, req.user!.userId,
        { triggerContext: { fieldChanged: changedField } }
      ).catch(() => null));
    }
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/contacts/:id
router.delete('/:id', checkPermission('contacts:delete'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM contacts WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
