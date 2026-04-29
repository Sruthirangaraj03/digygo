-- Unify 'form_submitted' → 'opt_in_form' so all custom form workflows
-- use a single trigger key that matches what public.ts fires.

-- 1. Update trigger_key column
UPDATE workflows
SET trigger_key = 'opt_in_form'
WHERE trigger_key = 'form_submitted';

-- 2. Update actionType inside the nodes JSONB so the editor shows correctly
UPDATE workflows
SET nodes = (
  SELECT jsonb_agg(
    CASE
      WHEN node->>'type' = 'trigger' AND node->>'actionType' = 'form_submitted'
      THEN jsonb_set(node, '{actionType}', '"opt_in_form"')
      ELSE node
    END
  )
  FROM jsonb_array_elements(nodes) AS node
)
WHERE nodes IS NOT NULL
  AND jsonb_array_length(nodes) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(nodes) AS node
    WHERE node->>'type' = 'trigger' AND node->>'actionType' = 'form_submitted'
  );
