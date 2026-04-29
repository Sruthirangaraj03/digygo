-- Sprint 9: Assignment rules + notification preferences

CREATE TABLE IF NOT EXISTS assignment_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  method       VARCHAR(50)  NOT NULL DEFAULT 'source',
  condition    VARCHAR(255),
  assign_to    UUID REFERENCES users(id) ON DELETE SET NULL,
  sort_order   INTEGER DEFAULT 0,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assignment_rules_tenant_idx ON assignment_rules(tenant_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS integration_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id   VARCHAR(100) NOT NULL,
  config_json      JSONB DEFAULT '{}',
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, integration_id)
);
CREATE INDEX IF NOT EXISTS integration_configs_tenant_idx ON integration_configs(tenant_id);
