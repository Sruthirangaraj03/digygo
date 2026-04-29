import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// GET /api/notifications
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM notifications
       WHERE tenant_id=$1 AND (user_id=$2 OR user_id IS NULL)
       ORDER BY created_at DESC LIMIT 50`,
      [req.user!.tenantId, req.user!.userId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE notifications SET is_read=TRUE WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user!.tenantId]
    );
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE notifications SET is_read=TRUE
       WHERE tenant_id=$1 AND (user_id=$2 OR user_id IS NULL)`,
      [req.user!.tenantId, req.user!.userId]
    );
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
