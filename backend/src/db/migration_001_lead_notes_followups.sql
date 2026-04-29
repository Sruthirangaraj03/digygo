-- Migration 001: Add lead_notes, lead_followups, lead_activities tables
-- Run: psql -U digygo_user -d digygocrm -f src/db/migration_001_lead_notes_followups.sql

CREATE TABLE IF NOT EXISTS lead_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID         NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       VARCHAR(255),
  content     TEXT         NOT NULL,
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_followups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID         NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  due_at       TIMESTAMPTZ  NOT NULL,
  completed    BOOLEAN      NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  assigned_to  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID         NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type        VARCHAR(50)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  detail      TEXT,
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead     ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead ON lead_followups(lead_id, completed);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);
