-- Sprint 7: Custom fields, pipeline questions, value tokens

CREATE TABLE IF NOT EXISTS custom_fields (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  type         VARCHAR(50)  NOT NULL,
  slug         VARCHAR(100) NOT NULL,
  placeholder  TEXT,
  options      JSONB,
  required     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS pipeline_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id  VARCHAR(255) NOT NULL DEFAULT 'all',
  question     TEXT NOT NULL,
  type         VARCHAR(50)  NOT NULL,
  slug         VARCHAR(100) NOT NULL,
  options      JSONB,
  required     BOOLEAN DEFAULT FALSE,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS value_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  replace_with TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS custom_fields_tenant_idx     ON custom_fields(tenant_id);
CREATE INDEX IF NOT EXISTS pipeline_questions_tenant_idx ON pipeline_questions(tenant_id);
CREATE INDEX IF NOT EXISTS value_tokens_tenant_idx       ON value_tokens(tenant_id);
