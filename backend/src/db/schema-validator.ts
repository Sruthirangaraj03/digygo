import { pool } from './index';

/**
 * Checked on every server boot (after migrations). Each entry is a column the
 * application code actually references. If a migration renames/drops a column
 * without updating row-types.ts AND this list, the server logs a CRITICAL error
 * at startup rather than failing silently at runtime for the first user hit.
 *
 * HOW TO MAINTAIN:
 *  - When you add a column: add it here + add to row-types.ts in the same commit.
 *  - When you rename a column: update the entry here + row-types.ts + every
 *    SQL string that referenced the old name.
 *  - When you drop a column: remove it from here + row-types.ts.
 */
const EXPECTED_COLUMNS: Array<{ table: string; column: string }> = [
  // ── leads ──────────────────────────────────────────────────────────────────
  { table: 'leads', column: 'id' },
  { table: 'leads', column: 'tenant_id' },
  { table: 'leads', column: 'name' },
  { table: 'leads', column: 'email' },
  { table: 'leads', column: 'phone' },
  { table: 'leads', column: 'source' },
  { table: 'leads', column: 'source_ref' },
  { table: 'leads', column: 'pipeline_id' },
  { table: 'leads', column: 'stage_id' },
  { table: 'leads', column: 'assigned_to' },
  { table: 'leads', column: 'is_deleted' },

  // ── booking_links — 'title'/'duration_minutes'/'buffer_minutes' were renamed in migration_012
  { table: 'booking_links', column: 'id' },
  { table: 'booking_links', column: 'tenant_id' },
  { table: 'booking_links', column: 'name' },          // NOT 'title'
  { table: 'booking_links', column: 'slug' },
  { table: 'booking_links', column: 'duration_mins' }, // NOT 'duration_minutes'
  { table: 'booking_links', column: 'buffer_mins' },   // NOT 'buffer_minutes'
  { table: 'booking_links', column: 'is_active' },

  // ── pipeline_stages — sort order column is 'stage_order', NOT 'sort_order'
  { table: 'pipeline_stages', column: 'id' },
  { table: 'pipeline_stages', column: 'pipeline_id' },
  { table: 'pipeline_stages', column: 'name' },
  { table: 'pipeline_stages', column: 'stage_order' }, // NOT 'sort_order'

  // ── workflows ──────────────────────────────────────────────────────────────
  { table: 'workflows', column: 'id' },
  { table: 'workflows', column: 'tenant_id' },
  { table: 'workflows', column: 'trigger_key' },
  { table: 'workflows', column: 'trigger_forms' },
  { table: 'workflows', column: 'nodes' },
  { table: 'workflows', column: 'status' },
  { table: 'workflows', column: 'allow_reentry' },

  // ── workflow_executions ────────────────────────────────────────────────────
  { table: 'workflow_executions', column: 'id' },
  { table: 'workflow_executions', column: 'workflow_id' },
  { table: 'workflow_executions', column: 'lead_id' },
  { table: 'workflow_executions', column: 'status' },

  // ── workflow_staff_counters (migration_049) ────────────────────────────────
  { table: 'workflow_staff_counters', column: 'workflow_id' },
  { table: 'workflow_staff_counters', column: 'node_id' },
  { table: 'workflow_staff_counters', column: 'staff_id' },
  { table: 'workflow_staff_counters', column: 'count' },

  // ── meta_integrations ──────────────────────────────────────────────────────
  { table: 'meta_integrations', column: 'tenant_id' },
  { table: 'meta_integrations', column: 'access_token' },
  { table: 'meta_integrations', column: 'page_ids' },
  { table: 'meta_integrations', column: 'page_names' },

  // ── meta_forms ─────────────────────────────────────────────────────────────
  { table: 'meta_forms', column: 'id' },
  { table: 'meta_forms', column: 'tenant_id' },
  { table: 'meta_forms', column: 'form_id' },
  { table: 'meta_forms', column: 'page_id' },
  { table: 'meta_forms', column: 'field_mapping' },
  { table: 'meta_forms', column: 'is_active' },

  // ── custom_forms ───────────────────────────────────────────────────────────
  { table: 'custom_forms', column: 'id' },
  { table: 'custom_forms', column: 'tenant_id' },
  { table: 'custom_forms', column: 'slug' },
  { table: 'custom_forms', column: 'fields' },
  { table: 'custom_forms', column: 'is_active' },

  // ── users ──────────────────────────────────────────────────────────────────
  { table: 'users', column: 'id' },
  { table: 'users', column: 'tenant_id' },
  { table: 'users', column: 'name' },
  { table: 'users', column: 'email' },
  { table: 'users', column: 'role' },
  { table: 'users', column: 'is_owner' },
  { table: 'users', column: 'is_active' },

  // ── conversations ──────────────────────────────────────────────────────────
  { table: 'conversations', column: 'id' },
  { table: 'conversations', column: 'tenant_id' },
  { table: 'conversations', column: 'lead_id' },
  { table: 'conversations', column: 'channel' },
  { table: 'conversations', column: 'status' },
  { table: 'conversations', column: 'unread_count' },

  // ── calendar_events ────────────────────────────────────────────────────────
  { table: 'calendar_events', column: 'id' },
  { table: 'calendar_events', column: 'tenant_id' },
  { table: 'calendar_events', column: 'start_time' },
  { table: 'calendar_events', column: 'end_time' },
  { table: 'calendar_events', column: 'status' },
  { table: 'calendar_events', column: 'is_deleted' },

  // ── event_types ────────────────────────────────────────────────────────────
  { table: 'event_types', column: 'id' },
  { table: 'event_types', column: 'tenant_id' },
  { table: 'event_types', column: 'name' },
  { table: 'event_types', column: 'slug' },
  { table: 'event_types', column: 'is_deleted' },
];

export async function validateSchema(): Promise<void> {
  try {
    const result = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'`
    );

    const existing = new Set(result.rows.map((r) => `${r.table_name}.${r.column_name}`));

    const missing: string[] = [];
    for (const { table, column } of EXPECTED_COLUMNS) {
      if (!existing.has(`${table}.${column}`)) {
        missing.push(`${table}.${column}`);
      }
    }

    if (missing.length > 0) {
      console.error('\n⛔  [SchemaValidator] CRITICAL — missing columns detected:');
      for (const col of missing) {
        console.error(`     ✗  ${col}`);
      }
      console.error('   → Update migrations and row-types.ts, then redeploy.\n');
    } else {
      console.log('✅  [SchemaValidator] All expected columns present');
    }
  } catch (err: any) {
    console.error('[SchemaValidator] Could not run schema check:', err.message);
  }
}
