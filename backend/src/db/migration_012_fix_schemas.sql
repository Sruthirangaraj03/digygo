-- Migration 012: Fix schema conflicts and ensure all tables/columns exist

-- ── Fix booking_links: add columns used by the API if they don't exist ─────────
-- migration_003 created it with (user_id, title, duration_minutes, buffer_minutes)
-- migration_008 expects  (created_by, name, duration_mins, buffer_mins, max_per_day, ...)
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES users(id);
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS name            VARCHAR(255);
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS duration_mins   INTEGER NOT NULL DEFAULT 30;
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS buffer_mins     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS max_per_day     INTEGER;
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS location        TEXT;
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS availability    JSONB DEFAULT '{}';
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE booking_links ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

-- Back-fill name from title if needed
UPDATE booking_links SET name = title WHERE name IS NULL AND title IS NOT NULL;
UPDATE booking_links SET created_by = user_id WHERE created_by IS NULL AND user_id IS NOT NULL;

-- ── Fix role_permissions: migration_003 made it with role_id FK, we need tenant_id ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'role_permissions' AND column_name = 'tenant_id'
  ) THEN
    DROP TABLE IF EXISTS role_permissions CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role        VARCHAR(50) NOT NULL,
  permissions JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, role)
);

-- ── pipeline_questions (migration_007) ───────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS pipeline_questions_tenant_idx ON pipeline_questions(tenant_id);

-- ── custom_fields (migration_007) ───────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS custom_fields_tenant_idx ON custom_fields(tenant_id);

-- ── value_tokens (migration_007) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS value_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  replace_with TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);
CREATE INDEX IF NOT EXISTS value_tokens_tenant_idx ON value_tokens(tenant_id);

-- ── custom_forms extra columns (migration_005) ───────────────────────────────────
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS slug               VARCHAR(255);
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS submit_label       VARCHAR(100) DEFAULT 'Submit';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS redirect_url       TEXT;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS thank_you_message  TEXT DEFAULT 'Thank you for your submission!';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS btn_color          VARCHAR(20) DEFAULT '#ea580c';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS btn_text_color     VARCHAR(20) DEFAULT '#ffffff';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS form_bg_color      VARCHAR(20) DEFAULT '#ffffff';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS form_text_color    VARCHAR(20) DEFAULT '#1c1410';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS declaration_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS declaration_title  TEXT;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS declaration_link   TEXT;

-- Back-fill slugs
UPDATE custom_forms
SET slug = REGEXP_REPLACE(LOWER(TRIM(name)), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_forms_tenant_slug ON custom_forms(tenant_id, slug);

-- ── calendar_events: add status column ──────────────────────────────────────────
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled';

-- ── lead_field_values (migration_008) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_field_values (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  field_id   UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, field_id)
);
CREATE INDEX IF NOT EXISTS lead_field_values_lead_idx   ON lead_field_values(lead_id);
CREATE INDEX IF NOT EXISTS lead_field_values_tenant_idx ON lead_field_values(tenant_id);

-- ── event_types (migration_010) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(100) NOT NULL,
  duration         INTEGER NOT NULL DEFAULT 30,
  description      TEXT,
  staff_type       VARCHAR(20) DEFAULT 'single',
  assignment_mode  VARCHAR(20) DEFAULT 'round-robin',
  staff_emails     JSONB DEFAULT '[]',
  meeting_type     VARCHAR(100) DEFAULT 'Google Meet',
  scheduling_type  VARCHAR(20) DEFAULT 'days',
  days_in_future   INTEGER DEFAULT 30,
  timezone         VARCHAR(100) DEFAULT 'Asia/Kolkata',
  schedule         JSONB DEFAULT '{}',
  buffer_time      INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  form_fields      JSONB DEFAULT '[]',
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS event_types_tenant_idx ON event_types(tenant_id);

-- ── landing_pages (migration_011) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS landing_pages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  template   VARCHAR(100) DEFAULT 'Lead Capture',
  status     VARCHAR(20)  NOT NULL DEFAULT 'draft',
  content    JSONB        DEFAULT '{}',
  views      INTEGER      NOT NULL DEFAULT 0,
  leads      INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- ── workflow_folders (migration_011) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_folders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  workflow_ids JSONB        NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── whatsapp_flows (migration_011) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_flows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  trigger       VARCHAR(100) NOT NULL DEFAULT 'keyword',
  trigger_value VARCHAR(255),
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  nodes         JSONB   NOT NULL DEFAULT '[]',
  root_node_id  VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── meta_integrations: ensure encrypted token column exists ─────────────────────
ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS access_token_enc TEXT;
ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS verify_token     VARCHAR(255);

-- ── meta_forms: add field_mapping for Meta Forms flow ───────────────────────────
ALTER TABLE meta_forms ADD COLUMN IF NOT EXISTS field_mapping JSONB DEFAULT '{}';

-- ── notification_preferences ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── users: ensure invite columns exist ──────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token       VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set       BOOLEAN DEFAULT TRUE;

-- ── tenants: rr_index ───────────────────────────────────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rr_index INTEGER DEFAULT 0;

-- ── leads: extra columns ─────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_deleted    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_converted  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- ── pipelines: extra columns ─────────────────────────────────────────────────────
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#94a3b8';

-- ── pipeline_stages: extra columns ───────────────────────────────────────────────
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS win_probability INTEGER DEFAULT 0;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_closed_won  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_closed_lost BOOLEAN NOT NULL DEFAULT false;

-- ── Grant privileges ─────────────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO digygo_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO digygo_user;
