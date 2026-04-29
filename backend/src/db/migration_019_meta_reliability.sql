-- Leak 3 fix: unique constraint on (source, source_ref) to prevent race-condition duplicates
-- when webhook is delivered concurrently by Meta.
-- Partial index: only enforced when source_ref is non-null and non-empty.
CREATE UNIQUE INDEX IF NOT EXISTS leads_source_source_ref_unique
  ON leads(source, source_ref)
  WHERE source_ref IS NOT NULL AND source_ref <> '';
