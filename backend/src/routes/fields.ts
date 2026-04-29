import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// ── Custom Standard Fields ────────────────────────────────────────────────────

router.get('/custom', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM custom_fields WHERE tenant_id=$1 ORDER BY created_at ASC',
      [req.user!.tenantId]
    );
    res.json(result.rows);
  } catch (err: any) {
    if (err?.code === '42P01') { res.json([]); return; }
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/custom', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  const { name, type, slug, placeholder, options, required, is_active } = req.body;
  if (!name || !type || !slug) { res.status(400).json({ error: 'name, type, slug required' }); return; }
  try {
    const result = await query(
      `INSERT INTO custom_fields (tenant_id, name, type, slug, placeholder, options, required, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user!.tenantId, name, type, slug, placeholder ?? null, options ? JSON.stringify(options) : null, required ?? false, is_active !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === '42P01') { res.status(503).json({ error: 'custom_fields table not ready, run migrations' }); return; }
    if (err?.code === '23505') { res.status(409).json({ error: 'Slug already exists' }); return; }
    res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

router.patch('/custom/:id', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  const { name, type, placeholder, options, required, is_active } = req.body;
  const fields: string[] = [];
  const params: any[] = [];
  if (name !== undefined)        { params.push(name);       fields.push(`name=$${params.length}`); }
  if (type !== undefined)        { params.push(type);       fields.push(`type=$${params.length}`); }
  if (placeholder !== undefined) { params.push(placeholder); fields.push(`placeholder=$${params.length}`); }
  if (options !== undefined)     { params.push(JSON.stringify(options)); fields.push(`options=$${params.length}`); }
  if (required !== undefined)    { params.push(required);   fields.push(`required=$${params.length}`); }
  if (is_active !== undefined)   { params.push(is_active);  fields.push(`is_active=$${params.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  params.push(req.params.id, req.user!.tenantId);
  try {
    const result = await query(
      `UPDATE custom_fields SET ${fields.join(',')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/custom/:id', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM custom_fields WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Pipeline Questions ────────────────────────────────────────────────────────

router.get('/questions', checkPermission('fields:view'), async (req: AuthRequest, res: Response) => {
  const { pipeline_id } = req.query as { pipeline_id?: string };
  let sql = 'SELECT * FROM pipeline_questions WHERE tenant_id=$1';
  const params: any[] = [req.user!.tenantId];
  if (pipeline_id && pipeline_id !== 'all') {
    params.push(pipeline_id);
    sql += ` AND (pipeline_id=$${params.length} OR pipeline_id='all')`;
  }
  sql += ' ORDER BY sort_order ASC, created_at ASC';
  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    if (err.code === '42P01') { res.json([]); return; } // table not yet created
    console.error('[fields GET /questions]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/questions', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  const { pipeline_id, question, type, slug, options, required, sort_order } = req.body;
  if (!question || !type || !slug) { res.status(400).json({ error: 'question, type, slug required' }); return; }
  try {
    const result = await query(
      `INSERT INTO pipeline_questions (tenant_id, pipeline_id, question, type, slug, options, required, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user!.tenantId, pipeline_id ?? 'all', question, type, slug,
       options ? JSON.stringify(options) : null, required ?? false, sort_order ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') { res.status(409).json({ error: 'Slug already exists' }); return; }
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/questions/:id', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  const { question, type, options, required, sort_order } = req.body;
  const fields: string[] = [];
  const params: any[] = [];
  if (question !== undefined)   { params.push(question);   fields.push(`question=$${params.length}`); }
  if (type !== undefined)       { params.push(type);       fields.push(`type=$${params.length}`); }
  if (options !== undefined)    { params.push(JSON.stringify(options)); fields.push(`options=$${params.length}`); }
  if (required !== undefined)   { params.push(required);   fields.push(`required=$${params.length}`); }
  if (sort_order !== undefined) { params.push(sort_order); fields.push(`sort_order=$${params.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  params.push(req.params.id, req.user!.tenantId);
  try {
    const result = await query(
      `UPDATE pipeline_questions SET ${fields.join(',')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/questions/:id', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM pipeline_questions WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Value Tokens ──────────────────────────────────────────────────────────────

router.get('/values', checkPermission('fields:view'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM value_tokens WHERE tenant_id=$1 ORDER BY created_at ASC',
      [req.user!.tenantId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/values', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  const { name, replace_with } = req.body;
  if (!name || !replace_with) { res.status(400).json({ error: 'name and replace_with required' }); return; }
  try {
    const result = await query(
      'INSERT INTO value_tokens (tenant_id, name, replace_with) VALUES ($1,$2,$3) RETURNING *',
      [req.user!.tenantId, name, replace_with]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') { res.status(409).json({ error: 'Name already exists' }); return; }
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/values/:id', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  const { name, replace_with } = req.body;
  const fields: string[] = [];
  const params: any[] = [];
  if (name !== undefined)         { params.push(name);        fields.push(`name=$${params.length}`); }
  if (replace_with !== undefined) { params.push(replace_with); fields.push(`replace_with=$${params.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  params.push(req.params.id, req.user!.tenantId);
  try {
    const result = await query(
      `UPDATE value_tokens SET ${fields.join(',')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/values/:id', checkPermission('fields:manage'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM value_tokens WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
