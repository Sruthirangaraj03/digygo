/**
 * Canonical TypeScript row types for every key database table.
 *
 * RULES:
 *  1. Every column that any route file references must appear here.
 *  2. When you add/rename a column in a migration, update this file in the same commit.
 *  3. The startup schema validator (schema-validator.ts) cross-checks these against
 *     information_schema.columns on every server boot — mismatches log CRITICAL errors.
 *  4. Use these types in query<T>() calls so TypeScript catches wrong property access.
 *
 * Column history notes (so future devs know why names look odd):
 *  - booking_links.name     : original was 'title' (migration_003); renamed in migration_012
 *  - booking_links.duration_mins: original was 'duration_minutes' (migration_003); renamed in migration_012
 *  - booking_links.buffer_mins  : original was 'buffer_minutes'   (migration_003); renamed in migration_012
 */

// ── Tenants ───────────────────────────────────────────────────────────────────
export interface TenantRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  plan: string;
  created_at: string;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export interface UserRow {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: string;
  is_owner: boolean;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}

// ── Leads ─────────────────────────────────────────────────────────────────────
export interface LeadRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  source_ref: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  assigned_to: string | null;
  assigned_name: string | null;   // JOIN'd from users
  quality: string | null;
  tags: string[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // optional join fields
  form_id?: string;
  form_name?: string;
}

// ── Booking Links ─────────────────────────────────────────────────────────────
// NOTE: column was 'title' in migration_003 — renamed to 'name' in migration_012.
//       Column was 'duration_minutes'/'buffer_minutes' — renamed to 'duration_mins'/'buffer_mins' in migration_012.
export interface BookingLinkRow {
  id: string;
  tenant_id: string;
  created_by: string | null;
  name: string;             // NOT 'title'
  slug: string;
  duration_mins: number;    // NOT 'duration_minutes'
  buffer_mins: number;      // NOT 'buffer_minutes'
  max_per_day: number | null;
  location: string | null;
  description: string | null;
  availability: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

// ── Calendar Events ───────────────────────────────────────────────────────────
export interface CalendarEventRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  lead_id: string | null;
  created_by: string;
  event_type_id: string | null;
  is_deleted: boolean;
  created_at: string;
}

// ── Event Types ───────────────────────────────────────────────────────────────
export interface EventTypeRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  duration: number;
  description: string | null;
  is_active: boolean;
  is_deleted: boolean;
  sort_order: number;
  created_at: string;
}

// ── Custom Forms ──────────────────────────────────────────────────────────────
export interface CustomFormRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  fields: unknown[];
  pipeline_id: string | null;
  stage_id: string | null;
  redirect_url: string | null;
  thank_you_message: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Meta Forms ────────────────────────────────────────────────────────────────
export interface MetaFormRow {
  id: string;
  tenant_id: string;
  form_id: string;
  form_name: string;
  page_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  field_mapping: Array<{ fb_field: string; crm_field: string }>;
  is_active: boolean;
  leads_count: number;
  last_sync_at: string | null;
}

// ── Meta Integrations ─────────────────────────────────────────────────────────
export interface MetaIntegrationRow {
  id: string;
  tenant_id: string;
  access_token: string;   // encrypted
  token_expiry: string | null;
  page_ids: string[];
  page_names: Record<string, string>;
  blocked_page_ids: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ── Workflows ─────────────────────────────────────────────────────────────────
export interface WorkflowRow {
  id: string;
  tenant_id: string;
  name: string;
  trigger_key: string;
  trigger_forms: string[];
  nodes: unknown;
  status: string;
  allow_reentry: boolean;
  max_contacts: number | null;
  created_at: string;
  updated_at: string;
}

// ── Workflow Executions ───────────────────────────────────────────────────────
export interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  lead_id: string;
  tenant_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
}

// ── Workflow Staff Counters ───────────────────────────────────────────────────
export interface WorkflowStaffCounterRow {
  workflow_id: string;
  node_id: string;
  staff_id: string;
  count: number;
}

// ── Conversations ─────────────────────────────────────────────────────────────
export interface ConversationRow {
  id: string;
  tenant_id: string;
  lead_id: string;
  channel: string;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
}

// ── Messages ──────────────────────────────────────────────────────────────────
export interface MessageRow {
  id: string;
  conversation_id: string;
  tenant_id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  wamid: string | null;
  type: string;
  created_at: string;
}

// ── Pipelines & Stages ────────────────────────────────────────────────────────
export interface PipelineRow {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface PipelineStageRow {
  id: string;
  pipeline_id: string;
  tenant_id: string;
  name: string;
  stage_order: number;    // NOT 'sort_order'
  color: string | null;
  created_at: string;
}

// ── Custom Fields ─────────────────────────────────────────────────────────────
export interface CustomFieldRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  type: string;
  required: boolean;
  is_active: boolean;
  created_at: string;
}

// ── Tags ──────────────────────────────────────────────────────────────────────
export interface TagRow {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  created_at: string;
}
