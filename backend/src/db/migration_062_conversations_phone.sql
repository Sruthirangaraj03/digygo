-- migration_062: Add phone column to conversations for anonymous WA Personal thread deduplication
-- Without this, each inbound message from an unknown number creates a new orphaned conversation
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone) WHERE phone IS NOT NULL;
