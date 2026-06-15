-- Multi-pipeline support: a contact may exist once PER pipeline, not just once per tenant.
-- Replaces the (tenant_id, phone) uniqueness with (tenant_id, phone, pipeline_id). A null
-- pipeline is coalesced to a fixed sentinel so routing-based (null-pipeline) leads still
-- cannot duplicate. Safe on existing data: current rows are already unique per (tenant_id,
-- phone), so they automatically satisfy this looser rule and the index builds without conflict.
-- NOTE never put a semicolon inside a comment here -- migrate.ts splits on every semicolon.

DROP INDEX IF EXISTS idx_leads_unique_phone_per_tenant;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_phone_per_pipeline
  ON leads (tenant_id, phone, COALESCE(pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE phone IS NOT NULL AND phone <> '' AND is_deleted = FALSE;
