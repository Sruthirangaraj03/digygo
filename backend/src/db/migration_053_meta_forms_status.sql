-- Store Meta's actual form status (ACTIVE / ARCHIVED / DRAFT / DELETED)
-- so we can surface it in the UI and diagnose why leads may not be importable.
ALTER TABLE meta_forms ADD COLUMN IF NOT EXISTS meta_status VARCHAR(50);
