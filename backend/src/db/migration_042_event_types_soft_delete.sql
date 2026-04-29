-- Soft-delete for event_types so historical bookings keep their reference
ALTER TABLE event_types ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
