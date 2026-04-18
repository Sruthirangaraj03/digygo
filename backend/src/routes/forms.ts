import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// ── Custom Forms ──────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT f.*,
              COUNT(s.id)::int AS submission_count
       FROM custom_forms f
       LEFT JOIN form_submissions s ON s.form_id = f.id
       WHERE f.tenant_id = $1
       GROUP BY f.id ORDER BY f.created_at DESC`,
      [req.user!.tenantId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, fields, pipeline_id, stage_id } = req.body;
  if (!name) { res.status(400).json({ error: 'Form name required' }); return; }
  try {
    const result = await query(
      `INSERT INTO custom_forms (tenant_id, name, fields, pipeline_id, stage_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user!.tenantId, name, JSON.stringify(fields ?? []), pipeline_id, stage_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { name, fields, pipeline_id, stage_id, is_active } = req.body;
  try {
    const result = await query(
      `UPDATE custom_forms SET name=$1, fields=$2, pipeline_id=$3, stage_id=$4, is_active=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [name, JSON.stringify(fields), pipeline_id, stage_id, is_active, req.params.id, req.user!.tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Form not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM custom_forms WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ── Submissions ───────────────────────────────────────────────────────────────

router.get('/:id/submissions', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM form_submissions WHERE form_id=$1 AND tenant_id=$2 ORDER BY submitted_at DESC`,
      [req.params.id, req.user!.tenantId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Public: POST /api/forms/:id/submit (no auth — public form submission)
router.post('/:id/submit', async (req: AuthRequest, res: Response) => {
  const { data } = req.body as { data: Record<string, string> };
  try {
    const formRes = await query('SELECT * FROM custom_forms WHERE id=$1 AND is_active=TRUE', [req.params.id]);
    const form = formRes.rows[0];
    if (!form) { res.status(404).json({ error: 'Form not found or inactive' }); return; }

    await query(
      `INSERT INTO form_submissions (form_id, tenant_id, data) VALUES ($1,$2,$3)`,
      [form.id, form.tenant_id, JSON.stringify(data)]
    );

    if (form.pipeline_id && data?.name) {
      await query(
        `INSERT INTO leads (tenant_id, name, email, phone, source, pipeline_id, stage_id)
         VALUES ($1,$2,$3,$4,'Custom Form',$5,$6)`,
        [form.tenant_id, data.name, data.email, data.phone, form.pipeline_id, form.stage_id]
      );
    }

    res.json({ success: true, message: 'Submission received' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
