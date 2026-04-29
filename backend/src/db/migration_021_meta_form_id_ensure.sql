DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
    AND table_name = 'leads'
    AND column_name = 'meta_form_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN meta_form_id VARCHAR(64);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS leads_meta_form_id_idx ON leads(meta_form_id) WHERE meta_form_id IS NOT NULL;
