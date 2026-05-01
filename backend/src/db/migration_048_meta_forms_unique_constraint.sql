-- Fix: meta_forms was missing UNIQUE(tenant_id, form_id) constraint.
-- The constraint was defined inline in CREATE TABLE IF NOT EXISTS in migration_006,
-- but since the table already existed at deployment time, the entire CREATE TABLE
-- was a no-op and the constraint was never created. This caused every syncPageForms
-- call to fail with "no unique or exclusion constraint matching the ON CONFLICT spec",
-- silently writing zero forms to the DB for all connected pages.
--
-- Pattern rule: never define constraints inside CREATE TABLE IF NOT EXISTS.
-- Always add them as separate idempotent ALTER TABLE statements (this file is the template).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meta_forms_tenant_form_unique'
    AND conrelid = 'meta_forms'::regclass
  ) THEN
    ALTER TABLE meta_forms ADD CONSTRAINT meta_forms_tenant_form_unique UNIQUE (tenant_id, form_id);
  END IF;
END $$;

-- Also ensure page_names and blocked_page_ids columns exist on meta_integrations
-- (added later but also defined inline in CREATE TABLE in migration_006 era).
ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS page_names JSONB NOT NULL DEFAULT '{}';
ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS blocked_page_ids JSONB NOT NULL DEFAULT '{}';
ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS verify_token TEXT;
ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS access_token_enc TEXT;
