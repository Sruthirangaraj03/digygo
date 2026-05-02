-- Tracks per-workflow per-node assignment counts for true round-robin distribution.
-- Used by assign_staff action when split_traffic = 'evenly'.
CREATE TABLE IF NOT EXISTS workflow_staff_counters (
  workflow_id  UUID   NOT NULL,
  node_id      TEXT   NOT NULL,
  staff_id     UUID   NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  UNIQUE(workflow_id, node_id, staff_id)
);
CREATE INDEX IF NOT EXISTS idx_wsc_wf_node ON workflow_staff_counters(workflow_id, node_id);
