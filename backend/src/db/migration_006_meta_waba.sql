-- Meta (Facebook) OAuth integration storage
CREATE TABLE IF NOT EXISTS meta_integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,           -- AES-256 encrypted
  token_expiry  TIMESTAMPTZ,
  page_ids      JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meta lead-gen forms linked to tenant pages
CREATE TABLE IF NOT EXISTS meta_forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id     VARCHAR(100) NOT NULL,
  page_name   VARCHAR(255) NOT NULL DEFAULT '',
  form_id     VARCHAR(100) NOT NULL,
  form_name   VARCHAR(255) NOT NULL DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  leads_count INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  pipeline_id UUID REFERENCES pipelines(id),
  stage_id    UUID REFERENCES pipeline_stages(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, form_id)
);

-- WhatsApp Business Account integration
CREATE TABLE IF NOT EXISTS waba_integrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number      VARCHAR(50)  NOT NULL DEFAULT '',
  phone_number_id   VARCHAR(100) NOT NULL,
  waba_id           VARCHAR(100) NOT NULL,
  access_token      TEXT NOT NULL,       -- AES-256 encrypted
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations (WhatsApp / other channels)
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel         VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  status          VARCHAR(50) NOT NULL DEFAULT 'open',
  unread_count    INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  direction       VARCHAR(20) NOT NULL DEFAULT 'inbound', -- inbound | outbound
  content         TEXT NOT NULL DEFAULT '',
  wamid           VARCHAR(255),                           -- Meta message ID (dedup)
  type            VARCHAR(50) NOT NULL DEFAULT 'text',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add source_ref to leads for meta form tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_ref VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_meta_forms_tenant     ON meta_forms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead    ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_wamid        ON messages(wamid) WHERE wamid IS NOT NULL;
