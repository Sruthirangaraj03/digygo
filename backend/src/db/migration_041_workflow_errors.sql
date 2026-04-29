-- Extend status column so 'completed_with_errors' (21 chars) fits
ALTER TABLE workflow_executions ALTER COLUMN status TYPE VARCHAR(30);

-- Track runs that completed but had at least one failed step
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS completed_with_errors INTEGER NOT NULL DEFAULT 0;

-- Backfill: any past execution marked 'completed' that has a failed step
-- gets re-classified as 'completed_with_errors' so history is accurate
UPDATE workflow_executions we
SET status = 'completed_with_errors'
WHERE we.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM workflow_execution_logs wel
    WHERE wel.execution_id = we.id
      AND wel.status = 'failed'
  );

-- Sync the denormalised counter on workflows rows to match the backfill
UPDATE workflows w
SET completed_with_errors = sub.cnt,
    completed             = GREATEST(0, w.completed - sub.cnt)
FROM (
  SELECT workflow_id, COUNT(*) AS cnt
  FROM workflow_executions
  WHERE status = 'completed_with_errors'
  GROUP BY workflow_id
) sub
WHERE sub.workflow_id = w.id;
