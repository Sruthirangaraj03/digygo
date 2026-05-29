-- ── Superfone Integration ────────────────────────────────────────────────────

-- Per-tenant Superfone connection config
CREATE TABLE IF NOT EXISTS superfone_settings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key_enc            TEXT,            -- encrypted API key for CRM → Superfone calls
  superfone_endpoint_url TEXT,            -- Superfone's webhook URL to push leads
  superfone_number       VARCHAR(50),     -- business phone (e.g. +919429694726)
  is_connected           BOOLEAN NOT NULL DEFAULT FALSE,
  connected_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per call received from Superfone
CREATE TABLE IF NOT EXISTS call_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id               UUID REFERENCES leads(id) ON DELETE SET NULL,
  cdr_id                BIGINT NOT NULL,
  direction             VARCHAR(20) NOT NULL,    -- INBOUND / OUTBOUND
  outcome               VARCHAR(50) NOT NULL,    -- ANSWERED / MISSED / IVR_TIMEOUT / BUSY
  caller_phone          VARCHAR(50),
  superfone_number      VARCHAR(50),
  duration_seconds      INTEGER,
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  staff_phone           VARCHAR(50),
  staff_name            VARCHAR(255),
  staff_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  ivr_inputs            JSONB NOT NULL DEFAULT '[]',
  recording_url         TEXT,
  recording_path        TEXT,
  recording_downloaded  BOOLEAN NOT NULL DEFAULT FALSE,
  is_unknown            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate calls from same tenant
CREATE UNIQUE INDEX IF NOT EXISTS call_logs_tenant_cdr_idx
  ON call_logs(tenant_id, cdr_id);

CREATE INDEX IF NOT EXISTS call_logs_lead_id_idx
  ON call_logs(lead_id);

CREATE INDEX IF NOT EXISTS call_logs_tenant_created_idx
  ON call_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS call_logs_unknown_idx
  ON call_logs(tenant_id, is_unknown) WHERE is_unknown = TRUE;

-- Phone field on users for staff matching with Superfone
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
