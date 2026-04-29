-- Gap fix: add status, meeting_link, guest_name to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS status       VARCHAR(50)  NOT NULL DEFAULT 'scheduled';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS meeting_link TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS guest_name   VARCHAR(255);
