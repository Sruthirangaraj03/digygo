ALTER TABLE workflows ADD COLUMN IF NOT EXISTS api_token UUID DEFAULT gen_random_uuid();
UPDATE workflows SET api_token = gen_random_uuid() WHERE api_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workflows_api_token ON workflows(api_token);
