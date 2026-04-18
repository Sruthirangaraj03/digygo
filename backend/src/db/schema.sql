-- DigyGo CRM — PostgreSQL Schema
-- Run: psql -U digygo_user -d digygocrm -f src/db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenants (each business using DigyGo CRM) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  plan        VARCHAR(50)  NOT NULL DEFAULT 'starter',
  logo_url    TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         REFERENCES tenants(id) ON DELETE CASCADE,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'staff',
  -- roles: super_admin | admin | manager | staff
  avatar_url    TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Company Settings (one row per tenant) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legal_name  VARCHAR(255),
  website     VARCHAR(255),
  phone       VARCHAR(50),
  address     TEXT,
  industry    VARCHAR(100),
  timezone    VARCHAR(100) DEFAULT 'Asia/Kolkata',
  currency    VARCHAR(20)  DEFAULT 'INR',
  date_format VARCHAR(20)  DEFAULT 'DD/MM/YYYY',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Pipelines ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipelines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Pipeline Stages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID         NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  stage_order INTEGER      NOT NULL DEFAULT 0,
  color       VARCHAR(50),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Leads ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(50),
  source      VARCHAR(100),
  pipeline_id UUID         REFERENCES pipelines(id),
  stage_id    UUID         REFERENCES pipeline_stages(id),
  assigned_to UUID         REFERENCES users(id),
  notes       TEXT,
  status      VARCHAR(50)  NOT NULL DEFAULT 'new',
  tags        TEXT[]       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Contacts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255),
  phone      VARCHAR(50),
  company    VARCHAR(255),
  lead_id    UUID         REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Custom Forms ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  fields      JSONB        NOT NULL DEFAULT '[]',
  pipeline_id UUID         REFERENCES pipelines(id),
  stage_id    UUID         REFERENCES pipeline_stages(id),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Form Submissions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      UUID        NOT NULL REFERENCES custom_forms(id) ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data         JSONB       NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Calendar Events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  start_time  TIMESTAMPTZ  NOT NULL,
  end_time    TIMESTAMPTZ  NOT NULL,
  type        VARCHAR(50)  NOT NULL DEFAULT 'meeting',
  lead_id     UUID         REFERENCES leads(id) ON DELETE SET NULL,
  assigned_to UUID         REFERENCES users(id),
  created_by  UUID         REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID         REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  message    TEXT,
  type       VARCHAR(50)  NOT NULL DEFAULT 'info',
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_tenant        ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage         ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned      ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant     ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant       ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_time         ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_notifs_user         ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_submissions_form    ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant        ON users(tenant_id);
