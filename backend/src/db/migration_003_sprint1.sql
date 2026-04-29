-- DigyGo CRM — Sprint 1 Migration
-- Auth sessions, soft delete, tags, conversations, core tables

-- ── Users: auth session columns ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- ── Leads: soft delete + scoring ──────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_converted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- ── Custom Forms: public URL + analytics ──────────────────────────────────────
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS redirect_url TEXT;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS thank_you_message TEXT;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- ── Pipelines: extra metadata ─────────────────────────────────────────────────
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#94a3b8';

-- ── Pipeline Stages: win probability + closed flags ───────────────────────────
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS win_probability INTEGER DEFAULT 0;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_closed_won BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_closed_lost BOOLEAN NOT NULL DEFAULT false;

-- ── Tags (relational, replaces TEXT[]) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7) NOT NULL DEFAULT '#94a3b8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);

-- ── Lead Tags junction ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lead_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_lead_tags_lead ON lead_tags(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag  ON lead_tags(tag_id);

-- ── Conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  channel         VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  assigned_to     UUID REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  unread_count    INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant   ON conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_lead     ON conversations(lead_id);

-- ── Messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  direction       VARCHAR(10) NOT NULL DEFAULT 'inbound',
  content         TEXT,
  type            VARCHAR(50) NOT NULL DEFAULT 'text',
  status          VARCHAR(20) NOT NULL DEFAULT 'sent',
  wamid           VARCHAR(255),
  is_note         BOOLEAN NOT NULL DEFAULT false,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sent_at DESC);

-- ── Templates ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  category   VARCHAR(50) NOT NULL DEFAULT 'UTILITY',
  language   VARCHAR(10) NOT NULL DEFAULT 'en',
  status     VARCHAR(20) NOT NULL DEFAULT 'approved',
  body       TEXT NOT NULL,
  header     TEXT,
  footer     TEXT,
  buttons    JSONB,
  variables  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON templates(tenant_id);

-- ── Meta Integrations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  page_ids     JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Meta Forms ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id     VARCHAR(255) NOT NULL,
  page_name   VARCHAR(255),
  form_id     VARCHAR(255) NOT NULL,
  form_name   VARCHAR(255),
  pipeline_id UUID REFERENCES pipelines(id),
  stage_id    UUID REFERENCES pipeline_stages(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  leads_count INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meta_forms_tenant ON meta_forms(tenant_id);

-- ── WABA Integrations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waba_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id VARCHAR(255) NOT NULL,
  waba_id         VARCHAR(255) NOT NULL,
  access_token    TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Opportunities ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id            UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title              VARCHAR(255) NOT NULL,
  value              DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency           VARCHAR(3) NOT NULL DEFAULT 'INR',
  pipeline_id        UUID REFERENCES pipelines(id),
  stage_id           UUID REFERENCES pipeline_stages(id),
  expected_close_date DATE,
  probability        INTEGER DEFAULT 0,
  status             VARCHAR(20) NOT NULL DEFAULT 'open',
  lost_reason        TEXT,
  assigned_to        UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant ON opportunities(tenant_id, lead_id);

-- ── Booking Links ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id),
  title            VARCHAR(255) NOT NULL,
  slug             VARCHAR(100) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_minutes   INTEGER NOT NULL DEFAULT 0,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- ── Availability Slots ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  timezone    VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  is_active   BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_availability_user ON availability_slots(user_id);

-- ── RBAC ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key VARCHAR(100) NOT NULL,
  UNIQUE(role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user  ON user_roles(user_id);

-- ── Performance indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_deleted    ON leads(tenant_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_leads_stage      ON leads(tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned   ON leads(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created    ON leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source     ON leads(tenant_id, source);

-- ── Grant permissions ─────────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO digygo_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO digygo_user;
