-- migration_068: Persistent LID → phone mapping for multi-device WhatsApp
-- WhatsApp multi-device contacts send messages with @lid JIDs instead of phone JIDs.
-- We persist the mapping so it survives server restarts.

CREATE TABLE IF NOT EXISTS wa_lid_phone_map (
  tenant_id    UUID  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lid_digits   TEXT  NOT NULL,
  phone_digits TEXT  NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, lid_digits)
);

CREATE INDEX IF NOT EXISTS idx_wa_lid_phone_map_tenant ON wa_lid_phone_map(tenant_id);
