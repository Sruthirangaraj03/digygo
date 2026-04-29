-- Sprint 10: Event types (persisted calendar templates)

CREATE TABLE IF NOT EXISTS event_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(100) NOT NULL,
  duration         INTEGER NOT NULL DEFAULT 30,
  description      TEXT,
  staff_type       VARCHAR(20) DEFAULT 'single',
  assignment_mode  VARCHAR(20) DEFAULT 'round-robin',
  staff_emails     JSONB DEFAULT '[]',
  meeting_type     VARCHAR(100) DEFAULT 'Google Meet',
  scheduling_type  VARCHAR(20) DEFAULT 'days',
  days_in_future   INTEGER DEFAULT 30,
  timezone         VARCHAR(100) DEFAULT 'Asia/Kolkata',
  schedule         JSONB DEFAULT '{}',
  buffer_time      INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  form_fields      JSONB DEFAULT '[]',
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS event_types_tenant_idx ON event_types(tenant_id);
