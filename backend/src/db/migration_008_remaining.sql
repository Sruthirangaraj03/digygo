-- Sprint 8: WebSocket, invite tokens, round-robin, per-lead fields, booking links

-- Round-robin counter on tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rr_index INTEGER DEFAULT 0;

-- Invite tokens for staff email invites
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token    VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set    BOOLEAN DEFAULT TRUE;

-- Per-lead custom field values
CREATE TABLE IF NOT EXISTS lead_field_values (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  field_id     UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, field_id)
);
CREATE INDEX IF NOT EXISTS lead_field_values_lead_idx   ON lead_field_values(lead_id);
CREATE INDEX IF NOT EXISTS lead_field_values_tenant_idx ON lead_field_values(tenant_id);

-- Booking links for calendar
CREATE TABLE IF NOT EXISTS booking_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  duration_mins   INTEGER NOT NULL DEFAULT 30,
  buffer_mins     INTEGER NOT NULL DEFAULT 0,
  max_per_day     INTEGER,
  location        TEXT,
  description     TEXT,
  availability    JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS booking_links_tenant_idx ON booking_links(tenant_id);
CREATE INDEX IF NOT EXISTS booking_links_slug_idx   ON booking_links(slug);
