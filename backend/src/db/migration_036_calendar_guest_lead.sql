-- Add guest contact fields + lead link to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50);
