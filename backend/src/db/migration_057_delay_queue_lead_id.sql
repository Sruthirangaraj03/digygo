-- Make lead_id nullable in scheduled_workflow_steps — test runs have no real UUID lead_id
ALTER TABLE scheduled_workflow_steps ALTER COLUMN lead_id DROP NOT NULL;
