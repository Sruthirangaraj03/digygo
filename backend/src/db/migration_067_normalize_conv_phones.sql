-- migration_067: Normalize all conversation phone numbers to include country code
-- Merges duplicate conversations created by the phone format mismatch bug.

-- Step 1: Normalize phones that are 10 digits (missing country code 91)
UPDATE conversations
SET phone = '91' || phone
WHERE channel = 'personal_wa'
  AND lead_id IS NULL
  AND phone IS NOT NULL
  AND phone != ''
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 10
  AND LEFT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 2) != '91';

-- Step 2: Merge duplicate anonymous conversations with same last-10-digit phone
-- Keep the one with more messages (or older one), move messages from the newer duplicate
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT
      MIN(id) AS keep_id,
      MAX(id) AS drop_id,
      RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) AS last10
    FROM conversations
    WHERE channel = 'personal_wa' AND lead_id IS NULL AND phone IS NOT NULL
    GROUP BY RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10), tenant_id
    HAVING COUNT(*) > 1
  LOOP
    -- Move messages from duplicate to canonical conversation
    UPDATE messages SET conversation_id = dup.keep_id WHERE conversation_id = dup.drop_id;
    -- Delete the duplicate
    DELETE FROM conversations WHERE id = dup.drop_id;
  END LOOP;
END $$;
