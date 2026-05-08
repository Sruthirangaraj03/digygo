CREATE TABLE IF NOT EXISTS contact_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  color       TEXT        NOT NULL DEFAULT '#ea580c',
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_group_members (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID        NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  lead_id   UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  added_by  TEXT        NOT NULL DEFAULT 'manual',
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_groups_tenant ON contact_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cgm_group             ON contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_cgm_lead              ON contact_group_members(lead_id);
