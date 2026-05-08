-- Ensure scheduled_workflow_steps has all required columns
-- Table may have been created before lead_data/remaining_nodes columns were added to the migration
ALTER TABLE scheduled_workflow_steps ADD COLUMN IF NOT EXISTS lead_data       JSONB NOT NULL DEFAULT '{}';
ALTER TABLE scheduled_workflow_steps ADD COLUMN IF NOT EXISTS remaining_nodes JSONB NOT NULL DEFAULT '[]';
ALTER TABLE scheduled_workflow_steps ADD COLUMN IF NOT EXISTS status          TEXT  NOT NULL DEFAULT 'pending';
ALTER TABLE scheduled_workflow_steps ADD COLUMN IF NOT EXISTS error           TEXT;
ALTER TABLE scheduled_workflow_steps ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();
