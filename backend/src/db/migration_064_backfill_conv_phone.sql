-- migration_064: Backfill conversations.phone for old anonymous personal_wa conversations
-- When the WA session reconnects, Baileys history-syncs messages that now carry remote_jid.
-- Use those to recover the phone for conversations that were created before migration_062
-- added the phone column.

-- Step 1: Backfill conversations.phone from the remote_jid stored on any message in that conv
UPDATE conversations c
SET phone = SPLIT_PART(m.remote_jid, '@', 1)
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    remote_jid
  FROM messages
  WHERE remote_jid IS NOT NULL
    AND remote_jid LIKE '%@s.whatsapp.net'
  ORDER BY conversation_id, created_at ASC
) m
WHERE c.id = m.conversation_id
  AND c.lead_id IS NULL
  AND c.channel = 'personal_wa'
  AND (c.phone IS NULL OR c.phone = '');

-- Step 2: Fix conversations.last_message that still has the old placeholder values
-- Replace with the actual latest message body for those conversations
UPDATE conversations c
SET last_message = latest.body
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    body
  FROM messages
  ORDER BY conversation_id, created_at DESC
) latest
WHERE c.id = latest.conversation_id
  AND c.last_message IN ('[Media message]', '[Image]', '[Video]', '[Audio]', '[Voice note]',
                         '[Document]', '[Sticker]', '[Location]', '[Contacts]');

-- Step 3: For lead-based conversations where lead_name was stored as the phone number,
-- try to find the actual name from the leads table (contacts.upsert may have updated it)
-- This is a no-op if names are already correct.
UPDATE conversations c
SET last_message = COALESCE(c.last_message, '')
WHERE c.last_message IS NULL;
