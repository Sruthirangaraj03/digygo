-- Pincode → District → Pipeline routing table
-- Used by the "Pincode Routing" workflow node

CREATE TABLE IF NOT EXISTS pincode_district_map (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pincode     VARCHAR(20)  NOT NULL,
  district    VARCHAR(255) NOT NULL,
  state       VARCHAR(255),
  pipeline_name VARCHAR(255),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (tenant_id, pincode)
);

CREATE INDEX IF NOT EXISTS idx_pdm_tenant_pincode
  ON pincode_district_map (tenant_id, pincode);
