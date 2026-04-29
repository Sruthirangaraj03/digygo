-- Cache form questions from Meta to avoid repeated API calls on Map Fields
ALTER TABLE meta_forms ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]';

-- Persist page names across OAuth sessions (safe if already added)
ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS page_names JSONB DEFAULT '{}';

-- Store Facebook→CRM field mapping per form (safe if already added)
ALTER TABLE meta_forms ADD COLUMN IF NOT EXISTS field_mapping JSONB;
