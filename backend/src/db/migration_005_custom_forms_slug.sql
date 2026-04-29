ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS submit_label VARCHAR(100) DEFAULT 'Submit';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS redirect_url TEXT;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS thank_you_message TEXT DEFAULT 'Thank you for your submission!';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS btn_color VARCHAR(20) DEFAULT '#ea580c';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS btn_text_color VARCHAR(20) DEFAULT '#ffffff';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS form_bg_color VARCHAR(20) DEFAULT '#ffffff';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS form_text_color VARCHAR(20) DEFAULT '#1c1410';
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS declaration_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS declaration_title TEXT;
ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS declaration_link TEXT;

-- back-fill slugs for any existing rows
UPDATE custom_forms
SET slug = REGEXP_REPLACE(LOWER(TRIM(name)), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_forms_tenant_slug ON custom_forms(tenant_id, slug);
