import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { requireAuth, requireSuperAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  try {
    const result = await query(
      'SELECT id, tenant_id, email, password_hash, name, role, avatar_url FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as any
    );

    res.json({
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, tenant_id, email, name, role, avatar_url FROM users WHERE id = $1',
      [req.user!.userId]
    );
    const user = result.rows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ id: user.id, tenantId: user.tenant_id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatar_url });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/tenants — super admin creates a new business
router.post('/tenants', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const { businessName, email, adminName, password, plan = 'starter' } = req.body;
  if (!businessName || !email || !adminName || !password) {
    res.status(400).json({ error: 'businessName, email, adminName, password required' });
    return;
  }

  const client = (await import('../db')).pool;
  const conn = await client.connect();
  try {
    await conn.query('BEGIN');

    // Create tenant
    const tenantRes = await conn.query(
      `INSERT INTO tenants (name, email, plan) VALUES ($1, $2, $3) RETURNING id`,
      [businessName, email.toLowerCase().trim(), plan]
    );
    const tenantId = tenantRes.rows[0].id;

    // Create their company settings row
    await conn.query(`INSERT INTO company_settings (tenant_id) VALUES ($1)`, [tenantId]);

    // Create default pipeline
    const pipelineRes = await conn.query(
      `INSERT INTO pipelines (tenant_id, name) VALUES ($1, 'Sales Pipeline') RETURNING id`,
      [tenantId]
    );
    const pipelineId = pipelineRes.rows[0].id;

    // Default stages
    for (const [i, name] of ['New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'].entries()) {
      await conn.query(
        `INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, stage_order) VALUES ($1, $2, $3, $4)`,
        [tenantId, pipelineId, name, i]
      );
    }

    // Create tenant admin user
    const hash = await bcrypt.hash(password, 10);
    const userRes = await conn.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
      [tenantId, email.toLowerCase().trim(), hash, adminName]
    );

    await conn.query('COMMIT');
    res.status(201).json({
      message: 'Tenant created',
      tenantId,
      userId: userRes.rows[0].id,
      credentials: { email: email.toLowerCase().trim(), password },
    });
  } catch (err: any) {
    await conn.query('ROLLBACK');
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  } finally {
    conn.release();
  }
});

// GET /api/auth/tenants — super admin lists all tenants
router.get('/tenants', requireAuth, requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT t.id, t.name, t.email, t.plan, t.created_at,
             COUNT(DISTINCT u.id) AS user_count,
             COUNT(DISTINCT l.id) AS lead_count
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      LEFT JOIN leads l ON l.tenant_id = t.id
      GROUP BY t.id ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
