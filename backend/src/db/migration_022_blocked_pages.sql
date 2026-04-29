-- Add blocked_page_ids column to meta_integrations to track pages visible via
-- Business Manager but lacking a direct page access token
ALTER TABLE meta_integrations
  ADD COLUMN IF NOT EXISTS blocked_page_ids JSONB DEFAULT '{}'::JSONB;
