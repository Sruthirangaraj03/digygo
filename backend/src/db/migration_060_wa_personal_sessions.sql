-- Migration 060: WhatsApp Personal (QR-based) session tracking and stats
CREATE TABLE IF NOT EXISTS wa_personal_sessions (
  tenant_id    UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'disconnected',
  phone_number VARCHAR(30),
  connected_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_personal_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_sent     INT NOT NULL DEFAULT 0,
  messages_received INT NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_wa_stats_tenant_date ON wa_personal_stats(tenant_id, date);
