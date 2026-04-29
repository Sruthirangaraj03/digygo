import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db';

export interface AuthPayload {
  userId: string;
  tenantId: string | null;
  role: string;
  plan?: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// ── Tenant active cache: avoids a DB hit on every authenticated request ───────
// Entries expire in 30 s; calling invalidateTenantCache() evicts immediately.
const tenantActiveCache = new Map<string, { active: boolean; ts: number }>();
const TENANT_TTL_MS = 30_000;

export function invalidateTenantCache(tenantId: string): void {
  tenantActiveCache.delete(tenantId);
}

async function checkTenantActive(tenantId: string): Promise<boolean> {
  const cached = tenantActiveCache.get(tenantId);
  if (cached && Date.now() - cached.ts < TENANT_TTL_MS) return cached.active;
  try {
    const result = await query('SELECT is_active FROM tenants WHERE id = $1', [tenantId]);
    const active = result.rows[0]?.is_active === true;
    tenantActiveCache.set(tenantId, { active, ts: Date.now() });
    return active;
  } catch {
    return true; // fail open on DB error — don't lock out all users on transient issue
  }
}

// ── requireAuth ───────────────────────────────────────────────────────────────
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.user = payload;

    // For tenant-scoped users, verify the tenant is still active.
    // super_admin has tenantId=null — skip the check.
    if (payload.tenantId) {
      checkTenantActive(payload.tenantId)
        .then((active) => {
          if (!active) {
            res.status(403).json({ error: 'Account suspended. Please contact support.' });
          } else {
            next();
          }
        })
        .catch(() => next()); // fail open on transient DB error
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── requireTenant ─────────────────────────────────────────────────────────────
// Rejects requests from super_admin (tenantId=null) hitting tenant-scoped data
// routes directly. During impersonation the token already carries the tenant's
// userId/tenantId so this check is transparent to legitimate impersonation use.
export function requireTenant(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.tenantId) {
    res.status(403).json({ error: 'This endpoint requires a tenant context. Use impersonation to access tenant data.' });
    return;
  }
  next();
}

// ── requireSuperAdmin ─────────────────────────────────────────────────────────
export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }
  next();
}
