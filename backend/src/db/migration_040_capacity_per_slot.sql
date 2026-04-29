-- Sprint 40: Per-slot capacity — supports 1v1 (default) and group sessions
ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS capacity_per_slot INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN event_types.capacity_per_slot IS
  '1 = private/1v1 (one person per slot), N = group (up to N people share a slot), 0 = unlimited';
