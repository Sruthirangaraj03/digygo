-- migration_065: Add wa_account to conversations to separate multi-WA-session inboxes
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS wa_account VARCHAR(20);

-- Backfill existing personal_wa conversations with the current session's phone
-- (one session per tenant historically, so this is correct for existing data)
UPDATE conversations c
SET wa_account = (
  SELECT REPLACE(wps.phone_number, '+', '')
  FROM wa_personal_sessions wps
  WHERE wps.tenant_id = c.tenant_id
  LIMIT 1
)
WHERE c.channel = 'personal_wa' AND c.wa_account IS NULL;
