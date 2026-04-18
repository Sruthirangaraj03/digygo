import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT cs.*, t.name AS workspace_name, t.logo_url
       FROM company_settings cs
       JOIN tenants t ON t.id = cs.tenant_id
       WHERE cs.tenant_id = $1`,
      [req.user!.tenantId]
    );
    res.json(result.rows[0] ?? {});
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/', async (req: AuthRequest, res: Response) => {
  const { workspace_name, legal_name, website, phone, address, industry, timezone, currency, date_format, logo_url } = req.body;
  try {
    await query(
      `UPDATE company_settings SET legal_name=$1,website=$2,phone=$3,address=$4,
       industry=$5,timezone=$6,currency=$7,date_format=$8,updated_at=NOW()
       WHERE tenant_id=$9`,
      [legal_name, website, phone, address, industry, timezone, currency, date_format, req.user!.tenantId]
    );
    if (workspace_name || logo_url !== undefined) {
      const updates: string[] = [];
      const params: any[] = [];
      if (workspace_name) { params.push(workspace_name); updates.push(`name=$${params.length}`); }
      if (logo_url !== undefined) { params.push(logo_url); updates.push(`logo_url=$${params.length}`); }
      if (updates.length) {
        params.push(req.user!.tenantId);
        await query(`UPDATE tenants SET ${updates.join(',')} WHERE id=$${params.length}`, params);
      }
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/settings/staff
router.get('/staff', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, avatar_url, is_active, created_at
       FROM users WHERE tenant_id=$1 ORDER BY created_at ASC`,
      [req.user!.tenantId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/settings/staff
router.post('/staff', async (req: AuthRequest, res: Response) => {
  const bcrypt = await import('bcryptjs');
  const { name, email, password, role = 'staff' } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'name, email, password required' }); return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role`,
      [req.user!.tenantId, name, email.toLowerCase().trim(), hash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') { res.status(409).json({ error: 'Email already exists' }); }
    else { res.status(500).json({ error: 'Server error' }); }
  }
});

export default router;
