-- Document column contracts so future code can't misuse them

COMMENT ON COLUMN leads.source_ref IS
  'Per-lead unique external ID (e.g. Meta leadgen_id from Facebook). '
  'The unique constraint leads_source_source_ref_unique enforces (source, source_ref) uniqueness. '
  'NEVER store a per-form or per-source-type ID here — only a value that is unique per individual lead. '
  'For custom forms: leave NULL (the form.id is not unique per lead). '
  'For Meta forms: use the Facebook leadgen_id. '
  'For WhatsApp: leave NULL.';

COMMENT ON COLUMN leads.source IS
  'Human-readable capture channel: ''Manual'', ''Custom Form'', ''meta_form'', ''whatsapp'', ''calendar_booking''. '
  'Paired with source_ref for deduplication on Meta leads.';
