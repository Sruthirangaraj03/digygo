-- Add date_overrides column to event_types for specific-date availability overrides
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS date_overrides JSONB DEFAULT '{}';
