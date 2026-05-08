-- Ensure step_index column exists and is nullable (schema drift fix)
ALTER TABLE scheduled_workflow_steps ADD COLUMN IF NOT EXISTS step_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scheduled_workflow_steps ALTER COLUMN step_index SET DEFAULT 0;
ALTER TABLE scheduled_workflow_steps ALTER COLUMN lead_id DROP NOT NULL;
