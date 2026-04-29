ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_form_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS leads_meta_form_id_idx ON leads(meta_form_id) WHERE meta_form_id IS NOT NULL;
