# DigyGo CRM — Complete Build Task List
## In-Depth Engineering Reference | Based on PRD v1.0 + Full Codebase Audit

> **Platform Status: ~35% complete toward a working product.**
> Last reviewed: April 2026
> Priorities: Lead Management → Lead Automation → Lead Generation

---

## HOW TO USE THIS FILE

- `[ ]` = Not started
- `[x]` = Completed
- `[~]` = In progress / partially done
- **Severity**: `CRITICAL` blocks everything · `HIGH` blocks the feature · `MEDIUM` degrades quality · `LOW` polish
- **Type**: `BROKEN` = exists but doesn't work · `MISSING` = doesn't exist at all · `WIRED` = works end-to-end
- Each task lists the **exact file**, **line number** (where applicable), and **what to change**

---

---

# SPRINT 1 — FOUNDATION
## Auth · Session · DB Migration · Soft Delete · Input Validation
### Must complete before any other sprint. Everything depends on this.

---

## S1.1 — Authentication & Session Rewrite

### Current State
- `backend/src/routes/auth.ts` line 34: JWT signed with **HS256** (`JWT_SECRET`), **7-day expiry**, no refresh token
- `frontend/src/lib/api.ts` line 3: `localStorage.getItem('digygo_token')` — token in **localStorage** (XSS-vulnerable)
- `backend/src/middleware/auth.ts`: only checks Bearer token, no session table, no revocation
- `frontend/src/App.tsx` line 48: `/dashboard` and all app routes have **zero auth guard** — accessible without login
- `users` table: no `refresh_token_hash` column, no `last_login_at` column

### Why It Matters
- localStorage token means any XSS attack steals the session permanently
- 7-day single token: stolen token valid for 7 days with no revocation path
- No protected routes: `/admin`, `/leads`, `/staff` all open without login

---

- [x] **S1.1.1** `CRITICAL` `MISSING` — Add columns to `users` table via migration
  - File: create `backend/src/db/migration_003_auth_sessions.sql`
  - Add: `refresh_token_hash VARCHAR(255)`, `last_login_at TIMESTAMPTZ`, `failed_login_attempts INTEGER DEFAULT 0`, `locked_until TIMESTAMPTZ`
  - Run migration and update `backend/src/db/migrate.ts` to include it

- [x] **S1.1.2** `CRITICAL` `BROKEN` — Rewrite `POST /api/auth/login` in `backend/src/routes/auth.ts`
  - Line 34: replace single long-lived JWT with **15-min access token** + **7-day refresh token**
  - Access token: JWT signed with `JWT_SECRET`, payload `{ userId, tenantId, role }`, `expiresIn: '15m'`
  - Refresh token: `crypto.randomBytes(64).toString('hex')`, store `bcrypt.hash(refreshToken, 10)` in `users.refresh_token_hash`
  - Set refresh token in **HttpOnly cookie**: `res.cookie('refreshToken', token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 7 * 24 * 3600 * 1000 })`
  - Return access token in response body only (NOT the refresh token)
  - Update `users.last_login_at = NOW()` on success
  - Reset `failed_login_attempts = 0` on success

- [x] **S1.1.3** `CRITICAL` `MISSING` — Create `POST /api/auth/refresh` in `backend/src/routes/auth.ts`
  - Read refresh token from `req.cookies.refreshToken`
  - If missing → 401 `{ error: 'No refresh token' }`
  - Query `SELECT refresh_token_hash FROM users WHERE id = ?`
  - `bcrypt.compare(cookie, hash)` — if mismatch → 401 + clear cookie
  - If valid: generate new access token (15-min) + new refresh token (rotate)
  - Update `refresh_token_hash` in DB with new hash
  - Set new cookie + return new access token
  - Install `cookie-parser` if not installed, add to `index.ts` middleware

- [x] **S1.1.4** `HIGH` `MISSING` — Create `POST /api/auth/logout` in `backend/src/routes/auth.ts`
  - Requires `requireAuth`
  - `UPDATE users SET refresh_token_hash = NULL WHERE id = $1`
  - `res.clearCookie('refreshToken')`
  - Return `{ success: true }`

- [x] **S1.1.5** `HIGH` `MISSING` — Add login rate limiting in `backend/src/routes/auth.ts`
  - Install `express-rate-limit`
  - On failed login: `UPDATE users SET failed_login_attempts = failed_login_attempts + 1`
  - If `failed_login_attempts >= 5`: set `locked_until = NOW() + INTERVAL '15 minutes'`
  - On login attempt: check `locked_until > NOW()` → return 429 with `{ error: 'Account locked', retryAfter: seconds }`

- [x] **S1.1.6** `CRITICAL` `MISSING` — Create `frontend/src/store/authStore.ts`
  - Zustand store with: `accessToken: string | null` (in memory, NOT localStorage), `currentUser: { id, tenantId, name, email, role, avatarUrl } | null`, `isAuthenticated: boolean`
  - Actions: `login(token, user)`, `logout()`, `setToken(token)`
  - On `logout()`: call `POST /api/auth/logout`, clear store state
  - **DO NOT** write token to localStorage anywhere

- [x] **S1.1.7** `CRITICAL` `BROKEN` — Rewrite `frontend/src/lib/api.ts`
  - Line 3: Remove `localStorage.getItem('digygo_token')`
  - Read token from `useAuthStore.getState().accessToken` instead
  - On 401 response: silently call `POST /api/auth/refresh` → get new access token → retry original request once
  - If refresh also returns 401: call `authStore.logout()` → `window.location.href = '/login'`
  - Remove the current line `localStorage.removeItem('digygo_token')` (line 17)

- [x] **S1.1.8** `CRITICAL` `MISSING` — Create `frontend/src/components/ProtectedRoute.tsx`
  - Reads `useAuthStore().isAuthenticated`
  - If false: `<Navigate to="/login" replace />`
  - If true: `<Outlet />`
  - Optionally accepts `requiredRole?: string` prop for role-gating

- [x] **S1.1.9** `CRITICAL` `BROKEN` — Wrap all app routes in `frontend/src/App.tsx`
  - Line 52: Change `<Route element={<AppLayout />}>` to `<Route element={<ProtectedRoute />}><Route element={<AppLayout />}>`
  - All routes under AppLayout (dashboard, leads, staff, admin, etc.) become protected
  - `/login` stays public
  - `/admin` and `/admin/create` should additionally check `role === 'super_admin'`

- [x] **S1.1.10** `CRITICAL` `BROKEN` — Wire `frontend/src/pages/LoginPage.tsx`
  - Call `POST /api/auth/login` with email + password
  - On success: call `authStore.login(data.token, data.user)` — store token in Zustand memory
  - On success: `navigate('/dashboard')`
  - On error: display inline error message
  - On mount: if already authenticated, redirect to `/dashboard`

- [x] **S1.1.11** `HIGH` `MISSING` — Add `GET /api/auth/me` session restore on app load
  - In `App.tsx` or root component: on mount, call `GET /api/auth/me`
  - If 401: clear auth state (not logged in)
  - If 200: populate `currentUser` in authStore
  - This handles page refresh — access token in memory is lost on refresh, so call refresh endpoint first, then `/me`

---

## S1.2 — Database Migration: All Missing Tables

### Current State
- `schema.sql` has: `tenants`, `users`, `company_settings`, `pipelines`, `pipeline_stages`, `leads`, `contacts`, `custom_forms`, `form_submissions`, `calendar_events`, `notifications`
- `migration_001`: `lead_notes`, `lead_followups`, `lead_activities`
- `migration_002`: `workflows`, `workflow_executions`, `workflow_execution_logs`

### Missing Tables (All 3 Priority Areas Blocked Without These)

- [x] **S1.2.1** `CRITICAL` `MISSING` — Create `backend/src/db/migration_004_core_tables.sql`
  - Create `tags` table:
    ```sql
    CREATE TABLE IF NOT EXISTS tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(7) NOT NULL DEFAULT '#94a3b8',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, name)
    );
    CREATE INDEX ON tags(tenant_id);
    ```
  - Create `lead_tags` junction table:
    ```sql
    CREATE TABLE IF NOT EXISTS lead_tags (
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (lead_id, tag_id)
    );
    CREATE INDEX ON lead_tags(lead_id);
    CREATE INDEX ON lead_tags(tag_id);
    ```
  - Create `conversations` table:
    ```sql
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
      assigned_to UUID REFERENCES users(id),
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      unread_count INTEGER NOT NULL DEFAULT 0,
      last_message_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX ON conversations(tenant_id, status);
    CREATE INDEX ON conversations(assigned_to);
    ```
  - Create `messages` table:
    ```sql
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      direction VARCHAR(10) NOT NULL,
      content TEXT,
      type VARCHAR(50) NOT NULL DEFAULT 'text',
      status VARCHAR(20) NOT NULL DEFAULT 'sent',
      wamid VARCHAR(255),
      is_note BOOLEAN NOT NULL DEFAULT false,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX ON messages(conversation_id, sent_at DESC);
    ```
  - Create `templates` table:
    ```sql
    CREATE TABLE IF NOT EXISTS templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'UTILITY',
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      status VARCHAR(20) NOT NULL DEFAULT 'approved',
      body TEXT NOT NULL,
      header TEXT,
      footer TEXT,
      buttons JSONB,
      variables JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX ON templates(tenant_id);
    ```
  - Create `meta_integrations` table:
    ```sql
    CREATE TABLE IF NOT EXISTS meta_integrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      token_expiry TIMESTAMPTZ,
      page_ids JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```
  - Create `meta_forms` table:
    ```sql
    CREATE TABLE IF NOT EXISTS meta_forms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      page_id VARCHAR(255) NOT NULL,
      page_name VARCHAR(255),
      form_id VARCHAR(255) NOT NULL,
      form_name VARCHAR(255),
      pipeline_id UUID REFERENCES pipelines(id),
      stage_id UUID REFERENCES pipeline_stages(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      leads_count INTEGER NOT NULL DEFAULT 0,
      last_sync_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX ON meta_forms(tenant_id);
    ```
  - Create `waba_integrations` table:
    ```sql
    CREATE TABLE IF NOT EXISTS waba_integrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      phone_number_id VARCHAR(255) NOT NULL,
      waba_id VARCHAR(255) NOT NULL,
      access_token TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```
  - Create `opportunities` table:
    ```sql
    CREATE TABLE IF NOT EXISTS opportunities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      value DECIMAL(15,2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'INR',
      pipeline_id UUID REFERENCES pipelines(id),
      stage_id UUID REFERENCES pipeline_stages(id),
      expected_close_date DATE,
      probability INTEGER DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      lost_reason TEXT,
      assigned_to UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX ON opportunities(tenant_id, lead_id);
    ```
  - Create `booking_links` table:
    ```sql
    CREATE TABLE IF NOT EXISTS booking_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      buffer_minutes INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, slug)
    );
    ```
  - Create `availability_slots` table:
    ```sql
    CREATE TABLE IF NOT EXISTS availability_slots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
      is_active BOOLEAN NOT NULL DEFAULT true
    );
    CREATE INDEX ON availability_slots(user_id);
    ```
  - Add missing columns to existing tables:
    ```sql
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_converted BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
    ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS redirect_url TEXT;
    ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS thank_you_message TEXT;
    ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
    ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#94a3b8';
    ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS win_probability INTEGER DEFAULT 0;
    ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_closed_won BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_closed_lost BOOLEAN NOT NULL DEFAULT false;
    ```

- [x] **S1.2.2** `HIGH` `MISSING` — Create RBAC tables in same migration or `migration_005_rbac.sql`
  ```sql
  CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
  );
  CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    UNIQUE(role_id, permission_key)
  );
  CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
  );
  CREATE INDEX ON role_permissions(role_id);
  CREATE INDEX ON user_roles(user_id);
  ```

- [x] **S1.2.3** `HIGH` `MISSING` — Seed default roles on tenant creation in `backend/src/routes/auth.ts`
  - In the `POST /api/auth/tenants` transaction (line 83+), after creating the tenant add:
  - Create role: `Admin` with ALL permission keys
  - Create role: `Manager` with all except `settings:manage`, `staff:manage`, billing keys
  - Create role: `Agent` with: `leads:view_own`, `leads:create`, `leads:edit`, `inbox:view_own`, `inbox:send`, `calendar:manage`
  - Assign the new admin user to the `Admin` role via `user_roles`
  - Full permission key list (from PRD §10.2): `leads:view_all`, `leads:view_own`, `leads:create`, `leads:edit`, `leads:delete`, `leads:export`, `leads:import`, `leads:assign`, `pipeline:manage`, `automation:view`, `automation:manage`, `inbox:view_all`, `inbox:view_own`, `inbox:send`, `calendar:view_all`, `calendar:manage`, `staff:view`, `staff:manage`, `settings:manage`, `reports:view`

- [x] **S1.2.4** `HIGH` `MISSING` — Update `migrate.ts` to run all migrations in order
  - File: `backend/src/db/migrate.ts`
  - Ensure migrations 001, 002, 003, 004, 005 all run in sequence
  - Add `IF NOT EXISTS` guards to all table creates (already done in SQL above)

---

## S1.3 — Soft Delete & Data Safety

- [x] **S1.3.1** `CRITICAL` `BROKEN` — Fix hard DELETE on leads in `backend/src/routes/leads.ts`
  - Line 136: Change `DELETE FROM leads WHERE id = $1 AND tenant_id = $2`
  - To: `UPDATE leads SET is_deleted = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`
  - Add `AND is_deleted = false` to ALL lead SELECT queries in same file (lines 16, 44, 104, 107)

- [x] **S1.3.2** `HIGH` `MISSING` — Add `is_deleted` filter to all lead queries
  - `GET /api/leads` line 15: add `AND l.is_deleted = false` to WHERE clause
  - `GET /api/leads/:id` line 44: add `AND l.is_deleted = false`
  - `PATCH /api/leads/:id` line 112: add `AND is_deleted = false`

---

## S1.4 — Input Validation (Zod)

- [x] **S1.4.1** `CRITICAL` `MISSING` — Install Zod and create schema files
  - Run: `cd backend && npm install zod`
  - Create `backend/src/schemas/lead.schema.ts`:
    ```ts
    import { z } from 'zod';
    export const CreateLeadSchema = z.object({
      name: z.string().min(1).max(255),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().max(30).optional(),
      source: z.string().max(50).optional(),
      pipeline_id: z.string().uuid().optional(),
      stage_id: z.string().uuid().optional(),
      assigned_to: z.string().uuid().optional(),
      notes: z.string().max(5000).optional(),
      tags: z.array(z.string()).optional(),
    });
    ```
  - Create `backend/src/schemas/workflow.schema.ts`
  - Create `backend/src/schemas/staff.schema.ts`
  - Create `backend/src/middleware/validate.ts`: middleware factory `validate(schema)` that runs `schema.parse(req.body)` and returns 400 on failure

- [x] **S1.4.2** `HIGH` `MISSING` — Apply Zod validation to leads routes
  - `POST /api/leads`: add `validate(CreateLeadSchema)` middleware before handler
  - `PATCH /api/leads/:id`: add `validate(UpdateLeadSchema)` middleware

- [x] **S1.4.3** `HIGH` `MISSING` — Phone normalization
  - Create `backend/src/utils/phone.ts`: function `normalizePhone(raw: string): string`
  - Strip spaces, dashes, brackets. If starts with `0`, replace with `+91`. If no country code, prepend `+91`.
  - Apply in `POST /api/leads` and `PATCH /api/leads/:id` before INSERT/UPDATE

---

---

# SPRINT 2 — LEAD MANAGEMENT COMPLETE
## Stage Change · Pipeline · Kanban · Filters · Tags · Lead Detail

---

## S2.1 — Lead Type & Stage ID Fix (Critical Data Bug)

### The Bug
`frontend/src/store/crmStore.ts` line 248: `moveLeadStage(id, newStage)` — `newStage` is a **stage name string** (e.g., `"Contacted"`).
`initFromApi()` line 388: leads mapped as `stage: stageName` — name string stored, UUID lost.
When DnD fires and calls `PATCH /api/leads/:id` with `{ stage_id: newStage }`, it sends stage name not UUID → backend query finds no matching stage → silent failure.

- [x] **S2.1.1** `CRITICAL` `BROKEN` — Update `Lead` interface in `frontend/src/data/mockData.ts`
  - Add `stageId: string` field alongside existing `stage: string` (keep stage for display name)
  - Add `pipelineId: string` field (already exists, verify it's populated)

- [x] **S2.1.2** `CRITICAL` `BROKEN` — Fix `initFromApi()` in `frontend/src/store/crmStore.ts`
  - Line 388: when mapping leads, populate both:
    ```ts
    stage: stageName,       // display name for UI
    stageId: l.stage_id,    // UUID for API calls
    pipelineId: l.pipeline_id,
    ```

- [x] **S2.1.3** `CRITICAL` `BROKEN` — Fix `moveLeadStage` in `frontend/src/store/crmStore.ts`
  - Change signature to `moveLeadStage(id: string, newStageId: string, newStageName: string)`
  - Update local state: `stage: newStageName, stageId: newStageId`
  - API call: `api.patch('/api/leads/' + id, { stage_id: newStageId })` — pass UUID not name

- [x] **S2.1.4** `CRITICAL` `BROKEN` — Fix DnD `onDragEnd` handler in `frontend/src/pages/LeadsPage.tsx`
  - Find the DnD drop handler (uses `@dnd-kit/core` `DragEndEvent`)
  - When lead dropped into new stage column: resolve the column's `stageId` UUID
  - Call `moveLeadStage(leadId, stageId, stageName)` with correct UUID

---

## S2.2 — Remove All Mock Data Imports from LeadsPage

- [x] **S2.2.1** `HIGH` `BROKEN` — Remove mock imports from `frontend/src/pages/LeadsPage.tsx`
  - Line 5: `import { STAGES, PIPELINES, Lead, staff, bookingLinks } from '@/data/mockData'`
  - Remove `STAGES`, `PIPELINES`, `staff`, `bookingLinks` from this import
  - Replace: `const { pipelines, staff: storeStaff, tags: storeTags } = useCrmStore()`
  - Replace all uses of mock `staff` with `storeStaff`
  - Replace all uses of mock `STAGES` / `PIPELINES` with data derived from `pipelines` store

- [x] **S2.2.2** `HIGH` `BROKEN` — Fix filter panel's `staff` reference in `LeadsPage.tsx`
  - Line 274: `[{ id: 'none', name: 'Assigned to None' }, ...staff.map(...)]`
  - Replace `staff` with `useCrmStore().staff`

- [x] **S2.2.3** `HIGH` `BROKEN` — Fix `AddLeadModal` pipeline/stage dropdowns
  - Ensure `pipelines` from Zustand store (loaded from API) used in dropdowns
  - When `pipelineId` changes, auto-populate stages from selected pipeline's `.stages[]`
  - Stage dropdown options must use `stage.id` as value and `stage.name` as label

---

## S2.3 — Filter Pills → API Query Params

### Current State
Filter pills in `LeadsPage.tsx` filter the in-memory `leads` array in Zustand. With 200 leads loaded, this works locally but misses leads not yet loaded. Proper server-side filtering required.

- [x] **S2.3.1** `HIGH` `BROKEN` — Convert filter state to API query builder
  - Create a `buildLeadsQuery(filters: FilterState): string` helper
  - Maps filter state to URL query params: `?stage=uuid&assignedTo=uuid&tag=uuid&dateFrom=ISO&dateTo=ISO&source=string&search=string`
  - On any filter change: call `GET /api/leads?{params}` and replace `leads` in local state

- [x] **S2.3.2** `HIGH` `BROKEN` — Extend `GET /api/leads` backend to support all filter params
  - File: `backend/src/routes/leads.ts` line 11
  - Add query params: `assignedTo`, `tag` (join lead_tags), `source`, `dateFrom` (created_at >=), `dateTo` (created_at <=), `pipeline_id`
  - For `tag` filter: join `lead_tags lt ON lt.lead_id = l.id AND lt.tag_id = $n`
  - All filters must include `AND l.is_deleted = false`

- [x] **S2.3.3** `MEDIUM` `MISSING` — Add cursor-based pagination to lead list
  - Replace `OFFSET` pagination (line 29) with keyset: `WHERE l.created_at < $cursor ORDER BY l.created_at DESC LIMIT 50`
  - Frontend: "Load more" button or intersection observer for infinite scroll
  - Return `meta: { nextCursor, total }` in response

---

## S2.4 — Tags System (Relational)

### Current State
Tags stored as `TEXT[]` on leads table. No tag metadata (color). Can't do SQL join-based filtering efficiently. No tag management UI wired to backend.

- [x] **S2.4.1** `HIGH` `MISSING` — Create `GET/POST/PATCH/DELETE /api/tags` endpoint
  - File: create `backend/src/routes/tags.ts`
  - `GET /api/tags` — list all org tags with lead count: `SELECT t.*, COUNT(lt.lead_id) AS lead_count FROM tags t LEFT JOIN lead_tags lt ON lt.tag_id = t.id WHERE t.tenant_id=$1 GROUP BY t.id`
  - `POST /api/tags` — create tag `{ name, color }`, validate unique name per tenant
  - `PATCH /api/tags/:id` — update name/color
  - `DELETE /api/tags/:id` — delete tag + cascade removes from lead_tags
  - Register in `backend/src/index.ts`: `app.use('/api/tags', tagsRoutes)`

- [x] **S2.4.2** `HIGH` `MISSING` — Create tag endpoints on leads
  - File: `backend/src/routes/leads.ts`
  - Add `POST /api/leads/:id/tags` — body `{ tag_id: uuid }` → `INSERT INTO lead_tags (lead_id, tag_id)` → log activity
  - Add `DELETE /api/leads/:id/tags/:tagId` → `DELETE FROM lead_tags WHERE lead_id=$1 AND tag_id=$2` → log activity
  - Add `GET /api/leads/:id/tags` → return tags with color/name for a lead

- [x] **S2.4.3** `HIGH` `MISSING` — Load tags in `initFromApi()` in `crmStore.ts`
  - Add `api.get('/api/tags')` to the `Promise.all` call
  - Map to `Tag[]` type in Zustand store
  - Tags store used in filter panel, lead card rendering, tag input modals

- [x] **S2.4.4** `MEDIUM` `MISSING` — Data migration: existing TEXT[] tags → lead_tags
  - In migration SQL: for each lead with non-empty `tags` array, create tag records and insert into `lead_tags`
  - After migration: `tags TEXT[]` column can remain for backward compat but stop writing to it

---

## S2.5 — Pipeline CRUD Endpoints

- [x] **S2.5.1** `HIGH` `MISSING` — Add pipeline management endpoints
  - File: `backend/src/routes/pipelines.ts`
  - `POST /api/pipelines` — create pipeline `{ name, color, is_default? }` for tenant
  - `PATCH /api/pipelines/:id` — update name, color, is_default
  - `DELETE /api/pipelines/:id` — check: if leads exist in this pipeline, return 409. Otherwise soft-delete or delete.
  - `POST /api/pipelines/:id/stages` — create stage `{ name, color, order_index }`
  - `PATCH /api/pipelines/:id/stages/:stageId` — update name, color, order_index, win_probability, is_closed_won, is_closed_lost
  - `DELETE /api/pipelines/:id/stages/:stageId` — guard: if leads in stage, return 409
  - `PATCH /api/pipelines/:id/stages/reorder` — body `{ stages: [{id, order_index}] }` — bulk reorder

---

## S2.6 — Lead Detail Panel — API-Driven

### Current State
Lead detail panel shows notes/followups/activities from Zustand in-memory store. Refreshing page loses all detail data.

- [x] **S2.6.1** `HIGH` `BROKEN` — Load lead notes from API when panel opens
  - In `LeadsPage.tsx` lead detail panel: when `selectedLead` changes, call `GET /api/leads/:id/notes`
  - Update local panel state with API results (not Zustand store)

- [x] **S2.6.2** `HIGH` `BROKEN` — Load follow-ups from API
  - Call `GET /api/leads/:id/followups` on panel open
  - Display with due date, completion status

- [x] **S2.6.3** `HIGH` `BROKEN` — Load activity timeline from API
  - Call `GET /api/leads/:id/activities` on panel open
  - Show created, stage_change, note, followup, assigned, tag_added events in chronological order

- [x] **S2.6.4** `MEDIUM` `MISSING` — Opportunities API + wire to lead detail
  - Create `backend/src/routes/opportunities.ts`
  - `GET /api/opportunities?leadId=uuid` — list for lead
  - `POST /api/opportunities` — create `{ lead_id, title, value, pipeline_id, stage_id, expected_close_date, probability }`
  - `PATCH /api/opportunities/:id` — update status (open/won/lost), value, close date
  - Wire "Create Opportunity" button in lead detail panel to `POST /api/opportunities`
  - Register: `app.use('/api/opportunities', opportunitiesRoutes)` in `index.ts`

---

---

# SPRINT 3 — LEAD AUTOMATION COMPLETE
## Workflow Engine · Editor Save/Load · Real Data Dropdowns · Execution Fixes

---

## S3.1 — AutomationPage → Real Data

### Current State
`AutomationPage.tsx` has `initialWorkflows` mock array (lines 57-99) used in `useState`. The `wfRecords` Zustand store starts empty. LogsModal correctly calls real API but workflow list doesn't.

- [x] **S3.1.1** `CRITICAL` `BROKEN` — Load workflows from API on mount
  - File: `frontend/src/pages/AutomationPage.tsx`
  - Add `useEffect(() => { api.get<WFRecord[]>('/api/workflows').then(data => { setWfRecords(data.map(mapApiToWFRecord)); }) }, [])`
  - Map API shape to `WFRecord`: `id`, `name`, `description`, `status`, `allow_reentry` → `allowReentry`, `total_contacts` → `totalContacts`, `completed`, `nodes`, `updated_at` → `lastUpdated`
  - Remove `initialWorkflows` mock array (lines 57-99) — replace with empty initial state `[]`

- [x] **S3.1.2** `HIGH` `BROKEN` — Wire Delete workflow to API
  - Current: `deleteWfRecord(id)` only updates Zustand
  - Add: `api.delete('/api/workflows/' + id)` before updating local state
  - On API error: show toast, do NOT remove from local state

- [x] **S3.1.3** `HIGH` `BROKEN` — Wire Toggle (active/inactive) to API
  - Current: `updateWfRecord(id, {status})` only updates Zustand
  - Add: `api.patch('/api/workflows/' + id, { status: newStatus })` 
  - Update local state only on API success

- [x] **S3.1.4** `HIGH` `BROKEN` — Wire Duplicate workflow to API
  - `POST /api/workflows` with copied workflow data (name + ' (Copy)', same nodes, status: 'inactive')
  - Add returned workflow to local list

- [x] **S3.1.5** `HIGH` `BROKEN` — Navigate to editor with real workflow ID
  - "Edit" button: `navigate('/automation/editor/' + wf.id)` — use real UUID not mock `wf-1`
  - "New Workflow" button: `navigate('/automation/editor/new')`

---

## S3.2 — WorkflowEditorPage → Load & Save

### Current State
`WorkflowEditorPage.tsx`: rich visual editor, all trigger/action config panels exist, but:
- Opening existing workflow: no API call to load nodes
- Save button: no API call to persist nodes
- All staff/pipeline/stage/template dropdowns: hardcoded static arrays

- [x] **S3.2.1** `CRITICAL` `MISSING` — Load workflow on editor mount
  - File: `frontend/src/pages/WorkflowEditorPage.tsx`
  - `const { id } = useParams()` already exists
  - Add `useEffect`:
    ```ts
    if (id && id !== 'new') {
      api.get<WFRecord>('/api/workflows/' + id).then(wf => {
        setNodes(wf.nodes);
        setWorkflowName(wf.name);
        setAllowReentry(wf.allowReentry);
        setWorkflowStatus(wf.status);
      });
    }
    ```
  - Show loading skeleton while fetching

- [x] **S3.2.2** `CRITICAL` `MISSING` — Wire Save button to API
  - Find Save/Publish button in `WorkflowEditorPage.tsx`
  - On click:
    ```ts
    if (id === 'new') {
      const created = await api.post('/api/workflows', { name, nodes, status, allow_reentry: allowReentry });
      navigate('/automation/editor/' + created.id, { replace: true });
    } else {
      await api.patch('/api/workflows/' + id, { name, nodes, status, allow_reentry: allowReentry });
    }
    toast.success('Workflow saved');
    ```
  - Validate: at least 1 trigger node and 1 action node before saving
  - Show "Unsaved changes" indicator when nodes differ from last saved state

---

## S3.3 — WorkflowEditorPage → Replace Static Dropdowns with Real API Data

### Current State
Lines 147-169 in `WorkflowEditorPage.tsx`: 15+ hardcoded static arrays used in config panel dropdowns.

- [x] **S3.3.1** `CRITICAL` `BROKEN` — Load real staff for `assign_staff` action config
  - Line 147: `const STAFF_OPTIONS = ['Ranjith Kumar', ...]` — DELETE this
  - Add `useEffect(() => api.get('/api/settings/staff').then(setStaffOptions), [])`
  - State: `staffOptions: { id: string; name: string }[]`
  - In `ActionConfigPanel` for `assign_staff`: render `staffOptions.map(s => <option value={s.id}>{s.name}</option>)`
  - Store `staff_id` UUID in node config (not name string)

- [x] **S3.3.2** `CRITICAL` `BROKEN` — Load real pipelines and stages for `change_stage` and trigger config
  - Line 148: `const STAGES = ['New Leads', ...]` — DELETE
  - Line 159: `const PIPELINES = ['1 to 1 Funnel', ...]` — DELETE
  - Add `useEffect(() => api.get('/api/pipelines').then(setPipelineOptions), [])`
  - State: `pipelineOptions: { id: string; name: string; stages: {id: string; name: string}[] }[]`
  - Pipeline dropdown: `pipelineOptions.map(p => <option value={p.id}>{p.name}</option>)`
  - Stage dropdown: derives from selected pipeline: `selectedPipeline?.stages.map(s => <option value={s.id}>{s.name}</option>)`
  - **Store UUIDs** in config: `{ pipeline_id: 'uuid', stage_id: 'uuid' }` — NOT name strings
  - This applies to: TriggerConfigPanel `stage_changed` (line 265), `change_stage` action config

- [x] **S3.3.3** `HIGH` `BROKEN` — Load real forms for `meta_form` trigger config
  - Line 233: `PAGES` and `FORMS` arrays — DELETE
  - Load from `GET /api/integrations/meta/pages` for pages
  - Load from `GET /api/forms` for custom forms
  - Pages dropdown uses real page_id; forms dropdown uses real form_id

- [x] **S3.3.4** `HIGH` `BROKEN` — Load real WhatsApp templates for `send_whatsapp` action
  - Line 152: `const WA_TEMPLATES = ['Webinar Welcome Message', ...]` — DELETE
  - Load from `GET /api/templates`
  - Template dropdown: `templates.map(t => <option value={t.id}>{t.name}</option>)`
  - Store `template_id` UUID in node config

- [x] **S3.3.5** `MEDIUM` `BROKEN` — Load real pipelines for `change_lead_quality` / pipeline filter dropdowns
  - Anywhere `PIPELINES` constant is used in config panels: replace with `pipelineOptions` state

---

## S3.4 — Workflow Engine Backend Fixes

- [x] **S3.4.1** `CRITICAL` `BROKEN` — Make workflow execution async (non-blocking)
  - File: `backend/src/routes/workflows.ts` and `leads.ts`
  - Currently `triggerWorkflows(...)` is awaited in the leads route (`leads.ts` line 79: `.catch(() => null)` but still blocking)
  - Change to: `setImmediate(() => triggerWorkflows(...).catch(console.error))`
  - This means `POST /api/leads` returns immediately; workflows execute in background

- [x] **S3.4.2** `HIGH` `BROKEN` — Fix `internal_notify` action to use `notifications` table
  - File: `backend/src/routes/workflows.ts` line 199
  - Currently inserts into `lead_activities` with prefix `[Automation]`
  - Change to: `INSERT INTO notifications (tenant_id, user_id, title, message, type) VALUES (...)`
  - `user_id`: if `node.config.staff_id` set, notify that user; else notify lead's `assigned_to`

- [x] **S3.4.3** `HIGH` `MISSING` — Add trigger condition evaluation
  - File: `backend/src/routes/workflows.ts` `triggerWorkflows()` function line 267
  - After finding matching `trigger_type`, evaluate `triggerNode.config` conditions:
    - If `config.pipeline_id` set: check `lead.pipeline_id === config.pipeline_id`
    - If `config.stage_id` set: check `lead.stage_id === config.stage_id`
    - If `config.source` set: check `lead.source === config.source`
  - Only execute workflow if ALL set conditions match

- [x] **S3.4.4** `HIGH` `MISSING` — Add `send_whatsapp` action execution stub
  - File: `backend/src/routes/workflows.ts` — add case in `executeNodes` switch
  - `case 'send_whatsapp':` — check if `waba_integrations` exists for tenant
  - If WABA connected: fetch template by `node.config.template_id`, replace variables, call Graph API
  - If not connected: log `status = 'skipped'`, `message = 'WABA not configured for this tenant'`
  - Variable replacement: `{%first_name%}` → `lead.name.split(' ')[0]`, `{%phone%}` → `lead.phone`, etc.

- [x] **S3.4.5** `MEDIUM` `MISSING` — Add `webhook_call` action execution
  - `case 'webhook_call':` — `const url = node.config.url as string`
  - `await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: lead.id, lead_name: lead.name, ...lead }) })`
  - Timeout: 10 seconds max. On timeout: `status = 'failed'`

- [x] **S3.4.6** `MEDIUM` `BROKEN` — Fix `delay` action (async workaround without BullMQ)
  - Current: logged as 'skipped'
  - Interim fix: use `setTimeout` to delay remaining actions in the execution chain
  - Note: this is not durable (app restart loses pending delays). Full BullMQ integration is Phase 2.
  - Mark as 'skipped' with message 'Delay queued for N minutes' — acceptable for now

---

## S3.5 — Workflow Execution Log — Frontend Wire

- [x] **S3.5.1** `WIRED` — Verify LogsModal calls real API ✓
  - `AutomationPage.tsx` `LogsModal` calls `GET /api/workflows/:id/logs` ✓
  - Returns real execution data with step-level logs ✓
  - Only issue: mock log rows `mockLogs` (lines 101-105) — ensure they're NOT rendered when real API returns data
  - Remove `mockLogs` fallback, show empty state if no executions

---

---

# SPRINT 4 — LEAD GENERATION: CUSTOM FORMS
## Form Builder · Public Submission → Lead Creation · Share Link · Embed Code

---

## S4.1 — Custom Forms Backend

- [x] **S4.1.1** `CRITICAL` `MISSING` — Verify and complete `backend/src/routes/forms.ts`
  - Read the file to confirm what exists. Expected endpoints:
  - `GET /api/forms` — list all forms for tenant
  - `POST /api/forms` — create form `{ name, fields[], pipeline_id, stage_id }` → auto-generate slug
  - `GET /api/forms/:id` — get single form with fields
  - `PATCH /api/forms/:id` — update name, fields, pipeline_id, stage_id, is_active
  - `DELETE /api/forms/:id` — soft delete (set is_active = false) or hard delete if no submissions

- [x] **S4.1.2** `CRITICAL` `MISSING` — Auto-generate slug on form create
  - In `POST /api/forms` handler: `slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')`
  - Check uniqueness: `SELECT id FROM custom_forms WHERE tenant_id=$1 AND slug=$2`
  - If conflict: append `-2`, `-3`, etc.
  - Store in `custom_forms.slug`

- [x] **S4.1.3** `CRITICAL` `MISSING` — Create public form submission endpoint
  - File: add to `backend/src/routes/forms.ts` (or separate `backend/src/routes/public.ts`)
  - `POST /api/public/forms/:slug/submit` — **NO `requireAuth` middleware**
  - `GET /api/public/forms/:slug` — returns form definition (field labels, types, order) for public render — NO auth
  - Submission handler:
    1. Find form by `slug` — return 404 if not found or `is_active = false`
    2. Increment `view_count` on GET, `submission_count` on POST
    3. Validate required fields per form's `fields` JSONB definition
    4. Map submitted data to lead fields: name, email, phone extracted; others → `custom_fields JSONB`
    5. Duplicate check: `SELECT id FROM leads WHERE (email=$1 OR phone=$2) AND tenant_id=$3 AND is_deleted=false`
    6. Create lead: `INSERT INTO leads (tenant_id, name, email, phone, source, pipeline_id, stage_id)` with `source = 'custom_form'`
    7. Create `form_submissions` record
    8. Call `triggerWorkflows('lead_created', lead, tenantId, 'system')`
    9. Return: `{ success: true, message: form.thank_you_message ?? 'Thank you!' }` or redirect to `redirect_url`
  - Register: `app.use('/api/public', publicRoutes)` — this route group has NO auth middleware

- [x] **S4.1.4** `HIGH` `MISSING` — Create embed script generator endpoint
  - `GET /api/forms/:id/embed` (authenticated)
  - Returns:
    ```json
    {
      "shareLink": "https://app.digygocrm.com/f/{slug}",
      "iframeCode": "<iframe src='...' width='100%' height='600'></iframe>",
      "scriptCode": "<script src='https://app.digygocrm.com/embed.js' data-form='{slug}'></script>"
    }
    ```
  - `VITE_PUBLIC_URL` env var used to construct the URL

---

## S4.2 — CustomFormsPage → Real API

- [x] **S4.2.1** `CRITICAL` `BROKEN` — Wire `CustomFormsPage.tsx` to real API
  - Remove `defaultForms` mock array (lines 21-40) and `useState(defaultForms)`
  - Replace with: `const [forms, setForms] = useState<CustomForm[]>([])`
  - Add `useEffect(() => api.get<CustomForm[]>('/api/forms').then(setForms), [])`
  - Map API response to `CustomForm` type (add `slug` to interface)
  - `handleDelete`: call `DELETE /api/forms/:id` → remove from local state on success
  - `handleClone`: call `POST /api/forms` with copied data → add returned form to list

- [x] **S4.2.2** `HIGH` `BROKEN` — Fix share link and embed code to use real slug
  - Currently hardcoded: `shareLink: 'https://digygocrm.com/f/contact-us'`
  - Replace with: `${import.meta.env.VITE_PUBLIC_URL}/f/${form.slug}`
  - Embed code: `<script src="${VITE_PUBLIC_URL}/embed.js" data-form="${form.slug}"></script>`

- [x] **S4.2.3** `HIGH` `MISSING` — Add "New Form" modal with create form API call
  - Modal: form name + pipeline selector + stage selector (both from `GET /api/pipelines`)
  - On save: `POST /api/forms` → add to list → navigate to `/lead-generation/custom-forms/:id`

---

## S4.3 — CustomFormDetailPage → Real API

- [x] **S4.3.1** `HIGH` `BROKEN` — Load form from API on mount
  - File: `frontend/src/pages/CustomFormDetailPage.tsx`
  - Add `useEffect(() => api.get('/api/forms/' + id).then(setForm), [id])`
  - Populate: form name, fields array, selected pipeline_id, selected stage_id

- [x] **S4.3.2** `HIGH` `BROKEN` — Wire save button to API
  - Call `PATCH /api/forms/:id` with `{ name, fields, pipeline_id, stage_id, is_active }`
  - Show success toast on save

- [x] **S4.3.3** `HIGH` `BROKEN` — Pipeline/stage dropdowns in form builder use real data
  - Load from `GET /api/pipelines`
  - Pipeline select → auto-populate stage select

---

---

# SPRINT 5 — LEAD GENERATION: META FORMS + WHATSAPP
## Meta OAuth · Webhook Receiver · Lead Creation · WhatsApp Setup

---

## S5.1 — Meta OAuth Integration

- [x] **S5.1.1** `HIGH` `MISSING` — Create `backend/src/routes/integrations.ts`
  - Register: `app.use('/api/integrations', integrationsRoutes)` in `index.ts`
  - All routes under `requireAuth`

- [x] **S5.1.2** `HIGH` `MISSING` — `GET /api/integrations/meta/status`
  - Query `meta_integrations` for current tenant
  - Return: `{ connected: boolean, tokenExpiry?, connectedPages: [] }`

- [x] **S5.1.3** `HIGH` `MISSING` — `GET /api/integrations/meta/oauth-url`
  - Build and return Meta OAuth URL:
    ```
    https://www.facebook.com/v17.0/dialog/oauth?
      client_id={META_APP_ID}
      &redirect_uri={WEBHOOK_BASE_URL}/api/integrations/meta/callback
      &scope=leads_retrieval,pages_read_engagement,pages_show_list
      &state={tenantId}
    ```
  - Requires `META_APP_ID` env var

- [x] **S5.1.4** `HIGH` `MISSING` — `GET /api/integrations/meta/callback` (OAuth redirect handler)
  - Receives `?code=&state=tenantId` from Meta redirect
  - Exchange code for short-lived token: `POST /oauth/access_token`
  - Exchange short-lived for long-lived (60-day): `GET /oauth/access_token?grant_type=fb_exchange_token`
  - Encrypt token with AES-256 before storage (use `ENCRYPTION_KEY` env var, `crypto.createCipheriv`)
  - `UPSERT INTO meta_integrations (tenant_id, access_token, token_expiry)` 
  - Redirect to frontend: `{FRONTEND_URL}/lead-generation/meta-forms?connected=true`

- [x] **S5.1.5** `HIGH` `MISSING` — `GET /api/integrations/meta/pages`
  - Decrypt stored token for tenant
  - `GET https://graph.facebook.com/v17.0/me/accounts?access_token={token}`
  - Return page list: `{ id, name, category }`

- [x] **S5.1.6** `HIGH` `MISSING` — `POST /api/integrations/meta/pages/:pageId/subscribe`
  - `POST https://graph.facebook.com/v17.0/{pageId}/subscribed_apps`
  - Body: `{ subscribed_fields: ['leadgen'], access_token: pageAccessToken }`
  - Store `pageId` in `meta_integrations.page_ids` JSONB array

- [x] **S5.1.7** `HIGH` `MISSING` — `GET /api/integrations/meta/forms/:pageId`
  - `GET https://graph.facebook.com/v17.0/{pageId}/leadgen_forms?access_token={token}`
  - Return form list: `{ id, name, status }`

- [x] **S5.1.8** `HIGH` `MISSING` — `POST /api/integrations/meta/forms/select`
  - Body: `{ forms: [{ page_id, form_id, form_name, page_name, pipeline_id?, stage_id? }] }`
  - `UPSERT INTO meta_forms` for each selected form
  - Set `is_active = true` for selected, `is_active = false` for deselected

- [x] **S5.1.9** `HIGH` `MISSING` — `DELETE /api/integrations/meta/disconnect`
  - Delete from `meta_integrations` for tenant
  - Delete all `meta_forms` for tenant
  - Return `{ success: true }`

---

## S5.2 — Meta Webhook Receiver

- [x] **S5.2.1** `CRITICAL` `MISSING` — Create `backend/src/routes/webhooks.ts`
  - Register in `index.ts` **WITHOUT** `requireAuth`: `app.use('/api/webhooks', webhookRoutes)`

- [x] **S5.2.2** `CRITICAL` `MISSING` — `GET /api/webhooks/meta` — Meta verification challenge
  - Meta sends: `?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE`
  - Verify `hub.verify_token === process.env.META_WEBHOOK_VERIFY_TOKEN`
  - Return `hub.challenge` as plain text response (not JSON)
  - Add `META_WEBHOOK_VERIFY_TOKEN` to env vars

- [x] **S5.2.3** `CRITICAL` `MISSING` — `POST /api/webhooks/meta` — Lead form webhook
  - Step 1: Immediately respond `res.status(200).send('EVENT_RECEIVED')` (Meta requires < 5 seconds)
  - Step 2: Verify signature:
    ```ts
    const sig = req.headers['x-hub-signature-256'] as string;
    const expected = 'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(JSON.stringify(req.body)).digest('hex');
    if (sig !== expected) return; // silently ignore invalid
    ```
  - Step 3: Parse payload → extract `leadgen_id`, `page_id`, `form_id`
  - Step 4: `setImmediate(() => processMetaWebhook(payload))` — async processing
  - Step 5 (processMetaWebhook):
    - Find tenant by `page_id` → join `meta_integrations` → `meta_forms`
    - Fetch full lead: `GET https://graph.facebook.com/v17.0/{leadgen_id}?fields=full_data&access_token={token}`
    - Parse: extract name, email, phone from field_data array
    - Duplicate check: `SELECT id FROM leads WHERE (email=$1 OR phone=$2) AND tenant_id=$3 AND is_deleted=false`
    - If new: `INSERT INTO leads (tenant_id, name, email, phone, source='meta_form', source_ref=form_id, pipeline_id, stage_id)`
    - Log activity, fire `triggerWorkflows('lead_created', lead, tenantId, 'webhook')`
    - Increment `meta_forms.leads_count`, update `last_sync_at`

---

## S5.3 — MetaFormsPage → Real API

- [x] **S5.3.1** `HIGH` `BROKEN` — Remove all mock data from `MetaFormsPage.tsx`
  - Delete: `MOCK_PAGES` (line 33), `MOCK_FORMS` (line 38), `MOCK_CONTACTS` (line 48)
  - Load: `GET /api/integrations/meta/status` on mount → show "Connect" button if not connected
  - If connected: load `GET /api/integrations/meta/pages`
  - Form list: load from `GET /api/forms?source=meta` or directly from `meta_forms` table via API

- [x] **S5.3.2** `HIGH` `BROKEN` — Wire "Connect Meta Account" button
  - Click → `GET /api/integrations/meta/oauth-url` → `window.location.href = oauthUrl`
  - On return with `?connected=true`: show success toast, reload page state

- [x] **S5.3.3** `HIGH` `BROKEN` — Wire page subscription toggles
  - Toggle → `POST /api/integrations/meta/pages/:pageId/subscribe`

- [x] **S5.3.4** `HIGH` `BROKEN` — Wire form selection
  - Select forms UI → `POST /api/integrations/meta/forms/select`

---

## S5.4 — WhatsApp Lead Capture

- [x] **S5.4.1** `HIGH` `MISSING` — `POST /api/integrations/waba/setup`
  - Body: `{ phone_number_id, waba_id, access_token }`
  - Validate credentials: `GET https://graph.facebook.com/v17.0/{phone_number_id}?access_token={token}`
  - If valid: encrypt token, `UPSERT INTO waba_integrations`
  - Return `{ success: true, status: 'active' }`

- [x] **S5.4.2** `HIGH` `MISSING` — `GET /api/integrations/waba/status`
  - Return `{ connected: boolean, phoneNumberId?, wabaId? }` for tenant

- [x] **S5.4.3** `HIGH` `MISSING` — `GET /api/webhooks/whatsapp` — WABA verification challenge
  - Same pattern as Meta: verify token, return challenge

- [x] **S5.4.4** `HIGH` `MISSING` — `POST /api/webhooks/whatsapp` — Inbound message
  - Respond 200 immediately
  - Verify HMAC-SHA256 signature
  - Parse: extract `wa_id` (phone), message body, `wamid`, timestamp, message type
  - `setImmediate(() => processWhatsAppMessage(payload))` async
  - processWhatsAppMessage:
    1. Find tenant via `waba_integrations.phone_number_id`
    2. Find/create lead: `SELECT id FROM leads WHERE phone=$1 AND tenant_id=$2 AND is_deleted=false`
    3. If not found: `INSERT INTO leads (name=phone, phone, source='whatsapp', tenant_id)` + fire `lead_created` workflows
    4. Find/create conversation: `SELECT id FROM conversations WHERE lead_id=$1 AND channel='whatsapp' AND status!='resolved'`
    5. If not found: `INSERT INTO conversations (tenant_id, lead_id, channel='whatsapp')`
    6. `INSERT INTO messages (conversation_id, tenant_id, lead_id, direction='inbound', content, wamid, type)`
    7. `UPDATE conversations SET unread_count = unread_count + 1, last_message_at = NOW()`
    8. Fire `triggerWorkflows('inbound_message', lead, tenantId, 'webhook')`

- [x] **S5.4.5** `HIGH` `BROKEN` — Wire `WhatsAppSetupPage.tsx` to API
  - Remove any mock data
  - Load `GET /api/integrations/waba/status` on mount
  - Credentials form submit → `POST /api/integrations/waba/setup`
  - Show connected status with phone number on success

---

---

# SPRINT 6 — RBAC & SECURITY
## Permission Guards · Rate Limiting · Security Headers · Encryption

---

## S6.1 — RBAC Middleware

- [x] **S6.1.1** `CRITICAL` `MISSING` — Create `checkPermission` middleware
  - File: `backend/src/middleware/permissions.ts`
  ```ts
  export function checkPermission(key: string) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { userId, role } = req.user!;
      if (role === 'super_admin') { next(); return; }
      // Check from DB (add Redis cache later)
      const result = await query(
        `SELECT rp.permission_key FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         WHERE ur.user_id = $1 AND rp.permission_key = $2`,
        [userId, key]
      );
      if (result.rows.length === 0) {
        res.status(403).json({ error: 'Forbidden', required: key });
        return;
      }
      next();
    };
  }
  ```

- [x] **S6.1.2** `HIGH` `MISSING` — Apply `checkPermission` to all lead routes
  - `GET /api/leads`: `checkPermission('leads:view_all')` OR add `leads:view_own` logic
  - `POST /api/leads`: `checkPermission('leads:create')`
  - `PATCH /api/leads/:id`: `checkPermission('leads:edit')`
  - `DELETE /api/leads/:id` (soft): `checkPermission('leads:delete')`

- [x] **S6.1.3** `HIGH` `MISSING` — Implement `leads:view_own` data filter
  - If user has `leads:view_own` but NOT `leads:view_all`:
  - Auto-add `AND l.assigned_to = $user_id` to all lead queries

- [x] **S6.1.4** `HIGH` `MISSING` — Apply `checkPermission` to all routes
  - Workflows: `automation:view` (GET), `automation:manage` (POST/PATCH/DELETE)
  - Staff: `staff:view` (GET), `staff:manage` (POST/PATCH)
  - Settings: `settings:manage`
  - Calendar: `calendar:view_all` or own, `calendar:manage`
  - Pipelines: `pipeline:manage`

- [x] **S6.1.5** `MEDIUM` `MISSING` — Frontend `usePermission` hook
  - File: `frontend/src/hooks/usePermission.ts`
  - Map `currentUser.role` to a set of known permission keys
  - `usePermission('leads:delete')` → returns `boolean`
  - Use to hide/disable Delete buttons, Export, Staff management, Settings links

---

## S6.2 — Rate Limiting & Security Headers

- [x] **S6.2.1** `HIGH` `MISSING` — Add global rate limiter
  - Install `express-rate-limit`
  - File: `backend/src/index.ts`
  - Add: `app.use(rateLimit({ windowMs: 60000, max: 100, message: { error: 'Too many requests' } }))`
  - Separate stricter limit for `/api/auth/login`: 10 req per 15 minutes per IP

- [x] **S6.2.2** `HIGH` `MISSING` — Add security headers
  - Install `helmet`
  - File: `backend/src/index.ts`
  - Add: `app.use(helmet())` — sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
  - Configure CSP to allow your frontend origin and Meta Graph API

- [x] **S6.2.3** `HIGH` `BROKEN` — Harden CORS
  - File: `backend/src/index.ts` line 21
  - Change from single `origin: process.env.FRONTEND_URL ?? 'http://localhost:5173'`
  - To: `origin: (origin, cb) => { const allowed = [process.env.FRONTEND_URL!]; cb(null, allowed.includes(origin!)); }`
  - In production: never allow `*`

- [x] **S6.2.4** `HIGH` `MISSING` — AES-256 encryption for stored secrets
  - File: create `backend/src/utils/crypto.ts`
  - Functions: `encrypt(text: string): string` and `decrypt(text: string): string`
  - Use `crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)`
  - Apply `encrypt()` before storing Meta/WABA tokens, apply `decrypt()` when reading them

---

## S6.3 — Environment Config Validation

- [x] **S6.3.1** `HIGH` `MISSING` — Create `backend/src/config.ts`
  ```ts
  const required = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) { console.error('Missing env vars:', missing); process.exit(1); }
  ```
  - Import in `index.ts` before anything else

- [x] **S6.3.2** `HIGH` `MISSING` — Create `.env.example` in root
  ```
  DATABASE_URL=postgresql://user:pass@localhost:5432/digygocrm
  JWT_SECRET=your-secret-here-min-64-chars
  FRONTEND_URL=http://localhost:5173
  PORT=4000
  META_APP_ID=
  META_APP_SECRET=
  META_WEBHOOK_VERIFY_TOKEN=
  ENCRYPTION_KEY=
  WEBHOOK_BASE_URL=https://your-domain.com
  SMTP_HOST=
  SMTP_PORT=587
  SMTP_USER=
  SMTP_PASS=
  ```

---

---

# REMAINING MODULES
## These come after the 3 core priorities are stable

---

## M1 — Inbox Module (Conversations)

- [ ] **M1.1** `HIGH` `MISSING` — Create `backend/src/routes/conversations.ts`
  - `GET /api/conversations` — with filters: `?status=open|resolved`, `?assigned=mine|all|unassigned`, `?unread=true`, paginated
  - `GET /api/conversations/:id/messages` — paginated, newest first
  - `POST /api/conversations/:id/messages` — send message (calls WABA API if channel=whatsapp)
  - `PATCH /api/conversations/:id/assign` — assign to staff
  - `PATCH /api/conversations/:id/status` — open/resolved/pending
  - `POST /api/conversations/:id/notes` — internal note (is_note=true)

- [ ] **M1.2** `CRITICAL` `BROKEN` — Wire `InboxPage.tsx` to real API
  - Remove 100% mock conversation/message data
  - Load conversations from `GET /api/conversations`
  - Load messages on conversation select from `GET /api/conversations/:id/messages`
  - Send message via `POST /api/conversations/:id/messages`

- [ ] **M1.3** `HIGH` `MISSING` — Outbound WhatsApp message from inbox
  - When staff sends from inbox: check if conversation channel = 'whatsapp'
  - Call WABA API: `POST https://graph.facebook.com/v17.0/{phone_number_id}/messages`
  - Store sent message, update conversation unread_count = 0

---

## M2 — WebSocket (Real-Time)

- [ ] **M2.1** `CRITICAL` `MISSING` — Add Socket.io to backend
  - Install `socket.io`
  - File: `backend/src/index.ts` — create http server, attach Socket.io
  - Auth middleware on connection: verify JWT from `socket.handshake.auth.token`
  - On connect: join rooms `org:{tenantId}` and `user:{userId}`

- [ ] **M2.2** `CRITICAL` `MISSING` — Emit events from all write operations
  - After `POST /api/leads` → emit `lead:created` to `org:{tenantId}` room
  - After `PATCH /api/leads/:id` stage change → emit `lead:stage_updated`
  - After `POST /api/conversations/:id/messages` → emit `conversation:new_message`
  - After workflow notification → emit `notification:new` to `user:{userId}` room

- [ ] **M2.3** `HIGH` `MISSING` — Frontend Socket.io client
  - Install `socket.io-client` in frontend
  - Create `frontend/src/lib/socket.ts` — singleton connection with auth token
  - Connect on auth, disconnect on logout
  - Handle events: `lead:created`, `lead:stage_updated` → update Zustand store
  - Handle `notification:new` → increment notification bell badge

---

## M3 — Calendar Module

- [ ] **M3.1** `HIGH` `BROKEN` — Verify and complete calendar routes
  - Read `backend/src/routes/calendar.ts` — confirm: GET list, POST create, PATCH status
  - `GET /api/calendar` must filter by `assigned_to` for agents (view_own), all for admins/managers
  - `PATCH /api/calendar/:id/status` → trigger workflow: `appointment_completed`, `appointment_cancelled`, `appointment_noshow`

- [ ] **M3.2** `HIGH` `MISSING` — Booking links API
  - `GET/POST/PATCH/DELETE /api/calendar/booking-links`
  - `GET /api/calendar/availability/:userId` — get weekly availability
  - `PATCH /api/calendar/availability/:userId` — update availability slots

- [ ] **M3.3** `HIGH` `MISSING` — Public booking endpoint
  - `GET /api/public/book/:bookingLinkId/slots?date=YYYY-MM-DD` — returns available slots
  - Algorithm: fetch `availability_slots` for staff → generate time slots → subtract existing `calendar_events` → apply buffer_minutes
  - `POST /api/public/book/:bookingLinkId` — no auth, create lead + calendar_event, send confirmation

- [ ] **M3.4** `HIGH` `BROKEN` — Wire `CalendarPage.tsx` to real API
  - Load events from `GET /api/calendar`
  - Remove mock calendar events from crmStore/mockData

---

## M4 — Staff Management Complete

- [ ] **M4.1** `HIGH` `BROKEN` — Wire `StaffPage.tsx` to real API
  - Load staff from `GET /api/settings/staff` (already exists) ✓
  - Add staff form → `POST /api/settings/staff`
  - Edit staff → `PATCH /api/settings/staff/:id`
  - Deactivate → `PATCH /api/settings/staff/:id` with `{ is_active: false }`

- [ ] **M4.2** `MEDIUM` `MISSING` — Staff invite via email
  - `POST /api/staff/invite` — generate 48-hr token, store in DB, send email with setup link
  - `POST /api/auth/setup-password` — accepts invite token, sets password, logs in

- [ ] **M4.3** `MEDIUM` `MISSING` — Round-robin lead assignment
  - On `POST /api/leads`: if `assigned_to` not specified, check for round-robin config
  - Use Redis counter `INCR rr:{tenantId}` → modulo active agents count
  - Fallback without Redis: use DB counter in `tenants` table

---

## M5 — Custom Fields Module

- [ ] **M5.1** `HIGH` `MISSING` — Custom fields CRUD API
  - Create `backend/src/routes/fields.ts`
  - `GET /api/fields` — list all custom field definitions for tenant
  - `POST /api/fields` — create field `{ name, slug, type, is_required, options, order_index }`
  - `PATCH /api/fields/:id` — update field definition
  - `DELETE /api/fields/:id` — delete field + all associated `lead_field_values`

- [ ] **M5.2** `HIGH` `MISSING` — Lead field values API
  - `GET /api/leads/:id/fields` — get all custom field values for lead
  - `PATCH /api/leads/:id/fields` — body `{ field_id: value, ... }` — upsert into `lead_field_values`

- [ ] **M5.3** `HIGH` `BROKEN` — Wire `FieldsPage.tsx` to real API
  - Load custom fields from `GET /api/fields`
  - Create/edit/delete fields via API

---

## M6 — Performance & Infrastructure

- [ ] **M6.1** `HIGH` `MISSING` — Add Redis for permission caching
  - Install `ioredis`
  - In `checkPermission` middleware: cache `perms:{userId}` for 5 minutes
  - Invalidate cache on role/permission change

- [ ] **M6.2** `HIGH` `MISSING` — BullMQ for async job queue
  - Install `bullmq`
  - Create `backend/src/queue/worker.ts`
  - Move `triggerWorkflows` execution into a BullMQ job
  - Move `processMetaWebhook` and `processWhatsAppMessage` into BullMQ jobs
  - Enables: delay actions, retry on failure, dead-letter queue

- [ ] **M6.3** `MEDIUM` `MISSING` — Docker Compose for local development
  - Create `docker-compose.yml` with: postgres 15, redis, backend (port 4000), frontend (port 5173)
  - Create `backend/src/db/seed.ts` — creates super admin + 1 test tenant with sample data

- [ ] **M6.4** `MEDIUM` `MISSING` — CSV Import/Export
  - `POST /api/leads/import` — multipart CSV upload, parse, column mapping, batch insert 500/tx
  - `GET /api/leads/export?format=csv` — stream all leads as CSV with standard + custom fields

---

---

# QUICK REFERENCE — FILE CHANGE MAP

| File | Status | Changes Needed |
|------|--------|----------------|
| `backend/src/routes/auth.ts` | BROKEN | Refresh tokens, HttpOnly cookie, logout, rate limiting |
| `backend/src/routes/leads.ts` | PARTIAL | Soft delete, filter params, tag endpoints |
| `backend/src/routes/pipelines.ts` | PARTIAL | Add POST, PATCH, DELETE, stage CRUD |
| `backend/src/routes/workflows.ts` | PARTIAL | Async execution, conditions, send_whatsapp, webhook_call |
| `backend/src/routes/forms.ts` | UNKNOWN | Verify + add public submission endpoint |
| `backend/src/routes/conversations.ts` | MISSING | Create entirely |
| `backend/src/routes/integrations.ts` | MISSING | Create entirely (Meta OAuth + WABA) |
| `backend/src/routes/webhooks.ts` | MISSING | Create entirely (Meta + WhatsApp receivers) |
| `backend/src/routes/tags.ts` | MISSING | Create entirely |
| `backend/src/routes/opportunities.ts` | MISSING | Create entirely |
| `backend/src/routes/fields.ts` | MISSING | Create entirely |
| `backend/src/middleware/auth.ts` | PARTIAL | Add `checkPermission` factory |
| `backend/src/middleware/validate.ts` | MISSING | Create Zod validation middleware |
| `backend/src/middleware/permissions.ts` | MISSING | Create RBAC middleware |
| `backend/src/utils/crypto.ts` | MISSING | AES-256 encrypt/decrypt |
| `backend/src/utils/phone.ts` | MISSING | E.164 phone normalization |
| `backend/src/config.ts` | MISSING | Env var validation on startup |
| `backend/src/db/migration_003_auth_sessions.sql` | MISSING | Auth columns |
| `backend/src/db/migration_004_core_tables.sql` | MISSING | All missing tables |
| `backend/src/db/migration_005_rbac.sql` | MISSING | Roles and permissions |
| `backend/src/index.ts` | PARTIAL | Add helmet, rate-limit, cookie-parser, Socket.io |
| `frontend/src/lib/api.ts` | BROKEN | Token from memory, auto-refresh, remove localStorage |
| `frontend/src/store/authStore.ts` | MISSING | Create auth context store |
| `frontend/src/store/crmStore.ts` | PARTIAL | Fix stageId, fix initFromApi mapping |
| `frontend/src/components/ProtectedRoute.tsx` | MISSING | Create auth guard component |
| `frontend/src/App.tsx` | BROKEN | Wrap routes with ProtectedRoute |
| `frontend/src/pages/LoginPage.tsx` | BROKEN | Wire to API, use authStore not localStorage |
| `frontend/src/pages/LeadsPage.tsx` | PARTIAL | Remove mock imports, fix filters, fix DnD stage |
| `frontend/src/pages/AutomationPage.tsx` | BROKEN | Load from API, wire delete/toggle to API |
| `frontend/src/pages/WorkflowEditorPage.tsx` | BROKEN | Load/save workflow, replace all static dropdowns |
| `frontend/src/pages/CustomFormsPage.tsx` | BROKEN | Wire to real API entirely |
| `frontend/src/pages/CustomFormDetailPage.tsx` | BROKEN | Load/save via API, real pipeline dropdowns |
| `frontend/src/pages/MetaFormsPage.tsx` | BROKEN | Remove all mock, wire to OAuth + API |
| `frontend/src/pages/WhatsAppSetupPage.tsx` | BROKEN | Wire to WABA setup API |
| `frontend/src/pages/InboxPage.tsx` | BROKEN | Wire to conversations API entirely |
| `frontend/src/pages/StaffPage.tsx` | PARTIAL | Wire add/edit/deactivate to API |
| `frontend/src/pages/CalendarPage.tsx` | PARTIAL | Load events from real API |
| `frontend/src/pages/FieldsPage.tsx` | BROKEN | Wire to custom fields API |
| `frontend/src/hooks/usePermission.ts` | MISSING | Create permission check hook |
| `.env.example` | MISSING | Create with all required variables |

---

---

# OVERALL SCORECARD

| Module | Backend % | Frontend % | DB % | End-to-End % |
|--------|-----------|------------|------|--------------|
| Auth / Session | 40% | 20% | 60% | **25%** |
| Lead Management | 70% | 55% | 80% | **60%** |
| Workflow Automation | 60% | 30% | 90% | **50%** |
| Custom Forms | 40% | 20% | 70% | **35%** |
| Meta Forms | 0% | 5% | 0% | **2%** |
| WhatsApp Lead Capture | 0% | 10% | 0% | **3%** |
| RBAC / Permissions | 15% | 5% | 0% | **7%** |
| Inbox / Conversations | 0% | 30% | 0% | **10%** |
| Calendar | 50% | 40% | 70% | **45%** |
| Staff Management | 60% | 40% | 80% | **55%** |
| Custom Fields | 0% | 30% | 0% | **10%** |
| WebSocket / Real-Time | 0% | 0% | 100% | **0%** |
| **Platform Overall** | | | | **~35%** |

---

> *DigyGo CRM Build Task List v1.0 — Engineering Reference*
> *Generated from: PRD v1.0 + Full Codebase Audit (April 2026)*
> *Next review: after Sprint 2 completion*
