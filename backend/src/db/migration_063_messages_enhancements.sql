-- migration_063: Add message enhancement columns for full WA inbox parity
-- is_deleted: message revocation (WA "Delete for everyone")
-- media_url:  local path to downloaded media file
-- remote_jid: WA JID of the other party (needed for blue-tick read receipts)

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url   TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS remote_jid  VARCHAR(100);
