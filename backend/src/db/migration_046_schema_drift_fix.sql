-- Idempotent catch-all for columns that existed locally but were missed by earlier migrations.
-- Safe to run on any DB state — ADD COLUMN IF NOT EXISTS skips existing columns.

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS meeting_link   TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS guest_name     VARCHAR(255);
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_type_id  UUID REFERENCES event_types(id) ON DELETE SET NULL;

ALTER TABLE event_types ADD COLUMN IF NOT EXISTS date_overrides     JSONB         DEFAULT '{}';
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS meeting_link       TEXT;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS redirect_url       TEXT;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS date_range_start   DATE;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS date_range_end     DATE;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS max_per_day        INTEGER;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS min_notice_value   INTEGER       DEFAULT 0;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS min_notice_unit    TEXT          DEFAULT 'hours';
