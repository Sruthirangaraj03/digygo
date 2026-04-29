ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_ref VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_leads_source_ref ON leads(tenant_id, source, source_ref) WHERE source IS NOT NULL;
