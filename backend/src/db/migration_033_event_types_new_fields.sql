-- Gap fix: add missing fields to event_types
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS meeting_link     TEXT;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS redirect_url     TEXT;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS date_range_start DATE;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS date_range_end   DATE;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS max_per_day      INTEGER      DEFAULT 1;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS min_notice_value INTEGER      DEFAULT 2;
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS min_notice_unit  VARCHAR(20)  DEFAULT 'days';
