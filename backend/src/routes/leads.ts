import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/leads
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { stage, search, page = '1', limit = '50' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let sql = `
    SELECT l.*, ps.name AS stage_name, p.name AS pipeline_name,
           u.name AS assigned_name
    FROM leads l
    LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
    LEFT JOIN pipelines p ON p.id = l.pipeline_id
    LEFT JOIN users u ON u.id = l.assigned_to
    WHERE l.tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (stage) { params.push(stage); sql += ` AND l.stage_id = $${params.length}`; }
  if (search) { params.push(`%${search}%`); sql += ` AND (l.name ILIKE $${params.length} OR l.email ILIKE $${params.length})`; }

  sql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit), offset);

  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT l.*, ps.name AS stage_name, p.name AS pipeline_name, u.name AS assigned_name
       FROM leads l
       LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
       LEFT JOIN pipelines p ON p.id = l.pipeline_id
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.id = $1 AND l.tenant_id = $2`,
      [req.params.id, req.user!.tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Lead not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/leads
router.post('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { name, email, phone, source, pipeline_id, stage_id, assigned_to, notes, tags } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
  try {
    const result = await query(
      `INSERT INTO leads (tenant_id, name, email, phone, source, pipeline_id, stage_id, assigned_to, notes, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, name, email, phone, source, pipeline_id, stage_id, assigned_to, notes, tags ?? []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/leads/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const fields = ['name', 'email', 'phone', 'source', 'pipeline_id', 'stage_id', 'assigned_to', 'notes', 'tags', 'status'];
  const updates: string[] = [];
  const params: any[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      params.push(req.body[field]);
      updates.push(`${field} = $${params.length}`);
    }
  }
  if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }

  updates.push(`updated_at = NOW()`);
  params.push(req.params.id, req.user!.tenantId);

  try {
    const result = await query(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Lead not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM leads WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
