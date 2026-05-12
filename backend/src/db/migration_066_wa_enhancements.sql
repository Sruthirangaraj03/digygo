-- migration_066: WA inbox enhancements
-- 9a: wa_account on wa_personal_stats
ALTER TABLE wa_personal_stats ADD COLUMN IF NOT EXISTS wa_account VARCHAR(20);

-- 9b: Session history table
CREATE TABLE IF NOT EXISTS wa_session_history (
  id          SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone       VARCHAR(20) NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL,
  disconnected_at TIMESTAMPTZ,
  disconnect_reason VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_wa_session_history_tenant ON wa_session_history(tenant_id, connected_at DESC);

-- 9c: wa_account on messages (which session sent/received this message)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS wa_account VARCHAR(20);

-- 9d: Auto-create lead toggle (stored in tenant settings JSONB)
-- No schema change needed — will use tenant_settings JSONB key 'wa_auto_create_lead'
