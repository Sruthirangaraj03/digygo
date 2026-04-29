-- Landing pages table
CREATE TABLE IF NOT EXISTS landing_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  slug        VARCHAR(120) NOT NULL,
  template    VARCHAR(100) DEFAULT 'Lead Capture',
  status      VARCHAR(20)  NOT NULL DEFAULT 'draft',
  content     JSONB        DEFAULT '{}',
  views       INTEGER      NOT NULL DEFAULT 0,
  leads       INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- Role permissions table (per tenant, per role)
CREATE TABLE IF NOT EXISTS role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role        VARCHAR(50) NOT NULL,
  permissions JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, role)
);

-- Workflow folders table
CREATE TABLE IF NOT EXISTS workflow_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  workflow_ids JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- WhatsApp automation flows table
CREATE TABLE IF NOT EXISTS whatsapp_flows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  trigger      VARCHAR(100) NOT NULL DEFAULT 'keyword',
  trigger_value VARCHAR(255),
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  nodes        JSONB   NOT NULL DEFAULT '[]',
  root_node_id VARCHAR(100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
