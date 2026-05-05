-- Add is_won flag to pipeline_stages so owners can designate a "Won" stage per pipeline.
-- Conversion rate = leads in a won stage / total leads.
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_won BOOLEAN NOT NULL DEFAULT FALSE;
