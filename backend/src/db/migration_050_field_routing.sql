-- Field Routing Sets: named, reusable mapping tables
-- Each set belongs to a tenant and matches a lead field value to a pipeline

CREATE TABLE IF NOT EXISTS field_routing_sets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  match_field VARCHAR(255) NOT NULL DEFAULT 'pincode',
  match_type  VARCHAR(50)  NOT NULL DEFAULT 'exact',
  row_count   INT          NOT NULL DEFAULT 0,
  times_used  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frs_tenant ON field_routing_sets(tenant_id);

-- Individual rows within a routing set
CREATE TABLE IF NOT EXISTS field_routing_rows (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id        UUID        NOT NULL REFERENCES field_routing_sets(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  match_value   VARCHAR(500) NOT NULL,
  pipeline_name VARCHAR(255),
  district      VARCHAR(255),
  state         VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique index so "Chennai" and "chennai" are the same row
CREATE UNIQUE INDEX IF NOT EXISTS uniq_frr_set_value
  ON field_routing_rows(set_id, lower(match_value));

CREATE INDEX IF NOT EXISTS idx_frr_tenant ON field_routing_rows(tenant_id);
