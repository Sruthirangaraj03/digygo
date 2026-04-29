-- Per-user permissions table (overrides role-level permissions for individual staff)
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_tenant ON user_permissions (tenant_id);
