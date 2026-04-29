-- Add skipped and failed counters to workflows table
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS skipped INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS failed INTEGER NOT NULL DEFAULT 0;
