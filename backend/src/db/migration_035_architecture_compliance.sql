-- ── Architecture compliance schema changes ────────────────────────────────────

-- 1. refresh_token_prefix: enables O(1) lookup and atomic race-safe rotation
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_prefix VARCHAR(16);
CREATE INDEX IF NOT EXISTS idx_users_rtoken_prefix
  ON users(refresh_token_prefix) WHERE refresh_token_prefix IS NOT NULL;

-- 2. Per-tenant email uniqueness
-- Drop old global unique constraint (try all common names, ignore errors)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_email;
-- Tenant users: unique (tenant_id, email) per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email
  ON users(tenant_id, lower(email)) WHERE tenant_id IS NOT NULL;
-- Super admin accounts (tenant_id IS NULL): still globally unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_global_email
  ON users(lower(email)) WHERE tenant_id IS NULL;

-- 3. tenant_usage: counters for plan limit enforcement
CREATE TABLE IF NOT EXISTS tenant_usage (
  tenant_id       UUID    PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  leads_count     INT     NOT NULL DEFAULT 0,
  contacts_count  INT     NOT NULL DEFAULT 0,
  staff_count     INT     NOT NULL DEFAULT 0,
  forms_count     INT     NOT NULL DEFAULT 0,
  workflows_count INT     NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed existing tenants into tenant_usage (safe to re-run)
INSERT INTO tenant_usage (tenant_id, leads_count, contacts_count, staff_count, forms_count, workflows_count)
SELECT
  t.id,
  COALESCE((SELECT COUNT(*) FROM leads     WHERE tenant_id=t.id AND is_deleted=FALSE), 0)::int,
  COALESCE((SELECT COUNT(*) FROM contacts  WHERE tenant_id=t.id), 0)::int,
  COALESCE((SELECT COUNT(*) FROM users     WHERE tenant_id=t.id AND is_active=TRUE), 0)::int,
  COALESCE((SELECT COUNT(*) FROM custom_forms WHERE tenant_id=t.id AND is_active=TRUE), 0)::int,
  0
FROM tenants t
WHERE t.is_active = TRUE
ON CONFLICT (tenant_id) DO NOTHING;

-- 4. audit_log: add ip_address column if missing
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
