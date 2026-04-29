-- migration_023: Fix waba_integrations schema mismatch
-- migration_003 created the table with old columns (status, no phone_number/is_active/updated_at)
-- migration_006 tried CREATE TABLE IF NOT EXISTS which was silently skipped
-- This migration adds the missing columns so the backend code works correctly

ALTER TABLE waba_integrations ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE waba_integrations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE waba_integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
