-- Add template_type, subject, file attachment columns + updated_at to templates table
ALTER TABLE templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(20) NOT NULL DEFAULT 'waba';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
