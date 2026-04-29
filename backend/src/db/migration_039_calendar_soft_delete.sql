-- Migration 039: Soft-delete for calendar events
-- Hard-deleting events loses audit trail and breaks lead history
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_calendar_events_not_deleted ON calendar_events (tenant_id, is_deleted) WHERE is_deleted = FALSE;
