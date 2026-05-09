import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// GET /api/notifications — Fix 16: optional ?unread=true filter
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.user!;
    let sql = `SELECT * FROM notifications
               WHERE tenant_id=$1 AND (user_id=$2 OR user_id IS NULL)`;
    if (req.query.unread === 'true') sql += ' AND is_read=FALSE';
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const result = await query(sql, [tenantId, userId]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/notifications/:id/read — Fix 1: verify ownership before marking read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE notifications SET is_read=TRUE
       WHERE id=$1 AND tenant_id=$2 AND (user_id=$3::uuid OR user_id IS NULL)`,
      [req.params.id, req.user!.tenantId, req.user!.userId],
    );
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/notifications/read-all — Fix 2: only mark user-specific rows, never mutate shared tenant-wide rows
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE notifications SET is_read=TRUE
       WHERE tenant_id=$1 AND user_id=$2::uuid`,
      [req.user!.tenantId, req.user!.userId],
    );
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/notifications/:id — Fix 15: dismiss a notification
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `DELETE FROM notifications
       WHERE id=$1 AND tenant_id=$2 AND (user_id=$3::uuid OR user_id IS NULL)`,
      [req.params.id, req.user!.tenantId, req.user!.userId],
    );
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
