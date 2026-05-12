-- WhatsApp Personal message templates (used in workflow automation)
CREATE TABLE IF NOT EXISTS wa_personal_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  file_path   TEXT,
  file_type   VARCHAR(100),
  file_name   VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_personal_templates_tenant ON wa_personal_templates(tenant_id);
