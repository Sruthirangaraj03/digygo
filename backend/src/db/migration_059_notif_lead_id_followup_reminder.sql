-- Migration 059: add lead_id to notifications, add reminder_sent to lead_followups
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notifs_lead ON notifications(lead_id) WHERE lead_id IS NOT NULL;
ALTER TABLE lead_followups ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_followups_reminder ON lead_followups(due_at) WHERE completed = FALSE AND reminder_sent = FALSE;
