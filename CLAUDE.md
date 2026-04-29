# DigyGo CRM — Complete Developer Guide

## Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Zustand (`frontend/`)
- **Backend**: Node.js + Express + TypeScript + PostgreSQL (`backend/`)
- **Auth**: JWT (15 min access token) + httpOnly refresh cookie (30 days)
- **Realtime**: Socket.io (tenant-scoped events)
- **Icons**: Lucide React
- **Drag & drop**: @dnd-kit

---

## Running Locally

```bash
# Backend (port 4000)
cd backend && npm run dev

# Frontend (port 5173)
cd frontend && npm run dev

# ngrok (webhooks + Meta OAuth)
ngrok http 5173
```

## Environment — `backend/.env`
| Key | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Token signing |
| `WEBHOOK_BASE_URL` | Ngrok URL |
| `FRONTEND_URL` | Same ngrok URL |
| `META_APP_ID` / `META_APP_SECRET` | Facebook app credentials |
| `META_WEBHOOK_VERIFY_TOKEN` | `d7dde81a60c0867e0866cdb073538ce8` |

## Database
- Local PostgreSQL: `digygocrm` database, user `digygo_user`, password `digygo123`
- Run migrations: `cd backend && npx ts-node src/db/migrate.ts`
- Seed demo data: `cd backend && npx ts-node src/db/seed.ts`
- Super admin: `admin@digygocrm.com` / `admin123`

## Vite Proxy
`/api` and `/socket.io` → `http://127.0.0.1:4000`. Update `allowedHosts` in `vite.config.ts` when ngrok URL changes.

---

## Role Hierarchy — UNDERSTAND THIS FIRST

```
super_admin  →  Bypasses ALL checks. No tenantId. Must impersonate to access tenant data.
owner        →  Bypasses ALL permission checks via SUPER_ROLES. Is in users table (is_owner=true).
staff        →  All access resolved from user_permissions table (JSONB column).
```

- `SUPER_ROLES = { 'super_admin', 'owner' }` — these skip `checkPermission` entirely
- `owner` has `is_owner=true` in DB. Owner is excluded from `GET /api/settings/staff` list (management only)
- Staff with no `user_permissions` row → every permission check returns false → they see nothing
- `permAll = true` on frontend for super_admin and owner → all UI gates open

---

## Permission System — How It Works

### Backend
```typescript
checkPermission('leads:view_all')  // Express middleware — blocks route if not allowed
hasPermission(userId, 'leads:only_assigned', tenantId)  // Async fn — use inside route for data filtering
```

**Flow for staff:**
1. `checkPermission` → checks `SUPER_ROLES` first (bypass if owner/super_admin)
2. Calls `resolvePermission` → queries `user_permissions.permissions->>'permKey'` as boolean
3. Result cached 60s per `tenantId:userId:permKey` key
4. `clearUserPermCache(userId, tenantId)` must be called after any permission update

**Critical SQL in resolvePermission:**
```sql
WHERE u.id = $1 AND ($3::uuid IS NULL OR u.tenant_id = $3::uuid)
```
The `::uuid` cast is mandatory — PostgreSQL will throw `operator does not exist: uuid = text` without it.

### Frontend
```typescript
const canEdit = usePermission('leads:edit')         // returns boolean
const permFn  = usePermissions()                    // returns checker fn
permFn('leads:view_all')                            // use when calling in loops/callbacks
```
`permAll=true` for owner and super_admin — all UI permission gates auto-open.

### Full Permission Key List
```
dashboard:total_leads, dashboard:active_staff, dashboard:conversations, dashboard:appointments
meta_forms:read/create/edit/delete
custom_forms:read/create/edit/delete
landing_pages:read/create/edit/delete
whatsapp_setup:read/manage
whatsapp_automation:read/manage
leads:view_all, leads:view_own, leads:create, leads:edit, leads:delete
leads:only_assigned   ← ABSOLUTE restriction (default false — if true, user only sees their assigned leads)
leads:mask_phone      ← Hide phone numbers (default false)
contacts:read/create/edit/delete
contact_groups:read/manage
automation:view/manage
automation_templates:read/manage
inbox:view_all/send
fields:view/manage
staff:view/manage
settings:manage, calendar:manage, pipeline:manage
integrations:view/manage
```

---

## User-Scoped Data Access — THE MOST CRITICAL RULE

Every endpoint that returns **tenant data** MUST apply user-level access control. This is not optional.

### The Two-Layer Check Pattern

**Layer 1 — Can the user call this endpoint at all?**
```typescript
router.get('/leads', checkPermission('leads:view_own'), async ...)
```

**Layer 2 — What data can they see?**
```typescript
const isSuperAdmin = role === 'super_admin';
let viewAll = false;

if (isSuperAdmin) {
  viewAll = true;
} else {
  const isOwner = (await query('SELECT is_owner FROM users WHERE id=$1', [userId])).rows[0]?.is_owner === true;
  if (!isOwner) {
    const onlyAssigned = await hasPermission(userId, 'leads:only_assigned', tenantId);
    if (onlyAssigned) {
      viewAll = false;
    } else {
      viewAll = await hasPermission(userId, 'leads:view_all', tenantId);
    }
  } else {
    viewAll = true;
  }
}

if (!viewAll) {
  sql += ` AND l.assigned_to = $${params.push(userId)}`;
}
```

### Every Feature That Returns Lead-Related Data Needs This Pattern
- `GET /api/leads` ✓
- `GET /api/leads/followups` — must filter by assigned lead or assigned_to on follow-up
- `GET /api/contacts` — must filter by assigned_to
- `GET /api/calendar` — must filter by assigned event or assigned lead
- `GET /api/conversations` — must filter by assigned_to
- `GET /api/pipelines` — must restrict to pipelines with user's assigned leads
- `GET /api/workflows/:id/logs` — must filter by assigned leads
- `GET /api/dashboard/stats` — must scope counts to assigned leads

**Rule: If an endpoint returns data that belongs to a lead, it must respect `leads:only_assigned`.**

---

## Systemwide Audit Rule — ALWAYS DO THIS

When fixing or building ANY endpoint or page, before closing the task:

1. **Check every related endpoint in the same route file** for the same class of bug
2. **Check adjacent route files** — if leads.ts has a filter bug, check contacts.ts, followups, calendar, conversations
3. **Check the frontend page** — does it apply any client-side filter? Does it show data to the right users?
4. **Think from each role's perspective:**
   - As `super_admin`: Can I see everything? (should be yes)
   - As `owner`: Can I see everything? (should be yes)
   - As `staff with view_all`: Can I see all leads? (should be yes)
   - As `staff with only_assigned`: Can I see ONLY my leads? (should be yes)
   - As `staff with no permissions row`: What do I see? (should be gracefully limited, not 500)

---

## New Endpoint Checklist

Before any new backend route is considered complete, verify:

- [ ] `requireAuth` + `requireTenant` applied (via `router.use()` at top of file)
- [ ] `checkPermission('appropriate:key')` on the route
- [ ] `WHERE tenant_id = $X` on every SQL query
- [ ] User-scoping applied if returning lead/contact/calendar/conversation data
- [ ] Parameterized SQL — never string interpolation
- [ ] `::uuid` cast on any UUID comparison from a text parameter: `$N::uuid`
- [ ] Soft-delete filter: `AND is_deleted = FALSE` on leads/calendar queries
- [ ] Socket emission includes JOIN'd fields (e.g., `assigned_name`) not just `RETURNING *`
- [ ] Plan check (`checkPlan`) if feature is plan-gated
- [ ] Usage check (`checkUsage`) if resource has a limit

---

## New Frontend Page/Feature Checklist

Before any new page or feature is considered complete, verify:

- [ ] `usePermission('key')` gates every action button (create, edit, delete)
- [ ] API errors show toast notification
- [ ] Loading state shown while fetching
- [ ] Empty state shown when no data
- [ ] Staff array lookup for assignee names uses `assigned_name` from API as fallback (not just `staff.find()`)
- [ ] Socket listeners registered for real-time updates, cleaned up on unmount
- [ ] `initFromApi()` or direct API call loads fresh data on mount
- [ ] Works correctly when `staff` array is empty (no crash, graceful fallback)

---

## Database Patterns

### Multi-tenancy — Every Query Must Scope to Tenant
```sql
WHERE tenant_id = $1            -- Always first param
AND is_deleted = FALSE          -- For leads, calendar events
AND ($N::uuid IS NULL OR u.tenant_id = $N::uuid)  -- When joining users with optional tenantId
```

### Parameterized Queries — Always
```typescript
await query('SELECT * FROM leads WHERE id=$1 AND tenant_id=$2', [id, tenantId])
// NEVER: `SELECT * FROM leads WHERE id='${id}'`
```

### UUID Comparisons — Always Cast
```sql
WHERE u.tenant_id = $3::uuid    -- NOT: WHERE u.tenant_id = $3
($3::uuid IS NULL OR ...)       -- For nullable UUID params
```

### Socket Emissions — Include JOIN'd Fields
```typescript
// WRONG — RETURNING * doesn't include assigned_name
emitToTenant(tenantId, 'lead:updated', result.rows[0]);

// RIGHT — re-fetch with JOIN to include display fields
const withJoin = await query(
  'SELECT l.*, u.name AS assigned_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id=$1',
  [result.rows[0].id]
);
emitToTenant(tenantId, 'lead:updated', withJoin.rows[0]);
```

### Soft Deletes
- Leads: `is_deleted = TRUE` (never hard delete)
- Calendar events: `is_deleted = TRUE`
- Hard delete only: tags, pipeline stages (after moving leads off)

---

## Frontend Data Flow

```
App boots → AuthGuard.bootstrapFromRefresh()
         → crmStore.initFromApi()
         → Fetches: leads, staff, pipelines, calendar, tags, conversations, notifications, followups, customFields
         → All .catch(() => []) — silent failures, don't crash app
         → AppLayout polls initFromApi() every 30s for freshness
```

### crmStore — Key Rules
- `staff` array contains ONLY non-owner users (from `GET /api/settings/staff`)
- `assigned_name` from API response is the fallback for owner-assigned leads
- All lead mappings must include: `assignedTo: l.assigned_to ?? ''` AND `assignedName: l.assigned_name ?? ''`
- Socket events (`lead:created`, `lead:updated`) must also map `assignedName`
- Permissions stored in `authStore`, not `crmStore`

### Lead Display — Assignee Name
```typescript
// Always use this pattern — staff.find() alone fails for owner-assigned leads
const assignedStaff = staff.find((s) => s.id === lead.assignedTo);
const displayName = assignedStaff?.name || lead.assignedName || '';
// Show: displayName ? `Assigned to ${displayName}` : 'Unassigned'
```

---

## Authentication Patterns

### Token Storage
- Access token: in-memory only (`_accessToken` in api.ts) + localStorage `dg_tok`
- Refresh token: httpOnly cookie only (never accessible to JS)
- Impersonation CEO token: in-memory only — page refresh ends impersonation (by design, secure)

### 401 Handling in api.ts
```
Request fails with 401
  → Try POST /api/auth/refresh (once, deduplicated)
  → Success: update token, retry original request
  → Failure with 401/403: logout() + redirect /login
  → Other failure: throw 'Session expired'
```

### Refresh Token Rotation
- Only first 16 hex chars (prefix) stored indexed for O(1) lookup
- Atomic UPDATE WHERE prefix = $X to prevent race condition reuse
- Failed login: increment `failed_login_attempts`, lock after 5 × 15 min

---

## Plan & Usage System

```
Plans: starter → growth → pro → enterprise

checkPlan('feature'):    Reads from JWT (no DB hit) — fast gate
checkUsage('resource'):  Queries tenant_usage table — checks count vs. plan limit
incrementUsage():        Call after successful resource creation
decrementUsage():        Call after resource deletion
```

**Plan limits (starter):** 500 leads, 500 contacts, 5 staff, 5 forms, 5 workflows
**Enterprise:** unlimited everything

---

## Key Backend Routes
| File | Prefix | Notes |
|---|---|---|
| `routes/auth.ts` | `/api/auth` | Login, refresh, super admin tenant management |
| `routes/leads.ts` | `/api/leads` | Lead CRUD + followups |
| `routes/contacts.ts` | `/api/contacts` | Contact CRUD |
| `routes/pipelines.ts` | `/api/pipelines` | Pipeline + stage management |
| `routes/workflows.ts` | `/api/workflows` | Automation workflows |
| `routes/settings.ts` | `/api/settings` | Company settings + staff management |
| `routes/forms.ts` | `/api/forms` | Custom forms (public submit has no auth) |
| `routes/calendar.ts` | `/api/calendar` | Events + public booking |
| `routes/conversations.ts` | `/api/conversations` | Inbox/WhatsApp threads |
| `routes/fields.ts` | `/api/fields` | Custom lead fields |
| `routes/integrations.ts` | `/api/integrations` | Meta/WhatsApp/Stripe |
| `routes/webhooks.ts` | `/api/webhooks` | Inbound Meta webhooks |

---

## Key Frontend Pages
| Page | Path | Key Permissions |
|---|---|---|
| `LeadsPage.tsx` | `/leads` | leads:view_all/own, leads:only_assigned |
| `ContactsPage.tsx` | `/lead-management/contacts` | contacts:read/create/edit/delete |
| `FollowUpsPage.tsx` | `/lead-management/followups` | respects leads:only_assigned |
| `AutomationPage.tsx` | `/automation/workflows` | automation:view/manage |
| `WorkflowEditorPage.tsx` | `/automation/editor/:id` | automation:manage |
| `CalendarPage.tsx` | `/calendar` | calendar:manage |
| `InboxPage.tsx` | `/inbox` | inbox:view_all/send |
| `StaffPage.tsx` | `/staff` | staff:view/manage |
| `DashboardPage.tsx` | `/dashboard` | dashboard:* per widget |
| `MetaFormsPage.tsx` | `/lead-generation/meta-forms` | meta_forms:* |
| `CustomFormsPage.tsx` | `/lead-generation/custom-forms` | custom_forms:* |
| `SuperAdminPage.tsx` | `/admin` | role === 'super_admin' only |

---

## Design Conventions
- Brand colors: `#c2410c` (primary), `#ea580c`, `#f97316`
- Muted text: `#7a6b5c`, Primary text: `#1c1410`
- Card background: `#faf8f6`
- Rounded cards: `rounded-xl` or `rounded-2xl` with `border border-black/5`
- Stage names: `text-[#c2410c]`
- Buttons: orange gradient for primary actions, white/border for secondary
- All modals/panels: `z-50` or higher, backdrop `bg-black/50`

---

## Known Bugs Fixed — Do Not Reintroduce

1. **`resolvePermission` uuid cast** — `$3::uuid IS NULL OR u.tenant_id = $3::uuid` — without `::uuid` PostgreSQL throws type mismatch and ALL staff routes return 500
2. **`GET /api/settings/staff` permission guard** — removed `checkPermission('staff:view')` so all staff can load the team list for name display
3. **Owner excluded from staff list** — `assigned_name` stored on Lead object as fallback for owner-assigned leads
4. **Socket `lead:created/updated` missing `assigned_name`** — `RETURNING *` doesn't include JOIN fields; re-fetch with JOIN before emitting
5. **AutomationPage blank** — `AlertTriangle` imported from lucide-react was missing, causing render crash
6. **`GET /api/leads/followups` no user scoping** — endpoint returned all tenant follow-ups with no `only_assigned` filter
7. **Form trigger blank = any form** — `opt_in_form`, `meta_form`, `product_enquired` with no form selected used to fire for every form submission. Fixed: blank form config = workflow never fires. Backend SQL no longer has `trigger_forms = '{}'` bypass. Frontend blocks activation with a toast error and shows an amber warning banner in the trigger config panel.

---

## Thinking Framework — Apply Before Every Task

### Before writing any code, ask:
1. **Who can call this?** → Does it need `checkPermission`? Which key?
2. **What data can they see?** → Does it need `only_assigned` / `view_all` filtering?
3. **Is it scoped to the tenant?** → Is `tenant_id` in the WHERE clause?
4. **What happens for each role?** → Test mentally: super_admin, owner, staff with all perms, staff with restricted perms, staff with no perms row
5. **What breaks if the API call fails?** → Frontend must not crash; show empty state gracefully
6. **Are there related endpoints with the same gap?** → Fix them all, not just the one reported

### After writing any code, verify:
1. Does a staff user with `only_assigned=true` see ONLY their data?
2. Does the owner see everything (even though they're not in the staff array)?
3. Does a user with no `user_permissions` row get a graceful experience (not 500)?
4. Do socket events carry all necessary display fields (not just raw DB row)?
5. Does the frontend have fallbacks when arrays are empty or API calls fail?

---

## Automation System — Triggers & Actions

### How Workflows Execute
- `triggerWorkflows(triggerType, lead, tenantId, userId)` in `routes/workflows.ts` is called after relevant CRM events
- SQL fetches only `active` workflows whose `trigger_key` matches AND form filter passes
- Per-lead filters (pipeline, stage, source, tag) are checked in-memory after the SQL fetch
- Each action node logs `completed / failed / skipped` status to `workflow_execution_logs`
- Variable interpolation: `{first_name}`, `{last_name}`, `{full_name}`, `{email}`, `{phone}`, `{stage}`, `{pipeline}`, `{assigned_staff}`, `{source}`, `{today}`, `{date}`, `{time}`, custom fields

### Trigger Types

#### Forms
| Key | Label | Fires when | Config |
|---|---|---|---|
| `opt_in_form` | Custom Form Submitted | A lead submits an embedded/hosted custom form | Must select ≥1 form. Blank = workflow stays inactive, never fires |
| `meta_form` | Meta Form Submitted | A lead comes in via Facebook/Instagram lead ad | Must select ≥1 form. Blank = workflow stays inactive, never fires |
| `product_enquired` | Product Enquired | A product enquiry form is submitted | Must select ≥1 form. Blank = workflow stays inactive, never fires |

#### CRM
| Key | Label | Fires when | Config |
|---|---|---|---|
| `lead_created` | Added to Pipeline | A lead is **first created** and placed into a specific pipeline — NOT on stage moves within same pipeline | Select pipeline + stage (both optional; blank = any). Backend filters by `pipeline_id` and `stage_id` on the lead at creation time |
| `stage_changed` | Stage Changed | A lead is moved from one pipeline stage to another | Select pipeline + stage to match destination |
| `follow_up` | Follow Up | A follow-up task is created for a lead | Filter by type and assigned staff |
| `notes_added` | Notes Added | A note is added to any lead — no filter needed | — |

> **`lead_created` rule**: fires only at creation time (POST /api/leads). Stage moves use `stage_changed`. Backend skips the workflow if configured pipeline/stage doesn't match the lead's pipeline/stage at creation.

#### Contact
| Key | Label | Fires when |
|---|---|---|
| `contact_created` | Contact Source | A new contact is created; filter by source (Meta Form, WhatsApp, Manual, etc.) |
| `contact_updated` | Contact Updated | Any field on a contact is edited; filter by which field changed |
| `contact_tagged` | Contact Tagged | A specific tag is applied to a contact |

#### Calendar
| Key | Label | Fires when |
|---|---|---|
| `calendar_form_submitted` | Calendar Form Submitted | Someone fills the booking form; must select at least one calendar (blank = never fires) |
| `appointment_booked` | Appointment Booked | Appointment confirmed |
| `appointment_cancelled` | Appointment Cancelled | Appointment cancelled |
| `appointment_rescheduled` | Appointment Rescheduled | Appointment moved to new time |
| `appointment_noshow` | No-Show | Lead didn't attend |
| `appointment_showup` | Show Up | Lead attended |

#### Schedule
| Key | Label | Fires when |
|---|---|---|
| `specific_date` | Specific Date | Once on a configured date |
| `weekly_recurring` | Weekly Recurring | Every week on a chosen day |
| `monthly_recurring` | Monthly Recurring | Every month on a chosen date |
| `event_date` | Event Date | Relative to an event date stored on the lead |

#### Inbox / Social / Other
| Key | Label | Fires when |
|---|---|---|
| `inbox_message` | New Message | WhatsApp/inbox message received |
| `comment_received` | Comment Received | Comment on Facebook/Instagram post |
| `dm_received` | DM Received | Instagram direct message received |
| `webhook_inbound` | API 1.0 | External system POSTs to your inbound webhook URL |
| `payment_received` | Payment Received | Payment recorded for a lead |
| `course_enrolled` | Course Enrolled | Lead enrolls in a course (LMS) |

---

### Action Types

#### CRM Operations
| Key | What it does |
|---|---|
| `add_to_crm` | Creates or updates lead in a configured pipeline + stage; verifies write persisted |
| `change_stage` | Moves lead to a different stage; also fires `stage_changed` trigger after move |
| `change_lead_quality` | Sets lead quality: Hot / Warm / Cold / Unqualified |
| `update_attributes` | Updates name, email, phone, or source on the lead record |

#### People
| Key | What it does |
|---|---|
| `assign_staff` | Assigns lead to a staff member; if multiple configured → round-robin |
| `remove_staff` | Clears the assigned_to field on the lead |
| `assign_ai` | Assigns an AI agent ID to `custom_fields.ai_agent_id` |

#### Tags
| Key | What it does |
|---|---|
| `add_tag` / `tag_contact` | Adds one or more tags to the lead |
| `remove_tag` | Removes a specific tag from the lead |

#### Communication
| Key | What it does |
|---|---|
| `send_email` | Sends automated email via SMTP; supports `{variable}` interpolation in subject + body |
| `send_whatsapp` | Sends WhatsApp message via connected WABA number |
| `internal_notify` | Sends in-CRM notification to: all staff / assigned staff / specific person |
| `send_sms` | ⚠️ NOT IMPLEMENTED — throws error if reached |

#### Follow-up & Calendar
| Key | What it does |
|---|---|
| `create_followup` | Schedules a follow-up task; configure due time in hours/days from now |
| `change_appointment` | Updates appointment status to Booked / Cancelled / Completed / No Show / Rescheduled |

#### Notes
| Key | What it does |
|---|---|
| `create_note` | Adds a note to lead timeline; supports `{variable}` interpolation |

#### Contact Lists
| Key | What it does |
|---|---|
| `contact_group` | Copies/moves contact into a contact group (uses tag with "group:" prefix) |
| `contact_group_access` | Grants group access to contact (uses tag with "access:" prefix) |
| `remove_contact` | Removes contact from a specific list |
| `remove_from_crm` | Soft-deletes the lead from CRM (sets `is_deleted = TRUE`) |

#### Workflow Control
| Key | What it does |
|---|---|
| `if_else` | Branches based on condition — evaluates fields, tags, stage, custom fields with AND/OR logic; operators: equals, not equals, contains, starts/ends with, is empty, greater/less than |
| `delay` | Waits X minutes / hours / days before next action |
| `execute_automation` | Runs another workflow as a sub-process |
| `exit_workflow` | Stops this workflow immediately for this lead |
| `remove_workflow` | Removes lead from the current running workflow |

#### External
| Key | What it does |
|---|---|
| `webhook_call` | POSTs lead data to an external URL |
| `api_call` | Makes GET/POST/PUT/PATCH to any external API (15s timeout); can save response to a custom field |
| `post_instagram` | ⚠️ NOT IMPLEMENTED |
| `facebook_post` | ⚠️ NOT IMPLEMENTED |

---

## Meta Integration URLs
| Purpose | URL |
|---|---|
| OAuth callback | `{WEBHOOK_BASE_URL}/api/integrations/meta/callback` |
| Webhook (leadgen) | `{WEBHOOK_BASE_URL}/api/integrations/meta/webhook` |
| WhatsApp webhook | `{WEBHOOK_BASE_URL}/api/webhooks/whatsapp` |
