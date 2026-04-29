ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: mark the earliest admin per tenant as the owner (created by DigyGo super_admin)
UPDATE users SET is_owner = TRUE
WHERE id IN (
  SELECT DISTINCT ON (tenant_id) id
  FROM users
  WHERE role = 'admin' AND tenant_id IS NOT NULL
  ORDER BY tenant_id, created_at ASC
);
