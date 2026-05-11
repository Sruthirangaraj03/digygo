-- migration_061: Add missing columns to conversations and messages tables
-- conversations.last_message was used in code but never added via migration
-- messages used sender/body/created_at in code but DB has direction/content/sent_at

-- ── conversations ──────────────────────────────────────────────────────────────
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_to  UUID REFERENCES users(id);

-- ── messages: add aliased columns alongside originals ─────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender     VARCHAR(20)  DEFAULT 'customer';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS body       TEXT         DEFAULT '';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ  DEFAULT NOW();

-- Backfill new columns from old ones where still null
UPDATE messages
SET
  sender     = CASE WHEN direction = 'outbound' THEN 'agent' ELSE 'customer' END,
  body       = COALESCE(content, ''),
  created_at = COALESCE(sent_at, NOW())
WHERE sender IS NULL OR body IS NULL OR created_at IS NULL;

-- ── Unique index on wamid for ON CONFLICT support ──────────────────────────────
-- The earlier idx_messages_wamid was a plain index; ON CONFLICT needs UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wamid_unique
  ON messages(wamid)
  WHERE wamid IS NOT NULL;
