import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const pipelines = await query('SELECT * FROM pipelines WHERE tenant_id=$1 ORDER BY created_at', [req.user!.tenantId]);
    const stages = await query('SELECT * FROM pipeline_stages WHERE tenant_id=$1 ORDER BY stage_order', [req.user!.tenantId]);
    const result = pipelines.rows.map((p: any) => ({
      ...p,
      stages: stages.rows.filter((s: any) => s.pipeline_id === p.id),
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
