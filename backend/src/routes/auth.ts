import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query, pool } from '../db';
import { config } from '../config';
import { requireAuth, requireSuperAdmin, AuthRequest, invalidateTenantCache } from '../middleware/auth';

const router = Router();

const REFRESH_COOKIE = 'digygo_refresh';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 min

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production', // HTTPS only in production (#4)
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

// Include plan in JWT so checkPlan middleware needs no DB hit (#61)
function issueAccessToken(userId: string, tenantId: string | null, role: string, plan?: string) {
  return jwt.sign(
    { userId, tenantId, role, plan: plan ?? 'starter' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as any
  );
}

// First 16 hex chars of the token used as a DB-indexed prefix (#1 / #52)
function tokenPrefix(token: string): string {
  return token.substring(0, 16);
}

// Helper: write a super-admin audit log entry (non-blocking)
function auditLog(
  actorId: string,
  action: string,
  opts: { tenantId?: string; userId?: string; metadata?: object; ip?: string } = {}
): void {
  query(
    `INSERT INTO audit_log (actor_id, target_tenant_id, target_user_id, action, metadata, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [actorId, opts.tenantId ?? null, opts.userId ?? null, action,
     opts.metadata ? JSON.stringify(opts.metadata) : null, opts.ip ?? null]
  ).catch((err) => console.error('[audit_log]', err.message));
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email and password required' });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const result = await query(
      `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.name, u.role, u.avatar_url,
              u.failed_login_attempts, u.locked_until, u.is_active,
              t.plan AS tenant_plan
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE lower(u.email) = lower($1)`,
      [email.trim()]
    );
    const user = result.rows[0];

    // Timing-safe path even on missing user
    if (!user || !user.is_active) {
      await bcrypt.compare(password, '$2a$10$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXX');
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      res.status(429).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_login_attempts ?? 0) + 1;
      const lockUntil = attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS)
        : null;
      await query(
        `UPDATE users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3`,
        [attempts, lockUntil, user.id]
      );
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Issue refresh token; store bcrypt hash + indexed prefix (#1)
    const refreshToken  = crypto.randomBytes(40).toString('hex');
    const refreshHash   = await bcrypt.hash(refreshToken, 10);
    const prefix        = tokenPrefix(refreshToken);
    await query(
      `UPDATE users
         SET refresh_token_hash=$1, refresh_token_prefix=$2,
             failed_login_attempts=0, locked_until=NULL, last_login_at=NOW()
       WHERE id=$3`,
      [refreshHash, prefix, user.id]
    );

    // Fetch tenant branding
    let tenantName = 'DigyGo CRM';
    let tenantLogo: string | null = null;
    if (user.tenant_id) {
      const brandRes = await query(
        `SELECT t.name, t.logo_url, cs.legal_name
         FROM tenants t
         LEFT JOIN company_settings cs ON cs.tenant_id = t.id
         WHERE t.id = $1`,
        [user.tenant_id]
      );
      if (brandRes.rows[0]) {
        tenantName = brandRes.rows[0].legal_name || brandRes.rows[0].name || tenantName;
        tenantLogo = brandRes.rows[0].logo_url || null;
      }
    }

    const plan        = user.tenant_plan ?? 'starter';
    const accessToken = issueAccessToken(user.id, user.tenant_id, user.role, plan);
    setRefreshCookie(res, refreshToken);

    res.json({
      token: accessToken,
      user: {
        id: user.id, tenantId: user.tenant_id, email: user.email,
        name: user.name, role: user.role, avatarUrl: user.avatar_url,
      },
      tenant: { name: tenantName, logoUrl: tenantLogo },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/refresh
// O(1) lookup via refresh_token_prefix + atomic rotation to prevent race reuse (#1 / #52)
router.post('/refresh', async (req: Request, res: Response) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }

  const prefix = tokenPrefix(token);

  try {
    // Single-row lookup — no full-table scan
    const result = await query(
      `SELECT u.id, u.tenant_id, u.role, u.is_active,
              u.refresh_token_hash, u.refresh_token_prefix,
              t.plan AS tenant_plan
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.refresh_token_prefix=$1 AND u.is_active=TRUE
       LIMIT 1`,
      [prefix]
    );

    const candidate = result.rows[0];
    if (!candidate) {
      clearRefreshCookie(res);
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const match = await bcrypt.compare(token, candidate.refresh_token_hash);
    if (!match) {
      clearRefreshCookie(res);
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Atomic rotation: UPDATE WHERE prefix = old value.
    // If two tabs race here, only one UPDATE wins — the loser gets 0 rows.
    const newToken  = crypto.randomBytes(40).toString('hex');
    const newHash   = await bcrypt.hash(newToken, 10);
    const newPrefix = tokenPrefix(newToken);

    const rotated = await query(
      `UPDATE users
         SET refresh_token_hash=$1, refresh_token_prefix=$2, last_login_at=NOW()
       WHERE id=$3 AND refresh_token_prefix=$4
       RETURNING id`,
      [newHash, newPrefix, candidate.id, prefix]
    );

    if (!rotated.rows[0]) {
      // Concurrent request already rotated this token — this copy is stale
      clearRefreshCookie(res);
      res.status(401).json({ error: 'Session expired — please log in again' });
      return;
    }

    const plan        = candidate.tenant_plan ?? 'starter';
    const accessToken = issueAccessToken(candidate.id, candidate.tenant_id, candidate.role, plan);
    setRefreshCookie(res, newToken);
    res.json({ token: accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET refresh_token_hash=NULL, refresh_token_prefix=NULL WHERE id=$1`,
      [req.user!.userId]
    );
    clearRefreshCookie(res);
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me/permissions
router.get('/me/permissions', requireAuth, async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!;
  // super_admin and owner always have full access — resolved from JWT role, no DB hit
  if (role === 'super_admin' || role === 'owner') {
    res.json({ role, all: true, permissions: {} });
    return;
  }
  try {
    const result = await query(
      `SELECT up.permissions AS user_perms
       FROM user_permissions up
       WHERE up.user_id = $1`,
      [userId]
    );
    const perms: Record<string, boolean> = result.rows[0]?.user_perms ?? {};
    res.json({ role, all: false, permissions: perms });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.avatar_url,
              t.name AS tenant_name, t.logo_url AS tenant_logo, t.plan AS tenant_plan,
              cs.legal_name
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN company_settings cs ON cs.tenant_id = u.tenant_id
       WHERE u.id = $1`,
      [req.user!.userId]
    );
    const user = result.rows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    let tenantName = user.legal_name || user.tenant_name || 'DigyGo CRM';
    let tenantLogo = user.tenant_logo || null;
    if (user.role === 'super_admin') { tenantName = 'DigyGo CRM'; tenantLogo = null; }

    res.json({
      id: user.id, tenantId: user.tenant_id, email: user.email,
      name: user.name, role: user.role, avatarUrl: user.avatar_url,
      plan: user.tenant_plan ?? 'starter',
      tenant: { name: tenantName, logoUrl: tenantLogo },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/tenants — super admin creates a new tenant (#53 audit log)
router.post('/tenants', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    businessName: z.string().min(2),
    email: z.string().email(),
    adminName: z.string().min(1),
    password: z.string().min(4),
    plan: z.enum(['starter', 'growth', 'pro', 'enterprise']).default('starter'),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { businessName, email, adminName, password, plan, phone = null, address = null } = parsed.data;

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');

    const tenantRes = await conn.query(
      `INSERT INTO tenants (name, email, plan, phone, address) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [businessName, email.toLowerCase().trim(), plan, phone, address]
    );
    const tenantId = tenantRes.rows[0].id;

    await conn.query(`INSERT INTO company_settings (tenant_id, legal_name) VALUES ($1,$2)`, [tenantId, businessName]);

    const pipelineRes = await conn.query(
      `INSERT INTO pipelines (tenant_id, name, is_default) VALUES ($1,'Sales Pipeline',TRUE) RETURNING id`,
      [tenantId]
    );
    const pipelineId = pipelineRes.rows[0].id;

    for (const [i, name] of ['New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'].entries()) {
      await conn.query(
        `INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, stage_order, is_closed_won, is_closed_lost)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, pipelineId, name, i, name === 'Won', name === 'Lost']
      );
    }

    const hash = await bcrypt.hash(password, 10);
    await conn.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role, is_owner)
       VALUES ($1,$2,$3,$4,'owner',TRUE)`,
      [tenantId, email.toLowerCase().trim(), hash, adminName]
    );

    const adminPerms: Record<string, boolean> = {
      'leads:view_all': true, 'leads:view_own': true, 'leads:create': true,
      'leads:edit': true, 'leads:delete': true, 'leads:export': true,
      'leads:import': true, 'leads:assign': true, 'pipeline:manage': true,
      'automation:view': true, 'automation:manage': true,
      'inbox:view_all': true, 'inbox:view_own': true, 'inbox:send': true,
      'calendar:view_all': true, 'calendar:manage': true,
      'staff:view': true, 'staff:manage': true, 'settings:manage': true, 'reports:view': true,
    };
    const staffPerms: Record<string, boolean> = {
      'leads:view_own': true, 'leads:create': true, 'leads:edit': true,
      'inbox:view_own': true, 'inbox:send': true, 'calendar:manage': true,
    };
    await conn.query(
      `INSERT INTO role_permissions (tenant_id, role, permissions) VALUES ($1,'admin',$2),($1,'staff',$3)
       ON CONFLICT (tenant_id, role) DO UPDATE SET permissions=EXCLUDED.permissions`,
      [tenantId, JSON.stringify(adminPerms), JSON.stringify(staffPerms)]
    );

    // Seed tenant_usage row
    await conn.query(
      `INSERT INTO tenant_usage (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    );

    await conn.query('COMMIT');

    // Audit log (non-blocking, after commit) (#53)
    auditLog(req.user!.userId, 'create_tenant', {
      tenantId,
      metadata: { businessName, plan, email: email.toLowerCase().trim() },
      ip: req.ip,
    });

    res.status(201).json({
      message: 'Tenant created',
      tenantId,
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

// POST /api/auth/setup-password — accept invite and set password (#58 single-use)
router.post('/setup-password', async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) {
    res.status(400).json({ error: 'Valid token and password (min 6 chars) required' }); return;
  }
  try {
    // Enforce single-use: token must exist AND password not yet set
    const result = await query(
      `SELECT id, tenant_id, role, invite_expires_at
       FROM users WHERE invite_token=$1 AND password_set=FALSE`,
      [token]
    );
    const user = result.rows[0];
    if (!user) { res.status(404).json({ error: 'Invalid or expired invite token' }); return; }
    if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
      res.status(410).json({ error: 'Invite link has expired' }); return;
    }
    const hash = await bcrypt.hash(password, 10);
    // Clear invite_token atomically — prevents replay even under race conditions
    const updated = await query(
      `UPDATE users
         SET password_hash=$1, invite_token=NULL, invite_expires_at=NULL, password_set=TRUE
       WHERE id=$2 AND invite_token=$3 AND password_set=FALSE
       RETURNING id`,
      [hash, user.id, token]
    );
    if (!updated.rows[0]) {
      res.status(410).json({ error: 'Invite already used' }); return;
    }
    const accessToken = issueAccessToken(user.id, user.tenant_id, user.role);
    res.json({ token: accessToken, message: 'Password set successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/tenants — super admin lists tenants
router.get('/tenants', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const showDeleted = req.query.deleted === 'true';
  try {
    const result = await query(`
      SELECT
        t.id, t.name, t.email, t.plan, t.is_active,
        t.subscription_status, t.subscription_expires_at,
        t.phone, t.address, t.created_at,
        COUNT(DISTINCT u.id) FILTER (WHERE u.is_active=TRUE) AS user_count,
        COUNT(DISTINCT l.id) AS lead_count,
        (SELECT au.name  FROM users au WHERE au.tenant_id=t.id AND au.role='owner' AND au.is_active=TRUE LIMIT 1) AS admin_name,
        (SELECT au.email FROM users au WHERE au.tenant_id=t.id AND au.role='owner' AND au.is_active=TRUE LIMIT 1) AS admin_email,
        (SELECT au.last_login_at FROM users au WHERE au.tenant_id=t.id AND au.role='owner' AND au.is_active=TRUE ORDER BY au.last_login_at DESC NULLS LAST LIMIT 1) AS last_login_at
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id=t.id
      LEFT JOIN leads l ON l.tenant_id=t.id AND l.is_deleted=FALSE
      WHERE t.is_active=$1
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [!showDeleted]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/auth/tenants/:id
router.patch('/tenants/:id', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const { name, plan, subscription_status, subscription_expires_at, phone, address } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined)                    { params.push(name);                    updates.push(`name=$${params.length}`); }
  if (plan !== undefined)                    { params.push(plan);                    updates.push(`plan=$${params.length}`); }
  if (subscription_status !== undefined)     { params.push(subscription_status);     updates.push(`subscription_status=$${params.length}`); }
  if (subscription_expires_at !== undefined) { params.push(subscription_expires_at); updates.push(`subscription_expires_at=$${params.length}`); }
  if (phone !== undefined)                   { params.push(phone);                   updates.push(`phone=$${params.length}`); }
  if (address !== undefined)                 { params.push(address);                 updates.push(`address=$${params.length}`); }
  if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
  params.push(req.params.id);
  try {
    await query(`UPDATE tenants SET ${updates.join(',')} WHERE id=$${params.length}`, params);
    invalidateTenantCache(req.params.id); // immediately reflect plan/status change
    auditLog(req.user!.userId, 'update_tenant', {
      tenantId: req.params.id, metadata: req.body, ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/auth/tenants/:id — soft-deactivate + revoke all sessions (#54 / #55)
router.delete('/tenants/:id', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await query(`UPDATE tenants SET is_active=FALSE WHERE id=$1`, [req.params.id]);
    // Deactivate users AND wipe refresh tokens so sessions die immediately
    await query(
      `UPDATE users
         SET is_active=FALSE, refresh_token_hash=NULL, refresh_token_prefix=NULL
       WHERE tenant_id=$1`,
      [req.params.id]
    );
    invalidateTenantCache(req.params.id); // flush cache so next request is rejected
    auditLog(req.user!.userId, 'deactivate_tenant', { tenantId: req.params.id, ip: req.ip });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/tenants/:id/restore
router.post('/tenants/:id/restore', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await query(`UPDATE tenants SET is_active=TRUE WHERE id=$1`, [req.params.id]);
    await query(`UPDATE users SET is_active=TRUE WHERE tenant_id=$1 AND role='owner'`, [req.params.id]);
    invalidateTenantCache(req.params.id);
    auditLog(req.user!.userId, 'restore_tenant', { tenantId: req.params.id, ip: req.ip });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/tenants/:id/impersonate (#43 is_active check / #53 audit log)
router.post('/tenants/:id/impersonate', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Refuse to impersonate a suspended tenant (#43)
    const tenantRes = await query(
      `SELECT is_active, plan FROM tenants WHERE id=$1`,
      [req.params.id]
    );
    if (!tenantRes.rows[0]) {
      res.status(404).json({ error: 'Tenant not found' }); return;
    }
    if (!tenantRes.rows[0].is_active) {
      res.status(403).json({ error: 'Cannot impersonate a suspended tenant' }); return;
    }

    const result = await query(
      `SELECT id, tenant_id, email, name, role FROM users
       WHERE tenant_id=$1 AND role='owner' AND is_active=TRUE LIMIT 1`,
      [req.params.id]
    );
    const target = result.rows[0];
    if (!target) { res.status(404).json({ error: 'No active owner user for this tenant' }); return; }

    const plan  = tenantRes.rows[0].plan ?? 'starter';
    const token = issueAccessToken(target.id, target.tenant_id, target.role, plan);

    auditLog(req.user!.userId, 'impersonate', {
      tenantId: req.params.id,
      userId: target.id,
      metadata: { target_email: target.email },
      ip: req.ip,
    });

    res.json({
      token,
      user: { id: target.id, email: target.email, name: target.name, role: target.role, tenantId: target.tenant_id },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/auth/audit-log
router.get('/audit-log', requireAuth, requireSuperAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT al.*, t.name AS tenant_name
      FROM audit_log al
      LEFT JOIN tenants t ON t.id = al.target_tenant_id
      ORDER BY al.created_at DESC LIMIT 200
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
