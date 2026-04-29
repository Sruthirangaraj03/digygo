# DigyGo CRM — Priority Build Order
## What to Build First, Second, and Last — With Full Reasoning

> Cross-reference with `tasklist.md` for the in-depth task details per item.
> Every item here maps to a task ID in `tasklist.md`.

---

## PRIORITY TIERS

| Tier | Label | Meaning |
|------|-------|---------|
| P0 | BLOCKER | Nothing works without this. Do it before writing any feature code. |
| P1 | CORE | Your 3 stated priorities. Revenue-enabling features. |
| P2 | SUPPORTING | Makes P1 features production-grade and not embarrassing to demo |
| P3 | GROWTH | Real business value but not needed to validate the product |
| P4 | POLISH | Quality of life, performance, scale |

---

---

# P0 — BLOCKERS
### Must be done before ANY feature work. These break everything if skipped.

---

## P0.1 — Authentication Is Not Safe

**Why P0:** Token is in `localStorage` (XSS-stealable). All routes are unprotected — anyone can visit `/admin` without logging in. Stolen 7-day token has no revocation. This is a security incident waiting to happen on day 1 of using the product with real data.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Fix token storage | `frontend/src/lib/api.ts` line 3 | Remove `localStorage.getItem`. Read from `authStore` (Zustand memory). |
| 2 | Create authStore | `frontend/src/store/authStore.ts` | Zustand store: `accessToken` (memory), `currentUser`, `isAuthenticated`, `login()`, `logout()` |
| 3 | Rewrite login | `backend/src/routes/auth.ts` POST /login | Issue 15-min JWT + 7-day refresh token in HttpOnly cookie. Store `refresh_token_hash` in DB. |
| 4 | Refresh token endpoint | `backend/src/routes/auth.ts` | `POST /api/auth/refresh` — reads cookie, validates hash, rotates token |
| 5 | Logout endpoint | `backend/src/routes/auth.ts` | `POST /api/auth/logout` — nullify DB hash, clear cookie |
| 6 | Auto-refresh on 401 | `frontend/src/lib/api.ts` | On 401: call refresh → retry request → on second 401 → redirect /login |
| 7 | Protect all routes | `frontend/src/App.tsx` | Create `<ProtectedRoute>` component. Wrap all app routes. |
| 8 | Wire login page | `frontend/src/pages/LoginPage.tsx` | Call `POST /api/auth/login` → store token in authStore memory |

**DB migration needed:** `ALTER TABLE users ADD COLUMN refresh_token_hash VARCHAR(255), ADD COLUMN last_login_at TIMESTAMPTZ`

---

## P0.2 — Missing Database Tables Block All 3 Priorities

**Why P0:** You cannot build Lead tags (Lead Management), Workflow WhatsApp sending (Automation), or Meta form submissions (Lead Generation) without these tables. Migration must run first.

| # | Table | Needed By | Task Ref |
|---|-------|-----------|---------|
| 1 | `tags` + `lead_tags` | Lead Management filters, Automation triggers | S1.2.1 |
| 2 | `conversations` + `messages` | WhatsApp lead capture, Inbox | S1.2.1 |
| 3 | `meta_integrations` + `meta_forms` | Meta Forms integration | S1.2.1 |
| 4 | `waba_integrations` | WhatsApp setup, Automation send_whatsapp | S1.2.1 |
| 5 | `templates` | Automation send_whatsapp action | S1.2.1 |
| 6 | `opportunities` | Lead detail panel | S1.2.1 |
| 7 | `roles` + `role_permissions` + `user_roles` | RBAC on every route | S1.2.2 |
| 8 | Add `is_deleted` to leads | Soft delete (PRD requirement) | S1.2.1 |
| 9 | Add `slug` to custom_forms | Custom form public URL | S1.2.1 |
| 10 | Add `refresh_token_hash` to users | Auth | S1.2.1 |

**Action:** Create and run `migration_003_auth_sessions.sql`, `migration_004_core_tables.sql`, `migration_005_rbac.sql`

---

## P0.3 — Soft Delete (Data Safety)

**Why P0:** `DELETE FROM leads` permanently destroys a lead + all its notes, activities, follow-ups. One accidental click = unrecoverable data loss. PRD §12.3 is explicit: soft deletes only.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Change DELETE to soft delete | `backend/src/routes/leads.ts` line 136 | `UPDATE leads SET is_deleted=true` instead of DELETE |
| 2 | Filter deleted from all queries | `backend/src/routes/leads.ts` lines 15, 44, 104 | Add `AND is_deleted = false` to all lead SELECTs |

---

## P0.4 — Stage ID vs Stage Name Bug (Silent Data Corruption)

**Why P0:** The Kanban drag-and-drop calls `PATCH /api/leads/:id` with a **stage name string** instead of a **stage UUID**. The backend receives a non-UUID value for `stage_id`. The lead's stage silently fails to update in the database. Users think they moved a lead — they didn't. Data is wrong.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Add `stageId` to Lead type | `frontend/src/data/mockData.ts` | Add `stageId: string` field |
| 2 | Fix `initFromApi` mapping | `frontend/src/store/crmStore.ts` line 388 | Populate `stageId: l.stage_id` alongside `stage: stageName` |
| 3 | Fix `moveLeadStage` signature | `frontend/src/store/crmStore.ts` line 247 | Accept `(id, stageId, stageName)` — pass UUID to API |
| 4 | Fix DnD `onDragEnd` handler | `frontend/src/pages/LeadsPage.tsx` | Pass `stage.id` UUID when calling `moveLeadStage` |

---

## P0.5 — Input Validation (Security)

**Why P0:** Zero Zod validation on any route. Raw `req.body` passed directly. Unvalidated strings stored in DB can break queries, cause XSS when rendered, or corrupt data types.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Install Zod | `backend/` | `npm install zod` |
| 2 | Create schemas | `backend/src/schemas/` | `lead.schema.ts`, `workflow.schema.ts`, `staff.schema.ts` |
| 3 | Create validate middleware | `backend/src/middleware/validate.ts` | `validate(schema)` factory runs `schema.parse(req.body)`, returns 400 on fail |
| 4 | Apply to critical routes | all POST/PATCH routes | Leads, workflows, staff, settings |

---

---

# P1 — CORE FEATURES
### Your 3 priorities. Build in this order: Lead Management → Automation → Lead Generation.

---

## P1-A: LEAD MANAGEMENT — Complete & Stable

### Why First
Lead Management is 60% done. Mostly backend exists. Issues are data wiring bugs + mock data imports. Fixing this gives you a fully working Kanban with real data — the foundation everything else builds on.

---

### P1-A.1 — Remove Mock Data from LeadsPage (Cosmetic but Critical)

**Why:** LeadsPage imports `STAGES`, `PIPELINES`, `staff` from `mockData.ts`. These are hardcoded strings, not from DB. Stage filters show wrong stages. Staff list shows fake names. Tags show no colors.

| # | Task | File | Line | What To Do |
|---|------|------|------|------------|
| 1 | Remove mock imports | `LeadsPage.tsx` | 5 | Remove `STAGES`, `PIPELINES`, `staff`, `bookingLinks` from mockData import |
| 2 | Use store pipelines | `LeadsPage.tsx` | - | `const { pipelines, staff: storeStaff } = useCrmStore()` |
| 3 | Fix filter panel staff | `LeadsPage.tsx` | 274 | Replace mock `staff` with `useCrmStore().staff` |
| 4 | Fix AddLeadModal | `LeadsPage.tsx` | 141-155 | Pipeline/stage dropdowns use real `pipelines` from store |

---

### P1-A.2 — Filters → Server-Side API Query

**Why:** Currently clicking "Stage: Contacted" filter only filters the 200 leads loaded in memory. Any leads beyond 200 are invisible to the filter. Must send filter params to `GET /api/leads`.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Build query param builder | `LeadsPage.tsx` | `buildLeadsQuery(filters)` → URL param string |
| 2 | Re-fetch on filter change | `LeadsPage.tsx` | On any filter change: call `GET /api/leads?{params}` → replace local leads |
| 3 | Add filter params to backend | `leads.ts` line 11 | Support: `?assignedTo`, `?tag`, `?source`, `?dateFrom`, `?dateTo`, `?pipeline_id` |
| 4 | Tag filter requires JOIN | `leads.ts` | `JOIN lead_tags lt ON lt.lead_id = l.id AND lt.tag_id = $tag_id` |

---

### P1-A.3 — Pipeline CRUD (Admins Must Be Able to Create Pipelines)

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | `POST /api/pipelines` | `pipelines.ts` | Create pipeline for tenant |
| 2 | `PATCH /api/pipelines/:id` | `pipelines.ts` | Rename, change color |
| 3 | `DELETE /api/pipelines/:id` | `pipelines.ts` | Guard: no leads in pipeline. Soft delete. |
| 4 | Stage CRUD | `pipelines.ts` | POST/PATCH/DELETE stages, reorder endpoint |

---

### P1-A.4 — Relational Tags System

**Why:** Tags currently stored as `TEXT[]` on leads. Can't get color info. Can't do efficient SQL join filtering. Can't show tag lead counts.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Tags CRUD API | `backend/src/routes/tags.ts` (create) | `GET/POST/PATCH/DELETE /api/tags` |
| 2 | Lead tag endpoints | `leads.ts` | `POST /api/leads/:id/tags/:tagId`, `DELETE /api/leads/:id/tags/:tagId` |
| 3 | Load tags in store | `crmStore.ts` `initFromApi` | Add `GET /api/tags` to startup fetch |
| 4 | Register route | `index.ts` | `app.use('/api/tags', tagsRoutes)` |

---

### P1-A.5 — Lead Detail Panel → Load from API

**Why:** Notes, follow-ups, and activities shown in lead panel come from Zustand memory only. Page refresh = data gone. Must load from real API per lead.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Load notes on panel open | `LeadsPage.tsx` | When `selectedLead` changes: `GET /api/leads/:id/notes` |
| 2 | Load follow-ups on panel open | `LeadsPage.tsx` | `GET /api/leads/:id/followups` |
| 3 | Load activities on panel open | `LeadsPage.tsx` | `GET /api/leads/:id/activities` |

---

## P1-B: LEAD AUTOMATION — Workflow Engine Working End-to-End

### Why Second
The workflow engine backend is partially built. The frontend editor is visually complete. The gap is: editor can't load/save, uses fake data in dropdowns, and the engine doesn't evaluate conditions or execute WhatsApp actions.

---

### P1-B.1 — AutomationPage → Load Real Workflows

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Load workflows on mount | `AutomationPage.tsx` | `GET /api/workflows` → replace mock `initialWorkflows` array |
| 2 | Delete → API call | `AutomationPage.tsx` | `DELETE /api/workflows/:id` before removing from state |
| 3 | Toggle → API call | `AutomationPage.tsx` | `PATCH /api/workflows/:id` with `{ status }` |
| 4 | Navigate with real ID | `AutomationPage.tsx` | Edit button → `/automation/editor/:realUUID` |
| 5 | Remove mock logs | `AutomationPage.tsx` lines 101-105 | Delete `mockLogs` — show empty state when no real logs |

---

### P1-B.2 — WorkflowEditorPage → Load & Save (Most Critical Automation Task)

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Load workflow on mount | `WorkflowEditorPage.tsx` | If `id !== 'new'`: `GET /api/workflows/:id` → populate `nodes`, name, status |
| 2 | Save button → POST | `WorkflowEditorPage.tsx` | New workflow: `POST /api/workflows` → navigate to returned ID |
| 3 | Save button → PATCH | `WorkflowEditorPage.tsx` | Existing: `PATCH /api/workflows/:id` with `{ name, nodes, status, allow_reentry }` |
| 4 | Validate before save | `WorkflowEditorPage.tsx` | Must have ≥1 trigger node + ≥1 action node |
| 5 | Unsaved changes indicator | `WorkflowEditorPage.tsx` | Track `isDirty` state — show "Unsaved changes" warning |

---

### P1-B.3 — WorkflowEditorPage → Replace All Hardcoded Dropdowns

**Why:** Every config panel dropdown uses fake static data. Staff picker shows "Ranjith Kumar". Stage picker shows "New Leads". These bear no relation to the actual tenant's staff and pipelines in DB.

| # | Task | File | Line | What To Do |
|---|------|------|------|------------|
| 1 | Real staff options | `WorkflowEditorPage.tsx` | 147 | Delete `STAFF_OPTIONS`. Load from `GET /api/settings/staff`. Store `staff_id` UUID in config. |
| 2 | Real pipeline options | `WorkflowEditorPage.tsx` | 159 | Delete `PIPELINES`. Load from `GET /api/pipelines`. |
| 3 | Real stage options | `WorkflowEditorPage.tsx` | 148 | Delete `STAGES`. Derive from selected pipeline's `.stages[]`. Store `stage_id` UUID. |
| 4 | Real forms for meta trigger | `WorkflowEditorPage.tsx` | 233 | Load from `GET /api/forms`. Store `form_id` UUID. |
| 5 | Real WA templates | `WorkflowEditorPage.tsx` | 152 | Load from `GET /api/templates`. Store `template_id` UUID. |
| 6 | Remove all other static arrays | `WorkflowEditorPage.tsx` | 160-168 | `PAGES`, `EMAIL_TEMPLATES`, `CONTACT_LISTS`, `APPT_STATUSES` etc — replace with API or leave as static acceptably |

---

### P1-B.4 — Fix Trigger Condition Evaluation in Engine

**Why:** All active `stage_changed` workflows fire on every stage change regardless of which stage/pipeline was configured. A workflow set for "when stage changes to Closed Won in Sales Pipeline" fires even if lead moved to "Contacted" in any pipeline.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Store UUIDs not names | `WorkflowEditorPage.tsx` config panels | `stage_id`, `pipeline_id` must be UUIDs in node config |
| 2 | Evaluate conditions | `workflows.ts` `triggerWorkflows()` | Check `triggerNode.config.pipeline_id` and `stage_id` against lead data before executing |
| 3 | Make execution async | `workflows.ts` + `leads.ts` | Wrap `triggerWorkflows()` in `setImmediate()` — don't block HTTP response |

---

### P1-B.5 — Fix Workflow Actions

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | `internal_notify` → notifications table | `workflows.ts` line 199 | Insert into `notifications` not `lead_activities` |
| 2 | `send_whatsapp` stub | `workflows.ts` | Add case: check WABA connected → call Graph API or log 'WABA not configured' |
| 3 | `webhook_call` action | `workflows.ts` | Add case: `fetch(url, { method: 'POST', body: JSON.stringify(lead) })` |

---

## P1-C: LEAD GENERATION — Custom Forms First, Meta Second

### Why Third (and in this order)
Custom Forms have zero external dependencies — just your own backend. Meta Forms require a Facebook App, OAuth credentials, and webhook setup. Build Custom Forms first for a complete working lead capture path. Meta Forms after.

---

### P1-C.1 — Custom Forms → End-to-End Working

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Verify forms backend | `backend/src/routes/forms.ts` | Confirm GET, POST, PATCH, DELETE all exist and are tenant-scoped |
| 2 | Add slug generation | `forms.ts` POST handler | Auto-generate slug from name, check uniqueness |
| 3 | Public submission endpoint | `forms.ts` or `public.ts` | `POST /api/public/forms/:slug/submit` — NO auth. Validate fields. Create lead. Fire workflows. |
| 4 | Public form definition | `forms.ts` | `GET /api/public/forms/:slug` — returns field definitions (no auth) |
| 5 | Wire CustomFormsPage | `CustomFormsPage.tsx` | Remove mock array. Load from `GET /api/forms`. Real delete, clone. |
| 6 | Real share links | `CustomFormsPage.tsx` | `${VITE_PUBLIC_URL}/f/${form.slug}` |
| 7 | Wire form detail page | `CustomFormDetailPage.tsx` | Load from `GET /api/forms/:id` on mount. Save via `PATCH /api/forms/:id`. Real pipeline dropdowns. |

---

### P1-C.2 — Meta Forms → Full OAuth + Webhook

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Create integrations routes | `backend/src/routes/integrations.ts` (new) | All Meta + WABA integration endpoints |
| 2 | Meta OAuth URL | `integrations.ts` | `GET /api/integrations/meta/oauth-url` |
| 3 | Meta OAuth callback | `integrations.ts` | `GET /api/integrations/meta/callback` — exchange code, encrypt token, store |
| 4 | Meta pages fetch | `integrations.ts` | `GET /api/integrations/meta/pages` — call Graph API |
| 5 | Meta form subscription | `integrations.ts` | `POST /api/integrations/meta/pages/:id/subscribe` |
| 6 | Meta forms list | `integrations.ts` | `GET /api/integrations/meta/forms/:pageId` |
| 7 | Save selected forms | `integrations.ts` | `POST /api/integrations/meta/forms/select` |
| 8 | Meta webhook receiver | `backend/src/routes/webhooks.ts` (new) | `POST /api/webhooks/meta` — verify sig, respond 200, async process → create lead |
| 9 | Meta webhook verification | `webhooks.ts` | `GET /api/webhooks/meta` — challenge response |
| 10 | Wire MetaFormsPage | `MetaFormsPage.tsx` | Remove all mock. Connect OAuth, page list, form selection. |

---

### P1-C.3 — WhatsApp Lead Capture

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | WABA setup endpoint | `integrations.ts` | `POST /api/integrations/waba/setup` — validate + store credentials |
| 2 | WhatsApp webhook receiver | `webhooks.ts` | `POST /api/webhooks/whatsapp` — verify sig, async: find/create lead, create conversation + message |
| 3 | Wire WhatsAppSetupPage | `WhatsAppSetupPage.tsx` | Form calls `POST /api/integrations/waba/setup`. Show connection status. |

---

---

# P2 — SUPPORTING FEATURES
### Make P1 features production-grade. Build these during/after P1.

---

## P2.1 — RBAC Permissions on Every Route

**Why P2 not P1:** The app works functionally without RBAC but exposes all data to all users. Needed before inviting real staff members.

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | `checkPermission` middleware | `backend/src/middleware/permissions.ts` (new) | Factory: looks up user's permissions from DB, returns 403 if missing |
| 2 | Seed roles on tenant create | `auth.ts` `POST /api/auth/tenants` | Auto-create Admin/Manager/Agent roles with correct permission sets |
| 3 | Apply to all routes | all route files | Add `checkPermission('leads:view_all')` etc. to every route |
| 4 | `leads:view_own` filter | `leads.ts` | Auto-add `AND assigned_to = userId` when user only has view_own |
| 5 | Frontend `usePermission` hook | `frontend/src/hooks/usePermission.ts` (new) | Hide/disable buttons based on role |

---

## P2.2 — Security Headers & Rate Limiting

| # | Task | File | What To Do |
|---|------|------|------------|
| 1 | Install helmet | `index.ts` | `app.use(helmet())` |
| 2 | Install express-rate-limit | `index.ts` | 100 req/min authenticated, 20 req/min public, 10/15min on login |
| 3 | Harden CORS | `index.ts` line 21 | Only allow exact `FRONTEND_URL`, no wildcard |
| 4 | Encrypt stored secrets | `utils/crypto.ts` (new) | AES-256 for Meta/WABA access tokens before DB storage |
| 5 | Webhook signature verification | `webhooks.ts` | HMAC-SHA256 on all Meta/WABA incoming webhooks |

---

## P2.3 — Inbox Module (Conversations)

| # | Task | Priority | What To Do |
|---|------|----------|------------|
| 1 | Conversations API | HIGH | `GET/PATCH /api/conversations`, filters: mine/all/unread/unassigned/resolved |
| 2 | Messages API | HIGH | `GET /api/conversations/:id/messages`, `POST` to send |
| 3 | WABA outbound sending | HIGH | When staff sends from inbox: call WABA Graph API |
| 4 | Wire InboxPage.tsx | HIGH | Remove 100% mock data. Load conversations + messages from API. |
| 5 | Assign/resolve conversations | MEDIUM | PATCH status, PATCH assign |

---

## P2.4 — WhatsApp Templates Management

| # | Task | What To Do |
|---|------|------------|
| 1 | Templates API | `GET/POST/PATCH/DELETE /api/templates` — CRUD for message templates |
| 2 | WABA template sync | `POST /api/templates/sync` — fetch approved templates from Meta Graph API |
| 3 | Wire AutomationTemplatesPage | Load from `GET /api/templates` instead of mock |

---

## P2.5 — Staff Management Complete

| # | Task | What To Do |
|---|------|------------|
| 1 | Wire StaffPage.tsx | Load staff from API. Wire add/edit/deactivate to real API calls. |
| 2 | Staff invite via email | `POST /api/staff/invite` → generate token, send email. `POST /api/auth/setup-password` → first-time password. |
| 3 | Round-robin assignment | On lead create without `assigned_to`: cycle through active agents by DB counter |

---

## P2.6 — Environment Config & .env.example

| # | Task | What To Do |
|---|------|------------|
| 1 | Startup env validation | `backend/src/config.ts` — exit with error if required vars missing |
| 2 | Create `.env.example` | Root directory — document all required vars with descriptions |

---

---

# P3 — GROWTH FEATURES
### Real business value. Build after P1+P2 are stable.

---

## P3.1 — Calendar Module Complete

| Priority | Task |
|----------|------|
| HIGH | Complete calendar CRUD API — verify existing routes, add status transitions |
| HIGH | Booking links API — `GET/POST/PATCH/DELETE /api/calendar/booking-links` |
| HIGH | Availability slots API — per staff, per day-of-week |
| HIGH | Public booking endpoint — `POST /api/public/book/:id` — slot calc, race condition prevention, create lead + event |
| MEDIUM | Appointment reminders — BullMQ job N hours before event, send via WhatsApp/email |
| HIGH | Wire CalendarPage.tsx — load events from real API |

---

## P3.2 — Custom Fields Module

| Priority | Task |
|----------|------|
| HIGH | Custom fields CRUD API — `GET/POST/PATCH/DELETE /api/fields` |
| HIGH | Lead field values API — `GET/PATCH /api/leads/:id/fields` |
| HIGH | Wire FieldsPage.tsx — load/save from API |
| MEDIUM | Custom field variables in automation — `{%custom:slug%}` resolution at workflow execution |
| MEDIUM | Field mapping for forms and Meta — map source field names → CRM field IDs |

---

## P3.3 — Opportunities

| Priority | Task |
|----------|------|
| HIGH | `GET/POST/PATCH /api/opportunities` — tenant-scoped CRUD |
| HIGH | Wire "Create Opportunity" in lead detail panel → `POST /api/opportunities` |
| MEDIUM | Revenue forecast per stage column — `SUM(value * probability / 100)` in Kanban headers |

---

## P3.4 — Import / Export

| Priority | Task |
|----------|------|
| HIGH | `POST /api/leads/import` — CSV upload, column mapping, batch insert 500/tx, duplicate check |
| HIGH | `GET /api/leads/export` — stream CSV/XLSX with all fields |
| MEDIUM | Import UI — column mapping dialog, row preview with errors |

---

---

# P4 — POLISH & SCALE
### After the product is working and being used by real customers.

---

## P4.1 — WebSocket Real-Time

| Priority | Task |
|----------|------|
| CRITICAL for scale | Add Socket.io to backend. Auth middleware on connection. Org + user rooms. |
| CRITICAL for scale | Emit events: `lead:created`, `lead:stage_updated`, `conversation:new_message`, `notification:new` |
| CRITICAL for scale | Frontend Socket.io client — update Zustand store on real-time events |
| HIGH | Redis pub/sub for multi-instance Socket.io fanout |

---

## P4.2 — BullMQ Async Job Queue

| Priority | Task |
|----------|------|
| HIGH | Install BullMQ + Redis. Create worker. Move workflow execution to queue. |
| HIGH | Delay action support — re-enqueue with offset after delay node |
| HIGH | Retry logic — up to 3 retries with exponential backoff on failed actions |
| HIGH | Dead-letter queue — permanently failed jobs for manual inspection |
| MEDIUM | Move Meta/WhatsApp webhook processing to BullMQ jobs |

---

## P4.3 — Performance

| Priority | Task |
|----------|------|
| HIGH | Redis permission caching — `perms:{userId}` with 5-min TTL |
| HIGH | Cursor-based pagination for leads — replace OFFSET with keyset |
| HIGH | Composite DB indexes — `(tenant_id, stage_id)`, `(tenant_id, assigned_to)`, `(tenant_id, created_at)` |
| MEDIUM | Frontend: `react-virtual` for lead list virtualization (>100 items) |
| MEDIUM | Frontend: lazy load route chunks in `App.tsx` |

---

## P4.4 — Testing

| Priority | Task |
|----------|------|
| HIGH | Unit tests — auth flow, permission guard, workflow trigger matching, duplicate detection |
| HIGH | Integration tests — Supertest: lead CRUD, tenant isolation, RBAC enforcement |
| MEDIUM | E2E tests — Playwright: login → create lead → move stage → save workflow → logout |
| LOW | Load tests — k6: 500 concurrent users on lead list endpoint |

---

## P4.5 — Docker & CI/CD

| Priority | Task |
|----------|------|
| HIGH | `docker-compose.yml` — postgres, redis, backend, frontend in one command |
| HIGH | Seed script — `backend/src/db/seed.ts` — super admin + 1 test tenant |
| MEDIUM | GitHub Actions CI — run tests on PR, deploy to staging on merge to main |

---

---

# PRIORITY SUMMARY — ONE PAGE VIEW

| Priority | Sprint | What | Why |
|----------|--------|------|-----|
| **P0 — BLOCKERS** | Sprint 1 | Auth rewrite, DB migrations, soft delete, stage ID bug fix, Zod validation | Nothing is safe or reliable without these |
| **P1-A — Lead Management** | Sprint 2 | Remove mock data, fix filters → API, pipeline CRUD, relational tags, lead detail from API | Core product. Kanban must work with real data end-to-end. |
| **P1-B — Lead Automation** | Sprint 3 | Automation page real data, editor save/load, replace static dropdowns, fix condition evaluation, action execution fixes | Workflows already fire on backend — just need editor wired up |
| **P1-C.1 — Custom Forms** | Sprint 4 | Form backend complete, public submission endpoint, wire frontend to API, real share links | No external dependencies — fast win for lead capture |
| **P1-C.2 — Meta Forms** | Sprint 5 | OAuth flow, webhook receiver, lead creation from Meta, wire MetaFormsPage | Requires Facebook App credentials to test |
| **P1-C.3 — WhatsApp** | Sprint 5 | WABA setup, webhook receiver, inbound message → lead creation | Requires WABA credentials |
| **P2 — Supporting** | Sprint 6 | RBAC, security headers, rate limiting, encryption, Inbox, templates | Production-ready hardening |
| **P3 — Growth** | Sprint 7-8 | Calendar, Custom Fields, Opportunities, Import/Export | Expands platform capability |
| **P4 — Polish** | Sprint 9+ | WebSocket, BullMQ, Redis, performance, testing, Docker | Scale and quality |

---

> *DigyGo CRM Priority List v1.0 — Engineering Reference*
> *Generated from: PRD v1.0 + Full Codebase Audit (April 2026)*
> *Cross-reference: tasklist.md for in-depth per-task details*
