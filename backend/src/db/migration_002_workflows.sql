-- Workflow automation tables

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'Untitled Automation',
  description TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  allow_reentry BOOLEAN NOT NULL DEFAULT false,
  nodes JSONB NOT NULL DEFAULT '[]',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  lead_name VARCHAR(255),
  trigger_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wf_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_exec_logs_execution ON workflow_execution_logs(execution_id);

GRANT ALL PRIVILEGES ON TABLE workflows TO digygo_user;
GRANT ALL PRIVILEGES ON TABLE workflow_executions TO digygo_user;
GRANT ALL PRIVILEGES ON TABLE workflow_execution_logs TO digygo_user;
