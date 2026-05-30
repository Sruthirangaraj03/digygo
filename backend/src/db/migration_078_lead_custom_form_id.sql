-- Store which custom form a lead came from (by ID, not name).
-- This makes the Lead Generation overview immune to form renames.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS custom_form_id UUID REFERENCES custom_forms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_custom_form_id
  ON leads(custom_form_id) WHERE custom_form_id IS NOT NULL;
