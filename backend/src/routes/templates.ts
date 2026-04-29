import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// GET /api/templates — list WA/email templates for tenant
router.get('/', checkPermission('automation_templates:read'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, category, language, status, body, header, footer, buttons, variables, created_at
       FROM templates WHERE tenant_id=$1 ORDER BY created_at DESC`,
      [req.user!.tenantId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/templates — create template
router.post('/', checkPermission('automation_templates:manage'), async (req: AuthRequest, res: Response) => {
  const { name, category = 'UTILITY', language = 'en', body, header, footer, buttons, variables } = req.body;
  if (!name || !body) { res.status(400).json({ error: 'name and body are required' }); return; }
  try {
    const result = await query(
      `INSERT INTO templates (tenant_id, name, category, language, body, header, footer, buttons, variables)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user!.tenantId, name, category, language, body, header ?? null, footer ?? null,
       JSON.stringify(buttons ?? []), JSON.stringify(variables ?? [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/templates/:id
router.patch('/:id', checkPermission('automation_templates:manage'), async (req: AuthRequest, res: Response) => {
  const { name, body, header, footer, buttons, variables, status } = req.body;
  const fields: string[] = [];
  const params: any[] = [];
  if (name !== undefined)      { params.push(name);                       fields.push(`name=$${params.length}`); }
  if (body !== undefined)      { params.push(body);                       fields.push(`body=$${params.length}`); }
  if (header !== undefined)    { params.push(header);                     fields.push(`header=$${params.length}`); }
  if (footer !== undefined)    { params.push(footer);                     fields.push(`footer=$${params.length}`); }
  if (buttons !== undefined)   { params.push(JSON.stringify(buttons));    fields.push(`buttons=$${params.length}`); }
  if (variables !== undefined) { params.push(JSON.stringify(variables));  fields.push(`variables=$${params.length}`); }
  if (status !== undefined)    { params.push(status);                     fields.push(`status=$${params.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  params.push(req.params.id, req.user!.tenantId);
  try {
    const result = await query(
      `UPDATE templates SET ${fields.join(',')} WHERE id=$${params.length-1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/templates/:id
router.delete('/:id', checkPermission('automation_templates:manage'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM templates WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
