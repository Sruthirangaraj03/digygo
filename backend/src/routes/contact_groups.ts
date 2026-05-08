import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// GET /api/contact-groups
router.get('/', checkPermission('contact_groups:read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const result = await query(
      `SELECT cg.*,
        COUNT(cgm.id)::int AS member_count,
        u.name AS created_by_name
       FROM contact_groups cg
       LEFT JOIN contact_group_members cgm ON cgm.group_id = cg.id
       LEFT JOIN users u ON u.id = cg.created_by
       WHERE cg.tenant_id = $1::uuid
       GROUP BY cg.id, u.name
       ORDER BY cg.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/contact-groups
router.post('/', checkPermission('contact_groups:manage'), async (req: AuthRequest, res: Response) => {
  const { name, description = '', color = '#ea580c' } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return; }
  try {
    const { tenantId, userId } = req.user!;
    const result = await query(
      `INSERT INTO contact_groups (tenant_id, name, description, color, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5::uuid)
       RETURNING *, 0 AS member_count`,
      [tenantId, name.trim(), description.trim(), color, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/contact-groups/:id
router.patch('/:id', checkPermission('contact_groups:manage'), async (req: AuthRequest, res: Response) => {
  const { name, description, color } = req.body;
  const fields: string[] = [];
  const params: any[] = [];
  if (name        !== undefined) { params.push(name.trim());        fields.push(`name=$${params.length}`); }
  if (description !== undefined) { params.push(description.trim()); fields.push(`description=$${params.length}`); }
  if (color       !== undefined) { params.push(color);              fields.push(`color=$${params.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  fields.push('updated_at=NOW()');
  params.push(req.params.id, req.user!.tenantId);
  try {
    const result = await query(
      `UPDATE contact_groups SET ${fields.join(',')}
       WHERE id=$${params.length - 1}::uuid AND tenant_id=$${params.length}::uuid
       RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/contact-groups/:id
router.delete('/:id', checkPermission('contact_groups:manage'), async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `DELETE FROM contact_groups WHERE id=$1::uuid AND tenant_id=$2::uuid`,
      [req.params.id, req.user!.tenantId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/contact-groups/:id/members
router.get('/:id/members', checkPermission('contact_groups:read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const grp = await query(
      `SELECT id FROM contact_groups WHERE id=$1::uuid AND tenant_id=$2::uuid`,
      [req.params.id, tenantId]
    );
    if (!grp.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    const result = await query(
      `SELECT cgm.id, cgm.lead_id, cgm.added_by, cgm.added_at,
        l.name AS lead_name, l.email, l.phone, l.source, l.status, l.tags,
        u.name AS assigned_name,
        p.name AS pipeline_name,
        ps.name AS stage_name
       FROM contact_group_members cgm
       JOIN leads l ON l.id = cgm.lead_id AND l.is_deleted = FALSE
       LEFT JOIN users u ON u.id = l.assigned_to
       LEFT JOIN pipelines p ON p.id = l.pipeline_id
       LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
       WHERE cgm.group_id = $1::uuid
       ORDER BY cgm.added_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/contact-groups/:id/members — manual add (array of lead IDs)
router.post('/:id/members', checkPermission('contact_groups:manage'), async (req: AuthRequest, res: Response) => {
  const { lead_ids, added_by = 'manual' } = req.body;
  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    res.status(400).json({ error: 'lead_ids array required' }); return;
  }
  try {
    const { tenantId } = req.user!;
    const grp = await query(
      `SELECT id FROM contact_groups WHERE id=$1::uuid AND tenant_id=$2::uuid`,
      [req.params.id, tenantId]
    );
    if (!grp.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    let added = 0;
    for (const leadId of lead_ids) {
      const r = await query(
        `INSERT INTO contact_group_members (group_id, lead_id, added_by)
         VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (group_id, lead_id) DO NOTHING`,
        [req.params.id, leadId, added_by]
      );
      added += r.rowCount ?? 0;
    }
    res.json({ added });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/contact-groups/:id/members/filter — add by pipeline/stage/tags/source/date
router.post('/:id/members/filter', checkPermission('contact_groups:manage'), async (req: AuthRequest, res: Response) => {
  const { pipeline_id, stage_id, tags, source, date_from, date_to, preview = false } = req.body;
  try {
    const { tenantId } = req.user!;
    const grp = await query(
      `SELECT id FROM contact_groups WHERE id=$1::uuid AND tenant_id=$2::uuid`,
      [req.params.id, tenantId]
    );
    if (!grp.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

    const params: any[] = [tenantId];
    let where = `WHERE l.tenant_id = $1::uuid AND l.is_deleted = FALSE`;
    if (pipeline_id)   { params.push(pipeline_id);         where += ` AND l.pipeline_id = $${params.length}::uuid`; }
    if (stage_id)      { params.push(stage_id);            where += ` AND l.stage_id = $${params.length}::uuid`; }
    if (tags?.length)  { params.push(tags);                where += ` AND l.tags && $${params.length}::text[]`; }
    if (source)        { params.push(source);              where += ` AND l.source = $${params.length}`; }
    if (date_from)     { params.push(date_from);           where += ` AND l.created_at >= $${params.length}`; }
    if (date_to)       { params.push(date_to);             where += ` AND l.created_at <= ($${params.length}::date + interval '1 day')`; }

    if (preview) {
      const count = await query(`SELECT COUNT(*)::int AS count FROM leads l ${where}`, params);
      res.json({ count: count.rows[0].count });
      return;
    }

    const leads = await query(`SELECT id FROM leads l ${where} LIMIT 5000`, params);
    let added = 0;
    for (const lead of leads.rows) {
      const r = await query(
        `INSERT INTO contact_group_members (group_id, lead_id, added_by)
         VALUES ($1::uuid, $2::uuid, 'filter')
         ON CONFLICT (group_id, lead_id) DO NOTHING`,
        [req.params.id, lead.id]
      );
      added += r.rowCount ?? 0;
    }
    res.json({ added, total: leads.rows.length });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/contact-groups/:id/members/:leadId
router.delete('/:id/members/:leadId', checkPermission('contact_groups:manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const grp = await query(
      `SELECT id FROM contact_groups WHERE id=$1::uuid AND tenant_id=$2::uuid`,
      [req.params.id, tenantId]
    );
    if (!grp.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    await query(
      `DELETE FROM contact_group_members WHERE group_id=$1::uuid AND lead_id=$2::uuid`,
      [req.params.id, req.params.leadId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
