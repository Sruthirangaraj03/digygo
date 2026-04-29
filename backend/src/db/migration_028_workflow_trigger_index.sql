-- Denormalised trigger metadata — lets triggerWorkflows query ONLY matching workflows
-- instead of fetching all active workflows and filtering in Node.js.

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS trigger_key   TEXT    DEFAULT '';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS trigger_forms TEXT[]  DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_workflows_trigger_key
  ON workflows (tenant_id, status, trigger_key);

-- Backfill: extract trigger node actionType and forms from JSONB nodes
UPDATE workflows
SET
  trigger_key = COALESCE(
    (SELECT node->>'actionType'
     FROM jsonb_array_elements(nodes) AS node
     WHERE node->>'type' = 'trigger'
     LIMIT 1),
    ''
  ),
  trigger_forms = COALESCE(
    ARRAY(
      SELECT jsonb_array_elements_text(
        (SELECT node->'config'->'forms'
         FROM jsonb_array_elements(nodes) AS node
         WHERE node->>'type' = 'trigger'
           AND jsonb_typeof(node->'config'->'forms') = 'array'
         LIMIT 1)
      )
    ),
    '{}'
  )
WHERE nodes IS NOT NULL AND jsonb_array_length(nodes) > 0;
