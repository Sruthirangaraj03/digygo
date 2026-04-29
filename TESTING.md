# DigyGo CRM — User Test Cases

> Manual test cases for every built feature. Run these before each release.
> When a new module or feature is built, add its section at the bottom of the relevant category.

---

## How to Use

1. Start backend (`cd backend && npm run dev`) — must show `🚀 Backend running on port 4000`
2. Start frontend (`cd frontend && npm run dev`) — open `http://localhost:5173`
3. Verify health: `curl http://localhost:4000/health` → `{"status":"ok","db":"connected"}`
4. Work through each section top to bottom
5. Mark ✅ Pass or ❌ Fail next to each case as you test

---

## Test Accounts

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Super Admin | admin@digygocrm.com | DigyGo@2026 | CEO — no tenant context |
| Business Owner | sruthi@gmail.com | (set via seed) | Full admin on their tenant |
| Demo Tenant | saral@demo.com | demo123 | Second tenant for isolation tests |

---

---

# MODULE 1 — Authentication

## 1.1 Login

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open `http://localhost:5173` without being logged in | Redirected to `/login` |
| 2 | Submit the login form with both fields empty | Fields show validation errors, no API call made |
| 3 | Enter a valid email but wrong password → Submit | Error toast: "Invalid email or password" |
| 4 | Enter a non-existent email → Submit | Same error toast (no user enumeration) |
| 5 | Log in as `sruthi@gmail.com` with correct password | Redirect to `/dashboard`, company name shows in header |
| 6 | After login, refresh the browser (F5) | Still on dashboard, NOT redirected to login |
| 7 | Open a second browser tab → go to `http://localhost:5173` | Auto-authenticated, skips login page |
| 8 | Click the avatar in the top-right corner → click Logout | Redirect to `/login`, session cleared |
| 9 | After logout, press browser Back button | Cannot navigate back into the app |
| 10 | Log in as `admin@digygocrm.com` | Redirected to dashboard, header shows "DigyGo CRM" |

---

## 1.2 Session Persistence & Token Refresh

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in → wait on dashboard for 1 minute → click any nav item | Still works, no sudden redirect to login |
| 2 | Log in → open DevTools → Application → Cookies | Cookie `digygo_refresh` is present and httpOnly |
| 3 | Log in → open DevTools → Application → Local Storage | `dg_tok` access token is present |
| 4 | Log in → manually delete `dg_tok` from localStorage → refresh page | App re-authenticates silently using the refresh cookie, stays logged in |
| 5 | Log in → open DevTools → Application → Cookies → delete `digygo_refresh` → refresh page | Redirected to `/login` (session ended) |

---

## 1.3 Staff Invite Flow

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Settings → Staff → click "New Staff" → fill name + email → enable "Send Invite" → Save | Success toast, staff appears with "Invite Sent" status |
| 2 | Check backend logs | Invite email was attempted (may fail if no SMTP, but no crash) |
| 3 | Copy the invite link from DB or email → open in browser | Password setup page opens |
| 4 | Set a password and submit | Redirected to login |
| 5 | Log in with the new staff email + set password | Successful login with staff role |
| 6 | Try submitting the same invite link again | Error — "Invalid or expired invite" (single-use token) |

---

## 1.4 CEO Impersonation (Super Admin Only)

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in as `admin@digygocrm.com` → go to `/admin` | Tenant list visible |
| 2 | Click "Impersonate" on a tenant row | Logged in as that tenant's admin, header shows tenant name, orange "Impersonating" banner visible |
| 3 | While impersonating, open DevTools → Application → Local Storage | No CEO token stored there (in-memory only) |
| 4 | While impersonating, refresh the browser page | Impersonation ends, back to super admin view (by design) |
| 5 | Click "Exit Impersonation" button | Back to super admin account without any page reload |
| 6 | Try to impersonate a suspended tenant | Error toast — "Tenant is suspended" |

---

---

# MODULE 2 — Super Admin Panel

## 2.1 Tenant Management

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in as super admin → go to `/admin` | All business accounts listed with user count and lead count |
| 2 | Click "Create Business" | Navigate to the business creation form |
| 3 | Fill in Business Name, Admin Email, Admin Name, Password, Plan → Submit | Success — credentials shown; new tenant appears in list |
| 4 | Log in with the newly created tenant credentials | Full CRM with "Sales Pipeline" pre-created, 6 default stages exist |
| 5 | Go back to super admin → Suspend the new tenant | Tenant row shows "Suspended" status |
| 6 | Log in as the suspended tenant | Immediately rejected: "Account suspended" (sessions killed in real-time) |
| 7 | Restore the suspended tenant from super admin | Tenant status back to Active |
| 8 | Log in as the restored tenant | Works again |
| 9 | Delete a tenant from super admin | Tenant removed from list; all associated data cleaned up |
| 10 | Try to access `/admin` as a regular staff/admin user | 403 Forbidden page |

---

## 2.2 Audit Log

| # | Steps | Expected |
|---|-------|----------|
| 1 | As super admin, create a new tenant | An audit_log entry is created (check DB: `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5`) |
| 2 | Suspend a tenant | audit_log entry: action = `suspend_tenant` |
| 3 | Restore a tenant | audit_log entry: action = `restore_tenant` |
| 4 | Impersonate a tenant | audit_log entry: action = `impersonate` |
| 5 | Delete a tenant | audit_log entry: action = `delete_tenant` |

---

---

# MODULE 3 — Staff Management

## 3.1 Staff CRUD

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Settings → Staff tab | Real staff list from DB (no mock data) |
| 2 | Click "New Staff" → fill form → Save | Staff appears in list |
| 3 | Refresh browser | New staff member still there |
| 4 | Try adding staff with an email that already exists on this account | Error toast "Email already exists" |
| 5 | Click Edit (pencil) on a staff member → change name → Save | Name updates in list |
| 6 | Click More (⋯) on an active staff → click Deactivate | Status changes to Inactive |
| 7 | Log in as the deactivated staff account | Rejected immediately (session killed) |
| 8 | Reactivate the staff member from settings | Status changes to Active, can log in again |
| 9 | Click More (⋯) on a staff → click "Revoke Session" | Staff's active session ends; their next API call returns 401. Staff account remains active. |
| 10 | Admin resets a staff member's password from settings | Staff can log in with new password; old sessions invalidated |

---

## 3.2 Role Permissions

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Settings → Staff → Roles tab | Role permission grid shown for each role (staff, admin, etc.) |
| 2 | Toggle off `leads:create` for the "staff" role → Save | Success toast |
| 3 | Log in as a staff-role user | No "Add Lead" button visible anywhere |
| 4 | Toggle `leads:create` back on → Save | Staff user sees "Add Lead" button again (may need to refresh) |
| 5 | Click "Edit Permissions" (shield icon) on a specific staff member | Individual permission overrides panel opens |
| 6 | Remove `leads:delete` for just this one staff member → Save | That staff member's Delete buttons disappear |
| 7 | Other staff members with the same role are not affected | Their delete buttons remain |

---

## 3.3 Permission-Gated UI Elements

Test as a **staff-role user** (not admin). Toggle permissions on/off in Settings and verify the UI responds.

| Permission Off | Expected UI Change |
|----------------|-------------------|
| `leads:create` | "Add Lead" button hidden on Leads page |
| `leads:edit` | Edit (pencil) button hidden in lead detail panel |
| `leads:delete` | Delete button hidden in lead detail + bulk delete toolbar |
| `staff:manage` | "New Staff" button hidden; Edit/Permissions/Deactivate actions hidden per row |
| `automation:manage` | "Create Workflow" button hidden; Edit/Delete/Duplicate hidden per workflow row |
| `custom_forms:create` | "Create Form" button and "New Form" card hidden |
| `custom_forms:delete` | Delete (trash) button hidden on each form card |
| `leads:edit` (contacts page) | Edit and Convert buttons hidden in contact row dropdown |
| `leads:delete` (contacts page) | Delete button hidden in contact row dropdown |

---

---

# MODULE 4 — Leads / Kanban

## 4.1 Creating Leads

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to `/leads` | Kanban board with real leads from DB |
| 2 | Click "+ Add Lead" → fill all fields → Save | Lead appears in the first stage column |
| 3 | Refresh browser | New lead still there (persisted) |
| 4 | Create lead with only Name field filled | Lead created successfully (other fields optional) |
| 5 | Try creating a lead with no name | Validation error, form not submitted |

---

## 4.2 Kanban Drag & Drop

| # | Steps | Expected |
|---|-------|----------|
| 1 | Drag a lead card from column A to column B | Card moves visually |
| 2 | Open DevTools Network tab before dragging → inspect the PATCH `/api/leads/:id` request body | `stage_id` must be a UUID (e.g. `"a3f2...d910"`) — NOT a stage name string like `"Demo"` |
| 3 | Refresh browser | Lead stays in column B (not reverted) |
| 4 | Drag lead onto another lead card (not a column header) | Lead moves to same stage as the target lead |
| 5 | Refresh | Lead stays in moved position |

---

## 4.3 Lead Detail Panel

| # | Steps | Expected |
|---|-------|----------|
| 1 | Click any lead card | Detail panel slides in from right |
| 2 | Click "Edit" (pencil icon) → change a field → Save | Field updates immediately, reflected on kanban card |
| 3 | Refresh browser | Edit is persisted |
| 4 | Add a note | Note appears under Notes tab immediately |
| 5 | Refresh browser | Note still there |
| 6 | Edit a note | Updated text shows |
| 7 | Delete a note | Note removed |
| 8 | Add a follow-up with a due date | Follow-up appears in list |
| 9 | Mark follow-up as complete | Checkbox filled, `completed_at` timestamp appears |
| 10 | Check Activities tab | Shows "Lead created", "Stage changed to X", any note/follow-up events |
| 11 | Click the Delete (trash) icon → confirm | Lead removed from kanban, soft-deleted in DB |

---

## 4.4 List View

| # | Steps | Expected |
|---|-------|----------|
| 1 | Toggle from Kanban to List view | All leads shown in table format |
| 2 | Type in search box | Results filter in real-time |
| 3 | Select multiple leads using checkboxes | Bulk action toolbar appears |
| 4 | Click "Move" in bulk toolbar → select a stage | All selected leads move to that stage, persist on refresh |
| 5 | Select leads → click "Assign" → pick a staff member | All selected leads assigned, persist on refresh |
| 6 | Select leads → click "Delete" → confirm | Leads removed from list, soft-deleted in DB |

---

## 4.5 Lead Filters

| # | Steps | Expected |
|---|-------|----------|
| 1 | Click Filter → filter by Assigned To → select a staff member | Only leads assigned to that staff shown |
| 2 | Filter by Stage | Only leads in that stage shown |
| 3 | Filter by Source (e.g. "Manual") | Only manual leads shown |
| 4 | Filter by date range | Only leads created in that range shown |
| 5 | Apply multiple filters at once | Results are intersection (all conditions must match) |
| 6 | Click Reset filters | All leads shown again |
| 7 | Refresh browser with filters applied | Filters persist (or are cleared, either is acceptable — check current behavior) |

---

## 4.6 Tags on Leads

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open lead detail panel → find the Tags section | Tag list loads from DB |
| 2 | Attach a tag to the lead | Tag badge appears on the lead card in kanban |
| 3 | Refresh browser | Tag still attached |
| 4 | Filter leads by that tag in the filter panel | Only leads with that tag appear |
| 5 | Remove the tag from the lead | Tag badge disappears from card |

---

---

# MODULE 5 — Contacts

## 5.1 Viewing and Managing Contacts

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to `/contacts` | Contacts table loads with real data |
| 2 | Search by name or email | Filtered results update |
| 3 | Filter by Source | Only contacts from that source shown |
| 4 | Click a contact row | Contact detail modal/panel opens |
| 5 | Click More (⋯) on a contact row → Edit | Edit form opens |
| 6 | Click More (⋯) → "Convert to Customer" | Contact stage changes; toast confirmation |
| 7 | Select multiple contacts using checkboxes | Bulk action toolbar appears |
| 8 | Click Delete in bulk toolbar → confirm | Selected contacts removed |
| 9 | Click More (⋯) on a contact → Delete → confirm | Single contact removed |

---

---

# MODULE 6 — Pipelines

## 6.1 Pipeline CRUD

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Leads page → click Pipeline dropdown | Existing pipelines listed |
| 2 | Create new pipeline with a name | Pipeline appears in dropdown |
| 3 | Refresh browser | New pipeline persists |
| 4 | Rename the pipeline | Name updates everywhere (dropdown, kanban header) |
| 5 | Add a new stage to the pipeline | New stage column appears in kanban |
| 6 | Delete a stage | Column removed, leads in that stage moved (or shown as unassigned) |
| 7 | Delete the new pipeline (when 2+ exist) | Pipeline removed from dropdown |
| 8 | Try to delete the last remaining pipeline | Error toast "Cannot delete the only pipeline" |

---

---

# MODULE 7 — Automation / Workflows

## 7.1 Workflow List

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Automation page with a fresh tenant (no workflows yet) | Empty state shown — NO mock workflow names like "Show Up Automation" |
| 2 | Workflow list shows only real DB workflows | All items have UUID-format IDs, not `wf-1`, `wf-2` etc. |

---

## 7.2 Creating & Editing Workflows

| # | Steps | Expected |
|---|-------|----------|
| 1 | Click "Create Workflow" | Workflow editor opens |
| 2 | Add trigger: "Lead Created" | Trigger node appears on canvas |
| 3 | Add action: "Create Note" → set content "Auto-created note" | Action node connected to trigger |
| 4 | Save and Activate | Workflow appears in list with Active status |
| 5 | Refresh browser | Workflow still there with Active status |
| 6 | Click Edit on the workflow | Editor opens with saved nodes |
| 7 | Change the note content → Save | Updated content persisted |

---

## 7.3 Workflow Execution

| # | Steps | Expected |
|---|-------|----------|
| 1 | With "Lead Created" workflow active, create a new lead | Within 2 seconds: open lead detail → Activities shows "Note added: Auto-created note" |
| 2 | Toggle the workflow to Inactive | Status changes |
| 3 | Create another lead | No note added (workflow inactive) |
| 4 | Toggle workflow back to Active | Status changes |
| 5 | Open workflow → click Logs/History icon | Execution history shown with real lead names and step results |
| 6 | Open a workflow with no executions yet → view logs | "No executions yet" empty state — no fake log rows |

---

## 7.4 Assign Staff Workflow Action

| # | Steps | Expected |
|---|-------|----------|
| 1 | Create a workflow with "Lead Created" trigger + "Assign to Staff" action | Editor opens |
| 2 | Open the "Assign to Staff" config → expand staff dropdown | Shows YOUR real staff members — NOT "Ranjith Kumar", "Priya Sharma" or other mock names |
| 3 | Select a staff member → Save | Staff UUID stored (not the name string) |
| 4 | Create a new lead | After 1-2 seconds, check lead's "Assigned To" field — shows the correct staff member |
| 5 | Check DB: `SELECT assigned_to FROM leads WHERE name='...'` | Must be the real staff member's UUID |

---

## 7.5 Workflow Deletion

| # | Steps | Expected |
|---|-------|----------|
| 1 | Click More (⋯) → Delete on a workflow → confirm | Workflow removed from list |
| 2 | Duplicate a workflow | Copy appears with "(Copy)" suffix |
| 3 | Refresh | Both original and copy persist |

---

---

# MODULE 8 — Custom Forms

## 8.1 Creating Forms

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Lead Generation → Custom Forms | Forms grid loads |
| 2 | Click "Create Form" → fill name → add Name + Email fields → Save | Form created and appears in grid |
| 3 | Refresh browser | Form still there |
| 4 | Click the Edit (pencil) icon on a form | Form editor opens with saved fields |
| 5 | Add another field → Save | New field persists on refresh |
| 6 | Click the Clone (copy) icon on a form | Duplicate form created with "(Copy)" in name |

---

## 8.2 Form Submission

| # | Steps | Expected |
|---|-------|----------|
| 1 | Note the form's ID from the URL | Example: `/custom-forms/abc-123` |
| 2 | Submit via API without auth token: `POST /api/forms/{id}/submit` with `{"data":{"name":"Test User","email":"test@test.com"}}` | `{"success":true}` |
| 3 | Go to `/leads` | New lead appears from the form submission |
| 4 | Deactivate the form (toggle is_active to false via edit) | Form shows as inactive |
| 5 | Try submitting to inactive form | 404 "Form not found or inactive" |

## 8.3 Form Submission — Duplicate & Contact Auto-Creation (Regression)

> These tests guard against the `leads_source_source_ref_unique` constraint bug and verify contacts are auto-created.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Submit the same form twice with the same email: `POST /api/public/forms/{slug}/submit` body `{"name":"Alice","email":"alice@test.com"}` → repeat | Both return `{"success":true}` — NO 500 error on second submit |
| 2 | Check DB: `SELECT COUNT(*) FROM leads WHERE email='alice@test.com' AND tenant_id='...'` | Exactly 1 row — deduped, not two leads |
| 3 | Submit the same form a third time with a different name but same email | Still `{"success":true}`, still 1 lead row |
| 4 | Submit the form with a brand new email | `{"success":true}`, a second lead is created |
| 5 | After any successful new-lead submission, check: `SELECT * FROM contacts WHERE email='alice@test.com' AND tenant_id='...'` | A contact row exists (auto-created), `lead_id` is populated |
| 6 | Submit the same form again (same email) | Contact row is NOT duplicated — still 1 contact row |

---

## 8.3 Form Submission While Tenant Suspended

| # | Steps | Expected |
|---|-------|----------|
| 1 | As super admin, suspend a tenant | Tenant suspended |
| 2 | Submit to that tenant's form via API (no auth) | 404 — tenant is inactive |
| 3 | Restore the tenant | Submissions work again |

---

## 8.4 Form Embed & Share

| # | Steps | Expected |
|---|-------|----------|
| 1 | Click Embed (code icon) on a form | Embed modal opens with HTML snippet |
| 2 | Click the Link icon | Public URL shown; copy it |
| 3 | Open the public URL in an incognito tab | Form renders without login |
| 4 | Submit the form from incognito | Lead created, no auth required |

---

---

# MODULE 9 — Calendar

## 9.1 Appointments

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Calendar | Calendar view loads with real events from DB |
| 2 | Click a date/slot → create new appointment linked to a lead | Event appears on calendar |
| 3 | Refresh browser | Event still there |
| 4 | Click event → Edit → change the time | Event moves to new time slot |
| 5 | Delete the event | Removed from calendar |
| 6 | Create appointment → check lead's Activities tab | "Appointment booked" activity visible |

## 9.3 Public Booking Lead Creation & Dedup (Regression)

> Guards against calendar bookings not creating leads and duplicate bookings crashing.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Book via the public calendar link with a new email and phone: `POST /api/calendar/public/book` body `{"event_type_id":"...","guest_name":"Bob","guest_email":"bob@test.com","guest_phone":"9999999999","date":"YYYY-MM-DD","time":"10:00"}` | `201` response, booking confirmed |
| 2 | Check DB: `SELECT id, lead_id FROM calendar_events ORDER BY created_at DESC LIMIT 1` | `lead_id` is NOT null — event is linked to a lead |
| 3 | Check DB: `SELECT * FROM leads WHERE email='bob@test.com' AND tenant_id='...'` | Lead row exists with `source='calendar_booking'` |
| 4 | Check DB: `SELECT * FROM contacts WHERE email='bob@test.com' AND tenant_id='...'` | Contact row exists, `lead_id` matches the lead |
| 5 | Book again with the same email (different time slot) | `201` — no error |
| 6 | Check DB leads count for that email | Still 1 lead — deduped, not two |
| 7 | Book with the same phone but different email | `201` — dedupes on phone, still 1 lead |

---

## 9.2 Public Booking Rate Limiting

| # | Steps | Expected |
|---|-------|----------|
| 1 | Send 31 requests in 15 minutes to `GET /api/calendar/public/event-type/:slug` | First 30 succeed (200); 31st returns 429 "Too many requests" |
| 2 | Same test for `POST /api/calendar/public/book` | Same 30 req/15 min limit |

---

---

# MODULE 10 — Settings

## 10.1 Company Settings

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Settings → Company Details | Form loads with current values |
| 2 | Update workspace name → Save | Header/sidebar shows new name |
| 3 | Update timezone, currency, address → Save | Values persist on refresh |
| 4 | Refresh browser | All settings still updated |
| 5 | Upload a logo image | Logo appears in header and settings page |

---

---

# MODULE 11 — Tenant Isolation

> Critical security tests. One tenant must NEVER see another's data.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in as Tenant A (sruthi@gmail.com) → create a lead named "Tenant A Secret" | Lead created, note the ID |
| 2 | Log in as Tenant B (saral@demo.com) → go to `/leads` | "Tenant A Secret" does NOT appear |
| 3 | As Tenant B, call `GET /api/leads/{Tenant A's lead ID}` | 404 Not Found |
| 4 | As Tenant B, try `PATCH /api/leads/{Tenant A's lead ID}` with any body | 404 Not Found |
| 5 | As Tenant B, try `DELETE /api/leads/{Tenant A's lead ID}` | 404 Not Found |
| 6 | As Tenant A, create a staff member → note their ID | Noted |
| 7 | As Tenant B, try `PATCH /api/leads` with `assigned_to` = Tenant A's staff ID | Validation fails — cross-tenant staff assignment rejected |

---

---

# MODULE 12 — Plan & Usage Limits

## 12.1 Usage Tracking

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in as a "starter" plan tenant (check `tenants.plan` column in DB) | Normal access |
| 2 | Check current usage: `SELECT * FROM tenant_usage WHERE tenant_id='...'` | Counts reflect real data |
| 3 | Create a lead | `leads_count` increments by 1 in `tenant_usage` |
| 4 | Create a contact | `contacts_count` increments by 1 |
| 5 | Add a staff member | `staff_count` increments by 1 |
| 6 | Create a custom form | `forms_count` increments by 1 |
| 7 | Create a workflow | `workflows_count` increments by 1 |

---

## 12.2 Plan Feature Gates

| # | Steps | Expected |
|---|-------|----------|
| 1 | Tenant on "starter" plan → try to access `/api/workflows` | Returns 402 if workflows not in starter plan |
| 2 | Tenant on "starter" plan → try to access WhatsApp flows endpoint | Returns 402 "Feature not available on your plan" |
| 3 | Tenant on "pro" plan → access same endpoints | Works normally |

---

---

# MODULE 13 — Security & Session Management

## 13.1 Refresh Token Security

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in → note the refresh cookie value | Saved for reference |
| 2 | Make a refresh request → note the new cookie value | Cookie value has rotated (different from step 1) |
| 3 | Try using the old cookie value for another refresh | 401 Unauthorized (old token invalidated) |
| 4 | Open two browser tabs simultaneously → both tabs try to refresh at the same time | Only one succeeds; other gets 401. No token theft via race condition. |

---

## 13.2 Suspended Tenant Session Kill

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in as a tenant admin → note the access token | Active session |
| 2 | As super admin, suspend that tenant | Tenant suspended |
| 3 | Within 30 seconds, make any API call with the still-valid access token | 403 "Tenant is suspended" — no waiting for token expiry |

---

## 13.3 Staff Deactivation Session Kill

| # | Steps | Expected |
|---|-------|----------|
| 1 | Log in as a staff member in one browser tab | Active session |
| 2 | As admin in another tab, deactivate that staff member | Staff deactivated |
| 3 | In the staff's tab, make any API call (navigate anywhere) | 401 — session killed immediately |

---

## 13.4 Admin Password Reset Audit

| # | Steps | Expected |
|---|-------|----------|
| 1 | As admin, reset a staff member's password from Settings | Success toast |
| 2 | Check DB: `SELECT * FROM audit_log WHERE action='password_reset_by_admin' ORDER BY created_at DESC LIMIT 1` | Row exists with correct actor_id and target_user_id |

---

---

# MODULE 14 — Dashboard

## 14.1 Dashboard Stats

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to `/dashboard` | Page loads without errors |
| 2 | Stats cards show numbers | Numbers reflect real DB data (not zeroes or mock) |
| 3 | Refresh browser | Same stats shown (no random values) |

---

---

# MODULE 15 — Meta Forms (Facebook Integration)

> Requires ngrok + Facebook App configured.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to Lead Generation → Meta Forms | Page loads |
| 2 | Click "Connect Facebook" | Facebook OAuth flow starts |
| 3 | Authorize the app | Redirected back, Facebook page listed |
| 4 | Select a Facebook page | Available lead forms listed below |
| 5 | Map form fields to CRM fields → Save | Mapping saved |
| 6 | Submit a test lead from Facebook | Lead appears in CRM within seconds |

---

---

# MODULE 16 — WhatsApp

| # | Steps | Expected |
|---|-------|----------|
| 1 | Go to WhatsApp Setup | Setup page loads |
| 2 | Connect a WhatsApp Business account | Connected status shown |
| 3 | Go to WhatsApp Automation | Flow builder loads |
| 4 | Create a flow with a keyword trigger | Flow saved |
| 5 | Send the keyword from a test WhatsApp number | Bot responds according to flow |

---

---

# MODULE 17 — Notifications

| # | Steps | Expected |
|---|-------|----------|
| 1 | Trigger an action that creates a notification (e.g. someone assigns a lead to you) | Bell icon shows unread count badge |
| 2 | Click the bell icon | Notifications dropdown opens with the notification |
| 3 | Click "Mark all as read" | Badge clears |
| 4 | Refresh browser | Read state persists |

---

---

# MODULE 18 — Capture Path Regression Tests

> Run these any time a new lead capture source is added or an existing one is touched.
> Every test has a "repeat" step — bugs in this area only surface on the second invocation.

## 18.1 Rule: Every capture path must survive being called twice

| Capture Path | First call | Second call (same identity) | Expected on repeat |
|---|---|---|---|
| Custom Form submit (`/api/public/forms/:slug/submit`) | Lead created | Same email/phone | `200 success`, 1 lead in DB |
| Meta webhook (`/api/webhooks/meta`) | Lead created | Same `leadgen_id` | Idempotent skip, 1 lead |
| WhatsApp inbound (`/api/webhooks/whatsapp`) | Lead created | Same phone number | Reuses existing lead, no new row |
| Calendar public booking (`/api/calendar/public/book`) | Lead created | Same email/phone, different slot | `201`, 1 lead deduped |

## 18.2 Rule: Every new lead must auto-create a Contact

| Capture Path | How to verify |
|---|---|
| Custom Form (new lead) | `SELECT * FROM contacts WHERE lead_id='<new lead id>'` → 1 row |
| Meta form webhook (new lead) | Same check on the imported lead ID |
| WhatsApp first message (new lead) | Same check |
| Calendar public booking (new lead) | Same check + `lead_id` on `calendar_events` is not null |

## 18.3 Rule: `source_ref` must be a per-lead unique value, not a per-form ID

> Violating this breaks the `leads_source_source_ref_unique` constraint on the second submission.

| # | Check | Expected |
|---|-------|----------|
| 1 | `SELECT source, source_ref FROM leads WHERE source='Custom Form' LIMIT 10` | `source_ref` is NULL for custom form leads (NOT the form's UUID) |
| 2 | `SELECT source, source_ref FROM leads WHERE source='meta_form' LIMIT 10` | `source_ref` is a Facebook `leadgen_id` (looks like `1234567890123456`) |
| 3 | `SELECT source, source_ref FROM leads WHERE source='whatsapp' LIMIT 10` | `source_ref` is NULL |
| 4 | Try inserting two leads with the same `source` + `source_ref` value | DB rejects with unique constraint error — this is correct behaviour for Meta dedup |

---

---

# Pre-Release Checklist

Run all of these before deploying:

```bash
# 1. TypeScript — zero errors
cd backend && npx tsc --noEmit && echo "✅ Backend types OK"
cd frontend && npx tsc --noEmit && echo "✅ Frontend types OK"

# 2. Health check
curl -s http://localhost:4000/health | grep -q '"db":"connected"' && echo "✅ DB connected" || echo "❌ DB disconnected"

# 3. Environment variables
grep -q "JWT_SECRET"    backend/.env && echo "✅ JWT_SECRET"    || echo "❌ JWT_SECRET MISSING"
grep -q "DATABASE_URL"  backend/.env && echo "✅ DATABASE_URL"  || echo "❌ DATABASE_URL MISSING"
grep -q "FRONTEND_URL"  backend/.env && echo "✅ FRONTEND_URL"  || echo "❌ FRONTEND_URL MISSING"

# 4. All required DB tables exist
cd backend && node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:'postgresql://digygo_user:digygo123@localhost:5432/digygocrm'});
const tables=['users','tenants','leads','pipelines','pipeline_stages','lead_notes','lead_followups',
  'lead_activities','workflows','workflow_executions','calendar_events','custom_forms',
  'form_submissions','contacts','audit_log','tenant_usage','role_permissions','user_permissions'];
Promise.all(tables.map(t=>p.query('SELECT 1 FROM '+t+' LIMIT 1').then(()=>'  ✅ '+t).catch(()=>'  ❌ '+t))).then(r=>{r.forEach(x=>console.log(x));p.end()});
"
```

---

---

# Adding New Test Cases

When you build a new module or feature, add test cases using this template:

```
---

# MODULE N — <Module Name>

## N.1 <Feature Name>

| # | Steps | Expected |
|---|-------|----------|
| 1 | <action> | <result> |
| 2 | <action> | <result> |
```

Place the new section before the "Pre-Release Checklist" section.

---

# Known Limitations (Not Yet Built)

| Feature | Status |
|---------|--------|
| Email sending | Needs SMTP credentials in `.env` |
| WhatsApp messaging | Needs WABA credentials |
| Meta Lead Ads | Needs Facebook App setup + ngrok |
| Workflow delay/wait action | Needs job queue (BullMQ) |
| Dashboard real-time updates | Requires WebSocket subscription |
| Lead scoring | Not yet built |
| Reports & analytics | Not yet built |
| CSV import | Not yet built |
| Lead export (Excel/CSV) | Not yet built |
