ALTER TABLE custom_fields
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE custom_fields SET is_active = TRUE WHERE is_active IS NULL;
