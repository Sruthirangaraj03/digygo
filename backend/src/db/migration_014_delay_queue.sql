-- Delay queue for time-delayed workflow steps
CREATE TABLE IF NOT EXISTS scheduled_workflow_steps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   UUID        NOT NULL,
  execution_id  UUID        NOT NULL,
  tenant_id     UUID        NOT NULL,
  lead_data     JSONB       NOT NULL DEFAULT '{}',
  remaining_nodes JSONB     NOT NULL DEFAULT '[]',
  run_at        TIMESTAMPTZ NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending',
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sws_run_at_pending
  ON scheduled_workflow_steps(run_at)
  WHERE status = 'pending';

-- Workflow versions table (Task #12)
CREATE TABLE IF NOT EXISTS workflow_versions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID        NOT NULL,
  tenant_id   UUID        NOT NULL,
  version     INTEGER     NOT NULL DEFAULT 1,
  name        TEXT        NOT NULL,
  nodes       JSONB       NOT NULL DEFAULT '[]',
  saved_by    UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow
  ON workflow_versions(workflow_id, version DESC);

-- Contact workflow history (Task #14) - executions already exist, just add lead_id index
CREATE INDEX IF NOT EXISTS idx_wf_exec_lead_id
  ON workflow_executions(lead_id)
  WHERE lead_id IS NOT NULL;

-- Goal / auto-exit column on workflows (Task #8)
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS goal_trigger    TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS goal_field      TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS goal_operator   TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS goal_value      TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS max_contacts    INTEGER;
