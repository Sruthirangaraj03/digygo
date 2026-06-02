-- Add staff_id (company reference ID) to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_staff_id_tenant_unique ON users (tenant_id, staff_id) WHERE staff_id IS NOT NULL;
