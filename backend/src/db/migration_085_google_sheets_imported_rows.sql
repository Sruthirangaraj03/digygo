-- Content-based row tracking for Google Sheets sync.
-- Replaces the fragile row-count cursor (last_row_synced) which broke when rows
-- were deleted or reordered in the sheet (caused silent lead loss or duplicates).
--
-- Each imported row is recorded by a stable identity key per config. A row is only
-- imported once per sheet, regardless of its position or whether other rows change.

CREATE TABLE IF NOT EXISTS google_sheets_imported_rows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id  UUID NOT NULL REFERENCES google_sheets_configs(id) ON DELETE CASCADE,
  row_key    TEXT NOT NULL,
  lead_id    UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (config_id, row_key)
);

CREATE INDEX IF NOT EXISTS gsir_config_idx ON google_sheets_imported_rows (config_id);

-- ============================================================
-- DOWN MIGRATION (run manually if rollback needed)
-- ============================================================
-- DROP TABLE IF EXISTS google_sheets_imported_rows;
-- ============================================================
