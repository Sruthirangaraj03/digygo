import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query as Record<string, string>;
  let sql = `
    SELECT e.*, u.name AS assigned_name, l.name AS lead_name
    FROM calendar_events e
    LEFT JOIN users u ON u.id = e.assigned_to
    LEFT JOIN leads l ON l.id = e.lead_id
    WHERE e.tenant_id = $1
  `;
  const params: any[] = [req.user!.tenantId];
  if (from) { params.push(from); sql += ` AND e.start_time >= $${params.length}`; }
  if (to)   { params.push(to);   sql += ` AND e.end_time   <= $${params.length}`; }
  sql += ' ORDER BY e.start_time ASC';

  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { title, description, start_time, end_time, type, lead_id, assigned_to } = req.body;
  if (!title || !start_time || !end_time) {
    res.status(400).json({ error: 'title, start_time, end_time required' }); return;
  }
  try {
    const result = await query(
      `INSERT INTO calendar_events (tenant_id, title, description, start_time, end_time, type, lead_id, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user!.tenantId, title, description, start_time, end_time, type ?? 'meeting', lead_id, assigned_to, req.user!.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { title, description, start_time, end_time, type, lead_id, assigned_to } = req.body;
  try {
    const result = await query(
      `UPDATE calendar_events SET
         title=$1, description=$2, start_time=$3, end_time=$4, type=$5, lead_id=$6, assigned_to=$7
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [title, description, start_time, end_time, type, lead_id, assigned_to, req.params.id, req.user!.tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Event not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM calendar_events WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
