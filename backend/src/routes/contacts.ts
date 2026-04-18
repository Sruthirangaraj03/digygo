import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, l.name AS lead_name FROM contacts c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.tenant_id = $1 ORDER BY c.created_at DESC`,
      [req.user!.tenantId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, email, phone, company, lead_id } = req.body;
  if (!name) { res.status(400).json({ error: 'Name required' }); return; }
  try {
    const result = await query(
      `INSERT INTO contacts (tenant_id, name, email, phone, company, lead_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user!.tenantId, name, email, phone, company, lead_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM contacts WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
