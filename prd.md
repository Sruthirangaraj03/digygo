# Product Requirements Document
## CRM SaaS Platform
### *Enterprise-Grade Customer Relationship Management System*

> **Modules:** Lead Generation · Lead Management · Automation · Inbox · Fields · Calendar · Staff

| Version | Status | Date | Audience |
|---------|--------|------|----------|
| 1.0 | DRAFT | 2025 | Engineering |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Database Schema](#3-database-schema)
4. [Module 1: Lead Generation](#4-module-1-lead-generation)
5. [Module 2: Lead Management](#5-module-2-lead-management)
6. [Module 3: Lead Automation](#6-module-3-lead-automation)
7. [Module 4: Inbox](#7-module-4-inbox)
8. [Module 5: Fields](#8-module-5-fields)
9. [Module 6: Calendar](#9-module-6-calendar)
10. [Module 7: Staff](#10-module-7-staff)
11. [API Design Standards](#11-api-design-standards)
12. [Security Requirements](#12-security-requirements)
13. [Performance Requirements](#13-performance-requirements)
14. [Error Handling & Resilience](#14-error-handling--resilience)
15. [UI/UX Requirements](#15-uiux-requirements)
16. [Testing Requirements](#16-testing-requirements)
17. [Deployment & Infrastructure](#17-deployment--infrastructure)
18. [Development Phases & Milestones](#18-development-phases--milestones)
19. [Open Questions & Decisions Required](#19-open-questions--decisions-required)
20. [Glossary](#20-glossary)

---

## 1. Executive Summary

This PRD defines the full scope, architecture, module specifications, workflows, data models, API contracts, and acceptance criteria for a **multi-tenant SaaS CRM platform**. The platform is designed to serve B2B and B2C companies in managing leads from capture through conversion, with deep automation, communication, and scheduling capabilities.

### 1.1 Product Vision

Build the fastest, most user-friendly CRM platform that enables businesses of all sizes to:
- Capture leads from multiple sources
- Manage them through customizable pipelines
- Automate follow-ups
- Communicate through a unified inbox

All in a single, secure, multi-tenant environment.

### 1.2 Core Design Principles

| Principle | Description |
|-----------|-------------|
| **Speed First** | Sub-200ms API response times for all primary operations |
| **Mobile-First** | All features fully functional on mobile devices |
| **Non-Technical Friendly** | UI/UX designed for zero-training usability |
| **Security by Default** | RBAC, tenant isolation, input sanitization, session hardening |
| **Scalability** | Architected to support 100+ organizations, 10,000+ leads per org |
| **Real-Time** | WebSocket-powered live updates across pipelines, inbox, and notifications |

### 1.3 Target Users

| User Type | Description |
|-----------|-------------|
| **Super Admin** | Platform operator with cross-org access and billing control |
| **Organization Admin** | Company owner who sets up and manages their CRM instance |
| **Manager** | Team lead with access to all leads, reports, and staff management |
| **Agent** | Sales/support rep with access to assigned leads and conversations |
| **Guest/External** | Limited read-only or form-submission access *(future scope)* |

### 1.4 Key Metrics & Constraints

| Constraint | Target Value |
|------------|-------------|
| Max users per organization | Unlimited (soft cap: 500 staff) |
| Max leads per organization | 10,000+ (tested to 100,000) |
| API response time (P95) | < 200ms |
| Real-time sync latency | < 1 second |
| Uptime SLA | 99.9% |
| Mobile support | iOS 14+, Android 10+, all modern browsers |
| File upload size | Max 25MB per file, 100MB per org/day |
| Concurrent WebSocket connections | 1,000+ per org supported |

---

## 2. System Architecture Overview

### 2.1 Architecture Pattern

The platform follows a **multi-tenant SaaS architecture** with full data isolation per organization. Each organization (tenant) has a unique `organization_id` applied as a mandatory filter on every database query. No cross-tenant data leakage is permitted under any circumstances.

### 2.2 Technology Stack

| Layer | Technology | Purpose | Reasoning |
|-------|-----------|---------|-----------|
| Frontend | React + Vite + Tailwind CSS | Web application | Fast builds, mobile responsive, component reuse |
| Mobile | React Native or PWA | Mobile app | Code sharing with web, offline capability |
| Backend API | Node.js + Express or NestJS | REST API + WebSocket | Async I/O, fast, large ecosystem |
| Database | PostgreSQL (primary) | Relational data store | ACID, JSON support, row-level security |
| Cache | Redis | Sessions, queues, pub/sub | Sub-millisecond lookups, WebSocket fanout |
| Queue | Bull/BullMQ (Redis-backed) | Automation workflows | Delayed jobs, retry logic, priority |
| File Storage | AWS S3 or Cloudflare R2 | Attachments, exports | Scalable, CDN-ready |
| Real-time | Socket.io or native WebSocket | Live updates | Low-latency event push to clients |
| Email | SMTP / Resend / SendGrid | Email sending | Reliability, delivery tracking |
| WhatsApp | Meta WABA (Cloud API) | Messaging | Official API, webhook-based |
| Auth | JWT + Refresh Token + bcrypt | Authentication | Stateless, secure, revocable |
| API Gateway | Nginx or Cloudflare Proxy | Rate limiting, SSL | Security, DDoS protection |

### 2.3 Multi-Tenancy Model

Every database table (except system-wide tables like `plans` and `countries`) includes an `organization_id` column. Row-Level Security (RLS) policies are enforced at the PostgreSQL level as a secondary safeguard.

- **Tenant isolation:** `organization_id` applied on every query via middleware
- **No shared data** between tenants except system-level config
- Each organization has isolated: leads, pipelines, staff, automation, templates
- Subdomain or path-based routing per organization (e.g., `acme.yourcrm.com`)

### 2.4 Authentication & Session Management

#### 2.4.1 Auth Flow

| Step | Action |
|------|--------|
| 1 | User submits email + password via `POST /api/auth/login` |
| 2 | Backend validates credentials using `bcrypt.compare()` |
| 3 | On success: generate JWT access token (15min TTL) + refresh token (7-day TTL) |
| 4 | Refresh token stored in HttpOnly Secure SameSite=Strict cookie + hashed in DB |
| 5 | Access token stored in memory (not localStorage) on the client |
| 6 | Every API request includes `Authorization: Bearer <access_token>` header |
| 7 | Middleware decodes JWT → attaches `user` + `organization_id` to request context |
| 8 | On 401: client silently calls `POST /api/auth/refresh` with refresh token cookie |
| 9 | New access token issued; if refresh token expired or revoked → force logout |
| 10 | On logout: refresh token invalidated in DB + cookie cleared |

#### 2.4.2 Security Requirements

- Passwords: bcrypt with cost factor 12
- JWT: RS256 signed (asymmetric keys), not HS256
- Rate limiting: 5 failed login attempts → 15-minute lockout per IP + email
- All tokens bound to `organization_id`; cross-tenant token reuse is rejected
- All API endpoints protected; no public routes except webhook receivers and form submissions
- Input sanitization: all user input validated using Zod or Joi schemas
- SQL injection prevention: all queries use parameterized statements / ORMs
- XSS prevention: Content-Security-Policy headers, output encoding
- CSRF: SameSite cookies + CSRF tokens on state-changing requests

---

## 3. Database Schema

### 3.1 Core Tables Overview

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `organizations` | id (UUID) | Each company/tenant using the CRM |
| `users` | id (UUID) | All staff members; belongs to an organization |
| `roles` | id (UUID) | Role definitions per organization |
| `permissions` | id (UUID) | Granular permission flags per role |
| `user_roles` | user_id + role_id | Junction: user to role assignment |
| `leads` | id (UUID) | Central lead/contact record |
| `pipelines` | id (UUID) | Sales or custom pipelines per org |
| `stages` | id (UUID) | Stages within a pipeline |
| `tags` | id (UUID) | Label definitions per org |
| `lead_tags` | lead_id + tag_id | Junction: tags on leads |
| `custom_fields` | id (UUID) | Field definitions per org |
| `lead_field_values` | lead_id + field_id | Dynamic field values per lead |
| `conversations` | id (UUID) | Chat threads per lead per channel |
| `messages` | id (UUID) | Individual messages in a conversation |
| `workflows` | id (UUID) | Automation workflow definitions |
| `workflow_executions` | id (UUID) | Execution logs per workflow run |
| `templates` | id (UUID) | WhatsApp/email message templates |
| `calendar_events` | id (UUID) | Appointments and bookings |
| `activities` | id (UUID) | Audit trail: all lead/system events |
| `follow_ups` | id (UUID) | Scheduled follow-up tasks |
| `opportunities` | id (UUID) | Revenue opportunities linked to leads |
| `contact_groups` | id (UUID) | Named groups of contacts |
| `contact_group_members` | group_id + lead_id | Junction: contacts in a group |
| `meta_integrations` | id (UUID) | Facebook/Instagram OAuth tokens per org |
| `meta_forms` | id (UUID) | Selected Meta lead forms |
| `waba_integrations` | id (UUID) | WhatsApp Business API credentials per org |
| `booking_links` | id (UUID) | Public booking URL configs |
| `availability_slots` | id (UUID) | Working hours per staff member |
| `notifications` | id (UUID) | In-app notification records |
| `webhook_logs` | id (UUID) | Incoming webhook event logs |

### 3.2 Key Table Schemas

#### 3.2.1 `organizations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default gen_random_uuid() | Unique org identifier |
| name | VARCHAR(255) | NOT NULL | Company/organization name |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URL-safe identifier for routing |
| plan | VARCHAR(50) | default 'starter' | Subscription plan tier |
| is_active | BOOLEAN | default true | Soft-disable flag |
| meta | JSONB | nullable | Flexible config storage |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | Last update timestamp |

#### 3.2.2 `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique user identifier |
| organization_id | UUID | FK → organizations.id, NOT NULL | Tenant binding |
| email | VARCHAR(255) | UNIQUE per org, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| first_name | VARCHAR(100) | NOT NULL | Given name |
| last_name | VARCHAR(100) | NOT NULL | Family name |
| phone | VARCHAR(30) | nullable | Contact number |
| avatar_url | TEXT | nullable | Profile photo URL |
| is_active | BOOLEAN | default true | Active/suspended flag |
| last_login_at | TIMESTAMPTZ | nullable | Last successful login |
| refresh_token_hash | VARCHAR(255) | nullable | Current refresh token hash |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Account creation time |

#### 3.2.3 `leads`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique lead identifier |
| organization_id | UUID | FK → organizations.id, NOT NULL | Tenant binding |
| first_name | VARCHAR(100) | NOT NULL | Lead's first name |
| last_name | VARCHAR(100) | nullable | Lead's last name |
| email | VARCHAR(255) | nullable, indexed | Email address |
| phone | VARCHAR(30) | nullable, indexed | Phone number (E.164 format) |
| pipeline_id | UUID | FK → pipelines.id, NOT NULL | Assigned pipeline |
| stage_id | UUID | FK → stages.id, NOT NULL | Current stage |
| assigned_to | UUID | FK → users.id, nullable | Assigned staff member |
| source | VARCHAR(50) | NOT NULL | meta_form \| custom_form \| whatsapp \| manual \| import \| landing_page |
| source_ref | VARCHAR(255) | nullable | Form ID, page ID, etc. |
| is_duplicate | BOOLEAN | default false | Duplicate detection flag |
| is_converted | BOOLEAN | default false | Converted to opportunity |
| lead_score | INTEGER | default 0 | Computed engagement score |
| custom_fields | JSONB | default '{}' | Dynamic field values |
| last_activity_at | TIMESTAMPTZ | nullable | Last touch timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Lead creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | Last update time |

#### 3.2.4 `workflows`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique workflow ID |
| organization_id | UUID | FK → organizations.id | Tenant binding |
| name | VARCHAR(255) | NOT NULL | Workflow display name |
| is_active | BOOLEAN | default true | Enable/disable toggle |
| trigger_type | VARCHAR(50) | NOT NULL | Event that triggers the workflow |
| trigger_conditions | JSONB | NOT NULL | Conditions JSON for trigger evaluation |
| actions | JSONB | NOT NULL | Ordered array of action objects |
| execution_count | INTEGER | default 0 | Total times executed |
| last_triggered_at | TIMESTAMPTZ | nullable | Timestamp of last execution |
| created_by | UUID | FK → users.id | Creator user ID |
| created_at | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

## 4. Module 1: Lead Generation

The Lead Generation module is the entry point for all leads into the CRM. It supports four distinct lead capture channels: **Meta (Facebook/Instagram) Forms**, **Custom Forms**, **Landing Pages**, and **WhatsApp**. Each channel feeds into the same unified lead pipeline with deduplication, validation, and automation triggers.

### 4.1 Meta Forms Integration

#### Overview
Allows organizations to connect their Facebook/Instagram ad accounts and automatically capture lead data from Meta Lead Ads into the CRM in real time via webhooks.

#### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-LG-001 | User must be able to connect a Meta Business account via OAuth 2.0 |
| FR-LG-002 | System must fetch and display all Facebook Pages associated with the connected account |
| FR-LG-003 | User must be able to select one or more lead forms per page |
| FR-LG-004 | System must subscribe to Meta webhooks for each selected page |
| FR-LG-005 | System must receive `leadgen_id` from Meta webhook payload |
| FR-LG-006 | System must fetch full lead data from Meta Graph API using `leadgen_id` |
| FR-LG-007 | System must map Meta form fields to CRM standard and custom fields |
| FR-LG-008 | System must perform duplicate detection (email + phone match within org) |
| FR-LG-009 | Successfully ingested leads must appear in pipeline and inbox in real time |
| FR-LG-010 | System must handle Meta token refresh and expiry gracefully |

#### Detailed Workflow

| Step | Action |
|------|--------|
| 1 | User navigates to Integrations > Meta → clicks 'Connect Meta Account' |
| 2 | System redirects to Meta OAuth dialog with scopes: `leads_retrieval`, `pages_read_engagement`, `pages_show_list` |
| 3 | User grants permission → Meta redirects with auth code |
| 4 | Backend exchanges auth code for long-lived access token (60-day) via Graph API |
| 5 | System stores encrypted token in `meta_integrations` table with `organization_id` |
| 6 | Backend calls `GET /me/accounts` to fetch all user-owned Facebook Pages |
| 7 | Pages displayed in UI; user selects which pages to monitor |
| 8 | For each selected page: system calls `POST /{page_id}/subscribed_apps` to subscribe to leadgen webhook topic |
| 9 | User selects specific lead forms to capture (fetched via `GET /{page_id}/leadgen_forms`) |
| 10 | Selected form IDs stored in `meta_forms` table |
| 11 | When user submits Meta ad form: Meta sends `POST` to `/api/webhooks/meta` with `leadgen_id` |
| 12 | Backend verifies webhook signature using `X-Hub-Signature-256` header |
| 13 | Backend calls `GET /{leadgen_id}?fields=full_data` via Graph API |
| 14 | Response parsed: extract name, email, phone, custom questions |
| 15 | Field mapping applied: Meta field labels → CRM field IDs |
| 16 | Duplicate check: `query leads WHERE (email = ? OR phone = ?) AND organization_id = ?` |
| 17 | If duplicate: flag `is_duplicate = true`, merge or skip per org setting |
| 18 | If new: `INSERT` into leads with `source = 'meta_form'`, `source_ref = form_id` |
| 19 | Trigger automation workflows where `trigger_type = 'lead_created'` and source matches |
| 20 | Auto-assign to staff per assignment rules |
| 21 | Emit WebSocket event: `lead:created` → all connected clients in org update pipeline |
| 22 | Push notification to assigned staff member |

#### API Endpoints — Meta Integration

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/integrations/meta/oauth-url` | Returns Meta OAuth URL for frontend redirect | Admin |
| POST | `/api/integrations/meta/callback` | Exchanges OAuth code for access token | Admin |
| GET | `/api/integrations/meta/pages` | Fetches connected Meta pages | Admin |
| POST | `/api/integrations/meta/pages/:pageId/subscribe` | Subscribe page to webhook | Admin |
| GET | `/api/integrations/meta/forms/:pageId` | Fetch lead forms for a page | Admin |
| POST | `/api/integrations/meta/forms/select` | Save selected form IDs | Admin |
| POST | `/api/webhooks/meta` | Incoming Meta webhook receiver (public) | Signature verify |
| DELETE | `/api/integrations/meta/disconnect` | Revoke Meta integration | Admin |

#### Meta Webhook Payload Schema

```json
{
  "object": "page",
  "entry": [{
    "id": "<PAGE_ID>",
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "xxx",
        "page_id": "yyy",
        "form_id": "zzz",
        "created_time": 0
      }
    }]
  }]
}
```

---

### 4.2 Custom Forms

#### Overview
Allows organizations to build forms natively within the CRM. Each form generates a shareable public link and an embeddable script. Submissions create leads directly in the pipeline.

#### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-CF-001 | User must be able to create a named form with configurable fields |
| FR-CF-002 | Supported field types: text, email, phone, number, date, dropdown, checkbox, textarea, file upload |
| FR-CF-003 | Each field must support: label, placeholder, required flag, validation rules |
| FR-CF-004 | System must generate a unique public URL: `/f/{form_slug}` |
| FR-CF-005 | System must generate an embed script for website integration |
| FR-CF-007 | reCAPTCHA v3 integration must be supported to prevent bot submissions |
| FR-CF-008 | Submitted data must be mapped to CRM fields and create a lead record |
| FR-CF-009 | Forms must support custom redirect URL or thank-you message after submission |
| FR-CF-010 | Form analytics: view count, submission count, conversion rate displayed in UI |

#### Form Builder Data Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Form unique ID |
| organization_id | UUID | Tenant binding |
| name | VARCHAR(255) | Form display name (internal) |
| slug | VARCHAR(100) | URL slug (e.g., `contact-form`) |
| fields | JSONB | Ordered array of field config objects |
| pipeline_id | UUID | Default pipeline for leads from this form |
| stage_id | UUID | Default stage for leads from this form |
| redirect_url | TEXT | Post-submit redirect (optional) |
| thank_you_message | TEXT | Inline success message |
| is_active | BOOLEAN | Enable/disable form |
| recaptcha_enabled | BOOLEAN | reCAPTCHA toggle |
| submission_count | INTEGER | Total submissions counter |
| view_count | INTEGER | Total page view counter |
| created_at | TIMESTAMPTZ | Creation timestamp |

---

### 4.3 Landing Page Builder

#### Overview
A drag-and-drop page builder that allows organizations to create hosted landing pages with embedded CRM forms. Pages are hosted on the platform's CDN and use custom slugs.

#### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-LP-001 | User must be able to create landing pages with a visual block editor |
| FR-LP-002 | Supported block types: hero section, text/rich text, image, CTA button, embedded form, video embed, social proof, testimonials |
| FR-LP-003 | Pages must be hosted at `/p/{page_slug}` with custom domain support *(Phase 2)* |
| FR-LP-004 | Each page must be linkable to an existing CRM form |
| FR-LP-005 | Page builder must support mobile preview mode |
| FR-LP-006 | SEO fields: meta title, meta description, OG image per page |
| FR-LP-007 | Page analytics: views, form submissions, bounce indicators |
| FR-LP-008 | Published pages must be accessible without authentication |
| FR-LP-009 | Draft/publish state management for pages |

---

### 4.4 WhatsApp Lead Capture

#### Overview
When a new customer sends the first message to the organization's WhatsApp Business number, the system automatically creates a new lead record and attaches the conversation. Existing contacts are matched by phone number.

#### Detailed Workflow

| Step | Action |
|------|--------|
| 1 | Organization connects WhatsApp Business API (see WABA Integration section) |
| 2 | Customer sends a message to the business WhatsApp number |
| 3 | Meta WABA sends POST to `/api/webhooks/whatsapp` |
| 4 | Backend verifies webhook signature |
| 5 | Extract sender phone number (`wa_id`), message content, timestamp |
| 6 | Query `leads WHERE phone = wa_id AND organization_id = org_id` |
| 7 | If lead NOT found: create new lead with `source = 'whatsapp'`, name = phone number (to be updated later) |
| 8 | If lead found: retrieve existing lead record |
| 9 | Create/retrieve conversation record for this lead (`channel = whatsapp`) |
| 10 | Insert message into `messages` table |
| 11 | If new lead: trigger `lead_created` automations + assignment rules |
| 12 | Push real-time update via WebSocket to inbox and pipeline |
| 13 | Notify assigned staff (if any) via in-app notification |

#### WABA Integration Setup Flow

| Step | Action |
|------|--------|
| 1 | Admin navigates to Integrations > WhatsApp |
| 2 | Admin enters: Phone Number ID, WABA ID, Permanent Access Token from Meta Business Manager |
| 3 | System validates credentials via `GET /phone_number/{id}` on Graph API |
| 4 | System stores credentials encrypted in `waba_integrations` table |
| 5 | System registers webhook: `POST /{WABA_ID}/subscribed_apps` with fields: `messages`, `message_status_updates` |
| 6 | System sends test message to verify connectivity |
| 7 | Integration status shown as Active/Connected |

---

## 5. Module 2: Lead Management

Lead Management is the core operational module of the CRM. It provides a Kanban pipeline view, stage management, tagging, filtering, notes, follow-ups, and full lead lifecycle tracking.

### 5.1 Pipeline & Stages

#### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-PM-001 | Users must be able to create multiple named pipelines per organization |
| FR-PM-002 | Each pipeline must support unlimited stages with drag-to-reorder |
| FR-PM-003 | Stages must support: name, color, description, win probability (for opportunities) |
| FR-PM-004 | Leads must always belong to exactly one pipeline and one stage |
| FR-PM-005 | Default pipeline and stage must be configurable per form/source |
| FR-PM-006 | Pipeline view must render as Kanban board (columns = stages, cards = leads) |
| FR-PM-007 | Kanban must support drag-and-drop between stages with real-time sync |
| FR-PM-008 | Lead count and total deal value must be displayed per stage column header |
| FR-PM-009 | Stage movement must be logged in `activities` table with timestamps |
| FR-PM-010 | Moving a lead between stages might optionally trigger automation |

#### Pipeline Table Schema

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique pipeline ID |
| organization_id | UUID | Tenant binding (FK) |
| name | VARCHAR(255) | Pipeline name (e.g., Sales Pipeline) |
| description | TEXT | Optional description |
| is_default | BOOLEAN | Default pipeline for new leads |
| color | VARCHAR(7) | Hex color for UI display |
| created_by | UUID | User who created it |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### Stage Table Schema

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique stage ID |
| pipeline_id | UUID | Parent pipeline (FK) |
| organization_id | UUID | Tenant binding |
| name | VARCHAR(100) | Stage name (e.g., New, Contacted) |
| order_index | INTEGER | Display order (0-indexed) |
| color | VARCHAR(7) | Hex color for Kanban column |
| win_probability | INTEGER | 0–100%, used for revenue forecasting |
| is_closed_won | BOOLEAN | Final positive stage flag |
| is_closed_lost | BOOLEAN | Final negative stage flag |

---

### 5.2 Drag and Drop — Stage Movement

#### Detailed Technical Flow

| Step | Action |
|------|--------|
| 1 | User drags lead card from Stage A to Stage B in Kanban UI |
| 2 | Frontend optimistically updates UI (immediate visual feedback) |
| 3 | Frontend emits `PATCH /api/leads/{lead_id}/stage` with `{ stage_id: newStageId }` |
| 4 | Backend middleware validates JWT + `organization_id` |
| 5 | Backend checks RBAC: user has permission `leads:write` |
| 6 | Backend validates: new `stage_id` belongs to same pipeline + same organization |
| 7 | BEGIN database transaction |
| 8 | `UPDATE leads SET stage_id = newStageId, updated_at = now() WHERE id = leadId AND organization_id = orgId` |
| 9 | `INSERT into activities: { type: 'stage_changed', lead_id, from_stage_id, to_stage_id, user_id, timestamp }` |
| 10 | COMMIT transaction |
| 11 | Check workflows: find active workflows where `trigger_type = 'stage_changed'` for this pipeline/stage |
| 12 | Enqueue matching workflow executions to Bull queue |
| 13 | Emit WebSocket event to all org members: `{ type: 'lead:stage_updated', leadId, fromStage, toStage }` |
| 14 | Return 200 OK to initiating client; all other clients update their Kanban from WebSocket |

---

### 5.3 Tags

#### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-TAG-001 | Admins/Managers must be able to create org-wide tags with name and color |
| FR-TAG-002 | Any user with `lead:write` permission can add/remove tags from leads |
| FR-TAG-003 | Multiple tags can be attached to one lead simultaneously |
| FR-TAG-004 | Tags must be usable as filter criteria in pipeline and list views |
| FR-TAG-005 | Tags must be usable as trigger conditions in automation workflows |
| FR-TAG-006 | Tag additions/removals must be logged in the activity timeline |
| FR-TAG-007 | Tag list must show count of leads with that tag per organization |

---

### 5.4 Filters

| Filter Field | Type | Operators Available |
|-------------|------|---------------------|
| Stage | Enum (stage_id) | is, is not |
| Tag | Enum (tag_id) | has any, has all, has none |
| Assigned To | Enum (user_id) | is, is not, is unassigned |
| Source | Enum | is, is not |
| Date Created | Date Range | is on, is before, is after, is between |
| Date Updated | Date Range | is on, is before, is after, is between |
| Last Activity | Date Range | is before, is after |
| Custom Fields | Dynamic per field type | equals, contains, greater than, less than, is empty |
| Email | Text | contains, equals, is empty |
| Phone | Text | contains, equals, is empty |
| Lead Score | Number | greater than, less than, equals |

---

### 5.5 Import / Export

#### Import Flow

| Step | Action |
|------|--------|
| 1 | User clicks Import Leads → uploads CSV file (max 10MB) |
| 2 | System parses CSV header row → displays column mapping UI |
| 3 | User maps CSV columns to CRM fields (required: at least phone OR email) |
| 4 | System validates all rows: type checks, format validation, required fields |
| 5 | System shows preview: X valid, Y errors with row-by-row error details |
| 6 | User confirms import → system queues bulk insert job |
| 7 | Batch processing: INSERT 500 rows per transaction |
| 8 | Duplicate detection per batch: check email + phone within org |
| 9 | Duplicates flagged (not inserted unless override is selected) |
| 10 | On completion: notification with summary (inserted, skipped, errors) |
| 11 | All imported leads assigned to default pipeline/stage unless specified in CSV |

#### Export Flow

| Step | Action |
|------|--------|
| 1 | User selects leads (checkbox select or apply filters) |
| 2 | User clicks Export → selects format (CSV or Excel) |
| 3 | Backend validates: user has `leads:export` permission |
| 4 | Backend fetches all matching leads with all fields (standard + custom) |
| 5 | Generate CSV/XLSX in memory using streaming (no full load for large exports) |
| 6 | File streamed to client with `Content-Disposition: attachment` header |
| 7 | Export event logged in `activities` for audit trail |

---

### 5.6 Lead Card & Detail View

#### Lead Card (Kanban)

| UI Element | Data Source | Action on Interaction |
|-----------|-------------|----------------------|
| Lead name + avatar initials | leads.first_name + last_name | Opens lead detail panel |
| Phone number | leads.phone | Click to call (tel: link) or copy |
| Tag pills (up to 3 visible) | lead_tags JOIN tags | Click tag to filter by it |
| Assigned staff avatar | users.avatar_url | Tooltip shows name |
| Stage indicator bar | Current stage color | Visual only |
| Last activity timestamp | activities.created_at | Tooltip: activity description |
| Quick action icons | N/A | Follow-up, Note, Assign, Tag, Opportunity, Additional info — all open modals |

#### Lead Detail Panel Actions

| Action | Triggered By | Result |
|--------|-------------|--------|
| Create Opportunity | Icon or button in detail | Opens opportunity creation modal, creates record in `opportunities` table linked to lead |
| Add/Edit Custom Fields | Fields tab in detail | Inline editing of all custom field values stored in `lead_field_values` |
| Add Note | Note icon or tab | Free text note stored in `activities` table with `type='note'` |
| Set Follow-Up | Follow-up icon | Date/time picker + note → stores in `follow_ups` table, creates notification |
| Schedule Appointment | Calendar icon | Creates `calendar_event` linked to lead; sends reminders |
| Reassign Lead | Staff dropdown | Updates `leads.assigned_to`; optionally triggers assignment automation |
| Add/Remove Tag | Tag icon | Updates `lead_tags` junction table |
| Move Stage | Stage dropdown | Updates `leads.stage_id`; logs activity |
| View Timeline | Activity tab | Chronological list of all activities for this lead |
| Open Conversation | Chat icon | Opens inbox thread for this lead |

---

### 5.7 Opportunities

#### Schema

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique opportunity ID |
| organization_id | UUID | Tenant binding |
| lead_id | UUID | Linked lead (FK) |
| title | VARCHAR(255) | Opportunity name |
| value | DECIMAL(15,2) | Deal value in org's currency |
| currency | VARCHAR(3) | ISO 4217 currency code |
| pipeline_id | UUID | Associated pipeline |
| stage_id | UUID | Current sales stage |
| expected_close_date | DATE | Forecasted close date |
| probability | INTEGER | 0–100% win probability |
| status | VARCHAR(20) | open \| won \| lost |
| lost_reason | TEXT | Optional reason if status = lost |
| assigned_to | UUID | Owner user ID |
| created_at | TIMESTAMPTZ | Creation timestamp |

---

## 6. Module 3: Lead Automation

The Automation module is a visual workflow engine that allows users to define trigger-based automated actions. It powers WhatsApp messaging, email sending, lead assignments, internal notifications, and complex multi-step sequences.

### 6.1 Workflow Engine Architecture

#### Core Concepts

- **Workflow:** A named set of one trigger + one or more sequential actions
- **Trigger:** The event that initiates a workflow execution
- **Action:** A step executed in sequence when the workflow runs
- **Execution:** A single run of a workflow for a specific lead context
- **Context:** The lead record and its associated data available during execution

#### Trigger Types

| Trigger Type | Event Description | Available Conditions |
|-------------|-------------------|---------------------|
| `lead_created` | New lead created from any source | source = [meta_form \| custom_form \| whatsapp \| manual \| import] |
| `lead_created_source` | Lead created from specific source | source_id matches selected form/page |
| `stage_changed` | Lead moved to a different stage | from_stage_id, to_stage_id, pipeline_id |
| `tag_added` | Tag applied to a lead | tag_id = specific tag |
| `tag_removed` | Tag removed from a lead | tag_id = specific tag |
| `follow_up_due` | Follow-up date/time reached | Lead has overdue follow-up |
| `appointment_booked` | Appointment scheduled | Event type, assigned staff |
| `appointment_cancelled` | Appointment cancelled | Event type |
| `appointment_noshow` | No-show marked on appointment | None |
| `appointment_completed` | Show-up marked on appointment | None |
| `field_updated` | Custom field value changed | field_id = specific field, new value conditions |
| `inbound_message` | New inbound WhatsApp message | First message from new contact, keyword match |
| `manual` | Manually triggered by staff | None (on-demand execution) |

#### Action Types

| Action Type | Description | Required Config |
|------------|-------------|----------------|
| `send_whatsapp` | Send approved WhatsApp template message | template_id, variable mappings |
| `send_email` | Send email using template | template_id, from_name, reply_to |
| `send_sms` | Send SMS message *(Phase 2)* | sms_template_id, provider config |
| `delay` | Wait before next action | duration (minutes/hours/days) |
| `condition` | Branch based on lead field value | field, operator, value, true/false branches |
| `add_tag` | Add tag(s) to lead | tag_id(s) |
| `remove_tag` | Remove tag(s) from lead | tag_id(s) |
| `update_field` | Update a CRM field value | field_id, new_value (static or dynamic) |
| `update_stage` | Move lead to a stage | pipeline_id, stage_id |
| `assign_staff` | Assign lead to a user | user_id or 'round_robin' |
| `unassign_staff` | Remove current assignment | None |
| `internal_notification` | Send in-app notification to staff | user_id(s) or role, message template |
| `create_follow_up` | Create a follow-up task | days_from_now, note |
| `create_note` | Add a note to the lead | note_text (supports variables) |
| `trigger_workflow` | Execute another workflow | workflow_id |
| `exit_workflow` | Stop execution immediately | None |
| `webhook_call` | POST data to an external URL | url, headers, body template |

---

### 6.2 Workflow Execution Engine

#### Execution Flow

| Step | Action |
|------|--------|
| 1 | Event occurs in the system (e.g., lead created, stage changed) |
| 2 | Event published to internal event bus / emitter with full lead context |
| 3 | Automation service queries: `SELECT * FROM workflows WHERE organization_id = ? AND is_active = true AND trigger_type = ?` |
| 4 | For each matching workflow: evaluate `trigger_conditions` against lead context (JSON logic evaluation) |
| 5 | For workflows that pass condition check: create `workflow_execution` record with `status = 'pending'` |
| 6 | Execution job enqueued to Bull queue with lead context snapshot |
| 7 | Worker picks up job: loads `workflow.actions` array |
| 8 | Execute Action 1: process based on action type |
| 9 | If action = `delay`: re-enqueue job with delay offset using Bull's delayed jobs |
| 10 | If action = `condition`: evaluate condition, choose branch (true/false), continue with that branch's actions |
| 11 | If action = `send_whatsapp`: load template, replace variables from context, call WABA API |
| 12 | After each action: `UPDATE workflow_executions SET last_action_index = N, status = 'running'` |
| 13 | On completion: `UPDATE workflow_executions SET status = 'completed', completed_at = now()` |
| 14 | On error: `UPDATE status = 'failed', error_message = ...`; optionally retry based on action type |

#### Variable System

| Variable | Resolves To | Example Output |
|----------|-------------|----------------|
| `{%first_name%}` | leads.first_name | John |
| `{%last_name%}` | leads.last_name | Smith |
| `{%full_name%}` | first_name + ' ' + last_name | John Smith |
| `{%phone%}` | leads.phone | +919876543210 |
| `{%email%}` | leads.email | john@example.com |
| `{%assigned_to_name%}` | users.first_name of assigned user | Agent Sarah |
| `{%stage_name%}` | stages.name of current stage | Qualified |
| `{%pipeline_name%}` | pipelines.name | Sales Pipeline |
| `{%gmeeting%}` | calendar_events.meeting_link | https://meet.google.com/abc-xyz |
| `{%booking_link%}` | booking_links.public_url for assigned staff | https://crm.io/book/sarah |
| `{%org_name%}` | organizations.name | Acme Corp |
| `{%today%}` | Current date formatted | 13 April 2025 |
| `{%custom:field_slug%}` | lead_field_values for named field | Product: Enterprise Plan |

---

### 6.3 WABA Message Sending

#### Template Management
- Templates must be pre-approved by Meta before use in automation
- Templates stored with category (MARKETING, UTILITY, AUTHENTICATION), language, and component variables
- Template sync: system fetches approved templates from WABA API and stores locally
- Template variables (`{{1}}`, `{{2}}`) mapped to CRM variables in UI

#### Message Sending Flow

| Step | Action |
|------|--------|
| 1 | Automation action: `send_whatsapp` triggered |
| 2 | Load template record from DB: body, header, footer, buttons |
| 3 | Replace component variables with lead context data |
| 4 | Validate: `lead.phone` is in E.164 format |
| 5 | `POST to https://graph.facebook.com/v17.0/{phone_number_id}/messages` |
| 6 | Payload: `{ messaging_product: 'whatsapp', to: phone, type: 'template', template: { name, language, components } }` |
| 7 | Store message record: `{ lead_id, conversation_id, direction: 'outbound', status: 'sent', wamid: response.messages[0].id }` |
| 8 | Webhook callback from Meta updates status: `sent → delivered → read` |
| 9 | On webhook: `UPDATE messages SET status = new_status, status_updated_at = now()` |

---

### 6.4 Email Sending

- Email templates support HTML + plain text versions
- Variables replaced using same `{%variable%}` syntax
- Sending via SMTP or API-based providers (Resend, SendGrid, Postmark)
- Open tracking via 1x1 pixel image; click tracking via redirect URLs (optional)
- Bounces and complaints handled via provider webhooks → update lead activity
- Per-organization: configurable from name, reply-to address

---

## 7. Module 4: Inbox

The Inbox is the unified communication hub. It aggregates all conversations across channels (initially WhatsApp) and links them to lead records. Designed for high-volume real-time messaging.

### 7.1 Inbox Architecture

#### Data Model

| Table | Key Columns | Description |
|-------|-------------|-------------|
| `conversations` | id, lead_id, channel, assigned_to, status, unread_count, last_message_at | One conversation per lead per channel |
| `messages` | id, conversation_id, lead_id, direction (inbound/outbound), content, type (text/template/image/doc), status, wamid, sent_at | Individual messages |
| `internal_notes` | id, conversation_id, user_id, content, created_at | Private notes visible only to staff |
| `quick_replies` | id, organization_id, title, content, variables_used | Predefined response templates |

### 7.2 Conversation States

| State | Description |
|-------|-------------|
| `open` | Active conversation, awaiting response |
| `pending` | Waiting for customer reply after staff message |
| `resolved` | Manually closed by staff |
| `bot` | Managed by automation (no human intervention yet) |

### 7.3 Real-Time Messaging

#### Inbound Message Flow

| Step | Action |
|------|--------|
| 1 | Customer sends WhatsApp message → Meta webhook fires to `/api/webhooks/whatsapp` |
| 2 | Parse `wa_id` (phone), message body, `message_id` (wamid), timestamp |
| 3 | Lookup lead by phone + organization_id |
| 4 | If not found: create new lead, create new conversation |
| 5 | If found: retrieve existing conversation (`status != resolved`), or create new one |
| 6 | INSERT message record: `direction = 'inbound'` |
| 7 | UPDATE conversation: `last_message_at = now()`, `unread_count += 1` |
| 8 | If conversation has assigned staff: push WebSocket event to that user's socket room |
| 9 | Push WebSocket event to org-wide inbox channel for unread count update |
| 10 | Trigger `'inbound_message'` automations if active |

#### Outbound Message Flow

| Step | Action |
|------|--------|
| 1 | Staff types message in inbox UI → clicks Send (or selects quick reply) |
| 2 | Frontend `POST /api/conversations/{id}/messages` with `{ content, type }` |
| 3 | Backend validates: user is assigned to conversation OR has `inbox:write` permission |
| 4 | If type = template: validate template exists and is approved |
| 5 | Replace variables in template/message |
| 6 | Call WABA API to send message |
| 7 | On success: INSERT message record with `direction = 'outbound'`, `status = 'sent'` |
| 8 | UPDATE conversation: `unread_count = 0` for assigned staff |
| 9 | Return new message to frontend → display immediately |
| 10 | Webhook from Meta updates: `sent → delivered → read` status |

### 7.4 Inbox Filters

| Filter | Description |
|--------|-------------|
| All | All conversations in the org |
| Mine | Conversations assigned to the logged-in user |
| Unread | Conversations with `unread_count > 0` |
| Unassigned | Conversations where `assigned_to IS NULL` |
| Resolved | Closed conversations |
| By Channel | Filter by whatsapp / email / sms |

---

## 8. Module 5: Fields

The Fields module allows organizations to extend the default lead schema with custom fields, map external form fields to CRM fields, and use dynamic variables across templates and automations.

### 8.1 Custom Fields

#### Supported Field Types

| Field Type | Storage | UI Control | Validation |
|-----------|---------|-----------|-----------|
| text | TEXT in JSONB | Single-line input | Max length configurable |
| textarea | TEXT in JSONB | Multi-line input | Max length configurable |
| number | NUMERIC in JSONB | Number input | Min/max range optional |
| decimal | DECIMAL in JSONB | Number input with decimals | Min/max range optional |
| date | DATE in JSONB (ISO 8601) | Date picker | Min/max date optional |
| datetime | TIMESTAMPTZ in JSONB | DateTime picker | Timezone-aware |
| dropdown | VARCHAR in JSONB | Select dropdown | Options list required |
| multi_select | JSON array in JSONB | Multi-select checkboxes | Options list required |
| checkbox | BOOLEAN in JSONB | Toggle/checkbox | None |
| url | TEXT in JSONB | URL input | Valid URL format check |
| email | VARCHAR in JSONB | Email input | Valid email format |
| phone | VARCHAR in JSONB | Phone input | E.164 optional |
| file | TEXT (S3 key) in JSONB | File upload | Max file size, allowed types |

#### Custom Field Schema

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Field definition ID |
| organization_id | UUID | Tenant binding |
| name | VARCHAR(100) | Display label |
| slug | VARCHAR(100) | Machine-readable key for variable use |
| type | VARCHAR(50) | Field type enum |
| is_required | BOOLEAN | Required flag for form validation |
| is_visible_in_list | BOOLEAN | Show in lead list view |
| options | JSONB | Dropdown/multi-select choices |
| validation_rules | JSONB | Min, max, regex, allowed types |
| order_index | INTEGER | Display order in UI |
| created_at | TIMESTAMPTZ | Creation timestamp |

### 8.2 Field Mapping

Field mapping allows incoming data from external sources (Meta forms, CSV imports, custom forms) to be automatically mapped to CRM fields.

- One mapping config per source per organization
- Source fields: Meta form question labels, CSV column headers, landing page form field IDs
- Target fields: any standard or custom CRM field
- Mappings stored in JSONB: `{ 'Source Field Name': 'crm_field_id' }`
- Unmapped fields stored in a `raw_data` JSONB column for later review

### 8.3 Variables in Templates

Any field with a defined `slug` automatically becomes available as a variable in templates: `{%custom:your_slug%}`. Standard fields have predefined variable names. Variables are resolved at execution time from the lead's current data.

---

## 9. Module 6: Calendar

The Calendar module provides appointment scheduling, booking link generation, availability management, and event lifecycle tracking. It integrates with the inbox and automation modules.

### 9.1 Booking System

#### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-CAL-001 | Staff can create booking link types (e.g., 30-min Demo, 1-hr Consultation) |
| FR-CAL-002 | Each booking link has a public URL: `/book/{org_slug}/{staff_slug}/{event_type}` |
| FR-CAL-003 | Booking page shows available time slots based on staff availability |
| FR-CAL-004 | Visitor selects a slot, fills their details → creates lead (if not existing) + calendar_event |
| FR-CAL-005 | Confirmation email/WhatsApp sent to both the visitor and the staff member |
| FR-CAL-006 | Slots already booked are hidden or shown as unavailable |
| FR-CAL-007 | Buffer time between appointments must be configurable |
| FR-CAL-008 | Timezone detection and display for the booking visitor |
| FR-CAL-009 | Configurable number of meetings allowed per slot |

#### Calendar Event Schema

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Event ID |
| organization_id | UUID | Tenant binding |
| lead_id | UUID | Associated lead (optional) |
| booking_link_id | UUID | Source booking link if from self-booking |
| assigned_to | UUID | Staff hosting the event |
| title | VARCHAR(255) | Event title |
| type | VARCHAR(50) | meeting \| demo \| call \| custom |
| status | VARCHAR(20) | scheduled \| completed \| cancelled \| rescheduled \| noshow |
| start_at | TIMESTAMPTZ | Event start time |
| end_at | TIMESTAMPTZ | Event end time |
| timezone | VARCHAR(50) | IANA timezone string |
| meeting_link | TEXT | Google Meet / Zoom / custom URL |
| location | TEXT | Physical location (optional) |
| notes | TEXT | Internal notes |
| reminder_sent | BOOLEAN | Reminder notification sent flag |
| created_at | TIMESTAMPTZ | Booking creation time |

### 9.2 Availability Management

#### Schema

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Availability record ID |
| user_id | UUID | Staff member |
| organization_id | UUID | Tenant binding |
| day_of_week | INTEGER | 0=Sun, 1=Mon ... 6=Sat |
| start_time | TIME | Availability start (e.g., 09:00) |
| end_time | TIME | Availability end (e.g., 18:00) |
| timezone | VARCHAR(50) | Staff's working timezone |
| is_active | BOOLEAN | Whether this day is active |

### 9.3 Booking Flow

| Step | Action |
|------|--------|
| 1 | Staff creates booking link with: event type, duration, buffer time, description |
| 2 | System generates public URL and stores in `booking_links` table |
| 3 | Visitor opens booking URL |
| 4 | Backend calculates available slots: fetch `availability_slots` for staff, subtract existing `calendar_events` and buffer times |
| 5 | Slots shown in visitor's local timezone |
| 6 | Visitor selects slot → fills name, phone, email, optional notes |
| 7 | `POST /api/public/book/{booking_link_id}` |
| 8 | Backend: check slot still available (race condition prevention with DB lock) |
| 9 | Create/find lead by phone or email |
| 10 | INSERT `calendar_event` with `status = 'scheduled'` |
| 11 | Send confirmation: WhatsApp template to visitor's phone + email to visitor's email |
| 12 | Send notification to staff member via in-app + email |
| 13 | Event appears in staff's calendar view |

### 9.4 Event Status Actions

| Status Transition | Who Can Take Action | System Actions |
|------------------|---------------------|----------------|
| scheduled → completed | Staff member or admin | Log activity, trigger `appointment_completed` automation, prompt for follow-up |
| scheduled → cancelled | Staff, admin, or visitor | Remove slot, notify counterpart, trigger `appointment_cancelled` automation |
| scheduled → rescheduled | Staff or admin | Create new event, cancel old, notify visitor |
| scheduled → noshow | Staff member | Log activity, trigger `appointment_noshow` automation |

---

## 10. Module 7: Staff

The Staff module covers team management, RBAC (Role-Based Access Control), lead assignment, and performance tracking. Security and data isolation are enforced at every level.

### 10.1 Team Management

#### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-ST-001 | Admin can invite staff via email; invitation link expires in 48 hours |
| FR-ST-002 | Invited user sets their password on first login (4 digit PIN) |
| FR-ST-003 | Admin can deactivate (not delete) staff accounts |
| FR-ST-004 | Deactivated staff's leads and conversations remain visible but unassigned |
| FR-ST-005 | Staff list shows: name, role, email, status, leads assigned, last active |

### 10.2 Roles & Permissions

#### Default Roles

| Role | Scope | Default Capabilities |
|------|-------|---------------------|
| Super Admin | Platform-wide | Full access to all organizations, billing, system config. Assigned by platform team only. |
| Admin | Organization-wide | All modules, all settings, staff management, integrations, billing for their org |
| Manager | Organization-wide | All leads, all staff, reports, pipelines, automations. Cannot modify billing or integrations. |
| Agent | Assigned only (default) | Only leads assigned to them, inbox for their conversations, calendar for their events |
| Custom Role | Configurable | Admin-defined combination of permissions |

#### Permission Definitions

| Permission Key | Module | Description |
|---------------|--------|-------------|
| `leads:view_all` | Leads | View all org leads (not just assigned) |
| `leads:view_own` | Leads | View only assigned leads |
| `leads:create` | Leads | Create new leads manually |
| `leads:edit` | Leads | Edit lead data |
| `leads:delete` | Leads | Delete leads (soft delete) |
| `leads:export` | Leads | Export leads to CSV/Excel |
| `leads:import` | Leads | Bulk import leads |
| `leads:assign` | Leads | Assign leads to staff |
| `pipeline:manage` | Pipeline | Create/edit pipelines and stages |
| `automation:view` | Automation | View workflows |
| `automation:manage` | Automation | Create/edit/delete workflows |
| `inbox:view_all` | Inbox | View all conversations |
| `inbox:view_own` | Inbox | View assigned conversations only |
| `inbox:send` | Inbox | Send messages |
| `calendar:view_all` | Calendar | View all appointments |
| `calendar:manage` | Calendar | Create/edit/cancel appointments |
| `staff:view` | Staff | View staff list |
| `staff:manage` | Staff | Add/edit/deactivate staff |
| `settings:manage` | Settings | Manage org settings and integrations |
| `reports:view` | Reports | Access analytics and reports |

### 10.3 RBAC Enforcement

#### Middleware Layer

| Step | Action |
|------|--------|
| 1 | Incoming request hits API route |
| 2 | JWT middleware: decode token, validate signature, check expiry |
| 3 | Attach `req.user = { id, organization_id, roles[] }` to request |
| 4 | Route-specific permission guard: `checkPermission('leads:view_all')` |
| 5 | Permission guard queries user's role permissions from DB (cached in Redis for 5 min) |
| 6 | If permission not found in user's role: return 403 Forbidden |
| 7 | Organization scope check: all DB queries auto-filter by `req.user.organization_id` |
| 8 | For 'own' permissions: additional filter `WHERE assigned_to = req.user.id` applied |

### 10.4 Assignment

#### Round-Robin Auto Assignment
- Org admin configures round-robin pool: select which agents participate
- Pool and current index stored in Redis: key = `'rr:{org_id}'`, value = current_index
- When a lead is created: INCR Redis counter → assign to `agents[index % agents.length]`
- Agents on leave or inactive are excluded from the pool in real time
- Round-robin can be filtered by source: different pools for different form sources

### 10.5 Performance Tracking

| Metric | Calculation Method | Display |
|--------|-------------------|---------|
| Leads Handled | COUNT(leads) WHERE assigned_to = user_id in date range | Number |
| Leads Converted | COUNT(leads) WHERE is_converted = true AND assigned_to = user_id | Number + % |
| Avg Response Time | AVG(first_outbound_message.sent_at - conversation.created_at) | Minutes |
| Conversations Resolved | COUNT(conversations) WHERE status = resolved AND assigned_to = user_id | Number |
| Appointments Completed | COUNT(calendar_events) WHERE status = completed AND assigned_to = user_id | Number |
| Follow-ups Completed | COUNT(follow_ups) WHERE completed = true AND assigned_to = user_id | Number |

---

## 11. API Design Standards

### 11.1 REST API Conventions

- **Base URL:** `/api/v1/`
- All requests/responses in JSON (`Content-Type: application/json`)
- **Authentication:** `Authorization: Bearer <jwt>` on every request
- **Organization scoping:** automatic from JWT; no org_id in URL path needed
- **Pagination:** cursor-based for large datasets; page-based for smaller lists
- **Error responses:** `{ error: { code: string, message: string, details?: object } }`
- **Success responses:** `{ data: T, meta?: { total, page, cursor } }`

### 11.2 Core API Endpoints Reference

| Method | Endpoint | Permission Required | Description |
|--------|----------|---------------------|-------------|
| GET | `/api/v1/leads` | leads:view_all OR leads:view_own | List leads with filters, pagination |
| POST | `/api/v1/leads` | leads:create | Create a new lead manually |
| GET | `/api/v1/leads/:id` | leads:view_all OR leads:view_own | Get single lead with all details |
| PATCH | `/api/v1/leads/:id` | leads:edit | Update lead fields |
| DELETE | `/api/v1/leads/:id` | leads:delete | Soft-delete lead |
| PATCH | `/api/v1/leads/:id/stage` | leads:edit | Move lead to a different stage |
| POST | `/api/v1/leads/:id/tags` | leads:edit | Add tags to lead |
| DELETE | `/api/v1/leads/:id/tags/:tagId` | leads:edit | Remove tag from lead |
| GET | `/api/v1/leads/:id/activities` | leads:view_all OR own | Get lead activity timeline |
| POST | `/api/v1/leads/:id/notes` | leads:edit | Add note to lead |
| POST | `/api/v1/leads/:id/follow-ups` | leads:edit | Create follow-up task |
| GET | `/api/v1/pipelines` | pipeline:manage | List all pipelines |
| POST | `/api/v1/pipelines` | pipeline:manage | Create pipeline |
| GET | `/api/v1/pipelines/:id/leads` | leads:view_all OR own | Leads in pipeline (Kanban) |
| GET | `/api/v1/conversations` | inbox:view_all OR view_own | List conversations |
| GET | `/api/v1/conversations/:id/messages` | inbox:view_all OR own | Get messages in conversation |
| POST | `/api/v1/conversations/:id/messages` | inbox:send | Send a message |
| PATCH | `/api/v1/conversations/:id/assign` | leads:assign | Assign conversation |
| GET | `/api/v1/workflows` | automation:view | List workflows |
| POST | `/api/v1/workflows` | automation:manage | Create workflow |
| PATCH | `/api/v1/workflows/:id` | automation:manage | Update workflow |
| GET | `/api/v1/staff` | staff:view | List all staff in org |
| POST | `/api/v1/staff/invite` | staff:manage | Invite new staff member |
| PATCH | `/api/v1/staff/:id` | staff:manage | Update staff / deactivate |
| GET | `/api/v1/calendar/events` | calendar:view_all OR own | List calendar events |
| POST | `/api/v1/calendar/events` | calendar:manage | Create appointment manually |
| PATCH | `/api/v1/calendar/events/:id/status` | calendar:manage | Update event status |
| POST | `/api/v1/leads/import` | leads:import | Bulk import leads from CSV |
| GET | `/api/v1/leads/export` | leads:export | Export leads to CSV/Excel |
| GET | `/api/v1/fields` | settings:manage | List custom fields |
| POST | `/api/v1/fields` | settings:manage | Create custom field |

### 11.3 WebSocket Events

| Event Name | Direction | Payload | Consumer |
|-----------|-----------|---------|----------|
| `lead:created` | Server → Client | `{ lead: LeadObject }` | Pipeline, Inbox |
| `lead:stage_updated` | Server → Client | `{ leadId, fromStage, toStage }` | Pipeline (Kanban) |
| `lead:assigned` | Server → Client | `{ leadId, assignedTo }` | Pipeline, Inbox |
| `lead:updated` | Server → Client | `{ leadId, changes }` | Lead Detail Panel |
| `conversation:new_message` | Server → Client | `{ conversationId, message }` | Inbox |
| `conversation:assigned` | Server → Client | `{ conversationId, assignedTo }` | Inbox |
| `conversation:status_changed` | Server → Client | `{ conversationId, status }` | Inbox |
| `notification:new` | Server → Client | `{ notification }` | Notification bell |
| `calendar:event_updated` | Server → Client | `{ eventId, status }` | Calendar |
| `workflow:execution_log` | Server → Client | `{ workflowId, status, action }` | Automation logs |

---

## 12. Security Requirements

### 12.1 Input Validation & Sanitization

- All API inputs validated using Zod or Joi schema before any processing
- String fields: max length enforced, HTML stripped using DOMPurify equivalent
- SQL: all queries via ORM (Prisma/Drizzle) or parameterized queries — never string concatenation
- File uploads: MIME type validation, filename sanitization, size limits, virus scanning *(Phase 2)*
- Phone numbers: normalized to E.164 format on ingestion
- Email: lowercased and format-validated on ingestion

### 12.2 Network Security

- All communications: HTTPS/TLS 1.2+ enforced; HTTP requests redirect to HTTPS
- HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- Rate limiting: 100 req/min per authenticated user; 20 req/min for public endpoints
- IP-based rate limiting for login endpoint: 10 attempts/15 minutes per IP
- CORS: strict whitelist of allowed origins; no wildcard in production
- Webhook endpoints: signature verification mandatory (HMAC-SHA256)

### 12.3 Data Security

- Sensitive secrets (API keys, tokens): encrypted at rest using AES-256 before DB storage
- Passwords: bcrypt with cost factor 12; never stored in plaintext or reversible form
- All PII fields: access logged for audit purposes
- **Soft deletes only:** leads, conversations, staff records never hard-deleted
- Database backups: daily automated backups with 30-day retention
- Organization data isolation: enforced at both application layer and database (RLS)

### 12.4 Session Security

- Access tokens: 15-minute expiry, stored in memory (never localStorage)
- Refresh tokens: 7-day expiry, HttpOnly + Secure + SameSite=Strict cookies
- Token rotation: new refresh token issued on every use (one-time use)
- Concurrent session limit: configurable per org (default: 5 sessions per user)
- Force logout: admin can invalidate all sessions for a user
- Activity timeout: auto-logout after 30 minutes of inactivity (configurable)

---

## 13. Performance Requirements

### 13.1 Response Time Targets

| Operation | P50 Target | P95 Target | P99 Target |
|-----------|-----------|-----------|-----------|
| Lead list (paginated, 50 items) | < 80ms | < 150ms | < 300ms |
| Lead detail view | < 60ms | < 120ms | < 250ms |
| Pipeline Kanban load (all stages) | < 200ms | < 400ms | < 800ms |
| Send WhatsApp message | < 300ms | < 600ms | < 1500ms |
| Inbound webhook processing | < 100ms | < 200ms | < 500ms |
| Search leads (full-text) | < 150ms | < 300ms | < 600ms |
| Bulk import (1000 rows) | < 5s | < 10s | < 30s |
| CSV export (10,000 leads) | < 8s | < 15s | < 30s |

### 13.2 Optimization Strategies

#### Database
- **Indexes:** `organization_id` on every table; composite indexes on `(org_id, stage_id)`, `(org_id, assigned_to)`, `(org_id, created_at)`
- **Query optimization:** `EXPLAIN ANALYZE` used during development for any query affecting > 1000 rows
- **Connection pooling:** PgBouncer or Prisma's built-in pool (max 20 connections per API instance)
- **Pagination:** cursor-based pagination for lead lists (keyset pagination avoids OFFSET performance degradation)
- **Archival:** leads older than 2 years can be moved to a separate archive table *(Phase 2)*

#### Caching
- Redis caching for: user permissions (5-min TTL), pipeline/stage lists (1-min TTL), template lists (10-min TTL)
- Cache invalidation: explicit on write operations; no stale-forever data
- CDN: static assets (JS, CSS, images) served via Cloudflare or similar CDN

#### Frontend
- Code splitting: each module loaded lazily (not bundled in initial load)
- Virtualized lists: React-virtual for leads lists > 100 items
- WebSocket: single connection per session, multiplexed rooms
- Optimistic UI updates: for stage moves, tag updates — no wait for server confirmation
- Image optimization: all avatars and uploads served via CDN with WebP format

---

## 14. Error Handling & Resilience

### 14.1 API Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Input failed schema validation |
| 400 | `DUPLICATE_LEAD` | Lead with same phone/email already exists |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 401 | `TOKEN_EXPIRED` | Access token expired (client should refresh) |
| 403 | `FORBIDDEN` | User lacks permission for this action |
| 404 | `NOT_FOUND` | Resource not found or not in org scope |
| 409 | `CONFLICT` | Resource state conflict (e.g., slot already booked) |
| 422 | `BUSINESS_RULE_VIOLATION` | Action violates business logic |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests; includes Retry-After header |
| 500 | `INTERNAL_ERROR` | Unexpected server error; logged with trace ID |
| 503 | `SERVICE_UNAVAILABLE` | Dependency (Meta API, WABA) temporarily down |

### 14.2 Webhook Resilience

- All incoming webhooks: acknowledge with 200 OK within 5 seconds (Meta requirement)
- Processing: async via queue after acknowledgment; never block on webhook handler
- Failed webhook processing: up to 3 retries with exponential backoff (1min, 5min, 30min)
- Dead-letter queue: permanently failed jobs moved to DLQ for manual inspection
- Webhook logs: every incoming webhook stored in `webhook_logs` table for 30 days

### 14.3 Automation Error Handling

- Failed action in workflow: log error, continue to next action (non-blocking default)
- Critical action failures (e.g., WABA API down): pause execution + notify admin
- Workflow execution timeout: max 30 minutes per execution before forced termination
- Error details visible in automation execution log UI per workflow

---

## 15. UI/UX Requirements

### 15.1 Design Principles

- **Mobile-first:** all screens fully functional on 375px wide screens and up
- **Loading states:** every async operation shows a skeleton or spinner
- **Empty states:** every list/view has a helpful empty state with a call to action
- **Error feedback:** every form error shown inline next to the field
- **Confirmation dialogs:** required for destructive actions (delete, bulk remove)
- **Keyboard navigation:** all interactive elements reachable via keyboard (WCAG 2.1 AA target)
- **Undo support:** stage moves and tag changes should be reversible for 5 seconds

### 15.2 Navigation Structure

| Nav Item | Sub-menu Items | Default View |
|----------|---------------|-------------|
| Lead Generation | Meta Forms, Custom Forms, Landing Pages, WhatsApp | Integration status overview |
| Lead Management | Pipeline, Contacts, Import/Export | Kanban pipeline |
| Automation | Workflows, Templates, Execution Logs | Workflow list |
| Inbox | All, Mine, Unread, Unassigned, Resolved | All conversations |
| Fields | Custom Fields, Field Mapping, Variables | Field list |
| Calendar | My Calendar, All Events, Booking Links | Month view |
| Staff | Team, Roles, Performance | Staff list |
| Settings | Org Settings, Integrations, Billing, Notifications | General settings |

### 15.3 Mobile-Specific Requirements

- Bottom navigation bar for primary modules on mobile
- Swipe gestures: swipe lead card left/right for quick actions on mobile
- Touch-optimized: minimum 44px tap targets for all interactive elements
- Offline indicator: clear banner when internet connection lost
- PWA requirements: installable, push notifications, home screen icon *(Phase 2)*

---

## 16. Testing Requirements

### 16.1 Test Coverage Targets

| Test Type | Coverage Target | Tool | Focus Areas |
|-----------|----------------|------|-------------|
| Unit Tests | > 80% line coverage | Jest / Vitest | Service layer, utility functions, validators |
| Integration Tests | > 70% critical paths | Supertest + test DB | API endpoints, DB queries, auth flows |
| E2E Tests | All primary user flows | Playwright or Cypress | Lead creation, pipeline management, inbox messaging |
| Load Tests | 500 concurrent users | k6 or Artillery | API endpoints, WebSocket, bulk operations |
| Security Tests | OWASP Top 10 | OWASP ZAP, manual | Injection, auth, CORS, rate limits |
| Accessibility Tests | WCAG 2.1 AA | axe-core, manual | Screen reader, keyboard nav, contrast |

### 16.2 Acceptance Criteria (Critical Scenarios)

#### AC-1: Lead Created via Meta Webhook
- **GIVEN:** A valid Meta webhook POST arrives at `/api/webhooks/meta`
- **WHEN:** `leadgen_id` is valid and form is subscribed by the organization
- **THEN:** Lead appears in pipeline within 3 seconds, automation is triggered, assigned staff is notified

#### AC-2: Stage Move via Drag-and-Drop
- **GIVEN:** Two browser sessions open for the same organization
- **WHEN:** User A drags lead from Stage 1 to Stage 2
- **THEN:** Lead card moves in User A's UI immediately; User B's Kanban updates within 1 second via WebSocket

#### AC-3: WhatsApp Message Delivery
- **GIVEN:** Workflow triggers `send_whatsapp` action for a lead with a valid phone
- **WHEN:** WABA API returns success response
- **THEN:** Message status shows 'Sent'; updates to 'Delivered' and 'Read' when Meta webhooks arrive

#### AC-4: Multi-Tenant Isolation
- **GIVEN:** Two organizations exist in the system
- **WHEN:** An authenticated user from Org A makes any API request
- **THEN:** No data from Org B is ever returned; all queries implicitly scoped to Org A

#### AC-5: Rate Limiting on Login
- **GIVEN:** A login endpoint receiving rapid requests
- **WHEN:** 6 failed login attempts are made for the same email within 15 minutes
- **THEN:** Account is locked; subsequent attempts return 429 with `Retry-After` header

---

## 17. Deployment & Infrastructure

### 17.1 Recommended Infrastructure

| Environment | Host | Purpose |
|------------|------|---------|
| Development | localhost | For testing |
| Production | VPS / Hostinger | For deployment |

### 17.2 Environment Strategy

- **Development:** local Docker Compose stack with seed data
- **Staging:** mirrors production; used for QA, load testing, and client demos
- **Production:** multi-AZ deployment, automated backups, monitoring alerts
- **CI/CD:** GitHub Actions; automated tests on PR; deploy to staging on merge to main; manual promote to prod

### 17.3 Environment Variables (Required)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_PRIVATE_KEY` | RS256 private key for signing JWTs |
| `JWT_PUBLIC_KEY` | RS256 public key for verifying JWTs |
| `META_APP_SECRET` | Facebook App Secret for webhook verification |
| `ENCRYPTION_KEY` | AES-256 key for encrypting stored secrets |
| `SMTP_HOST / API_KEY` | Email sending credentials |
| `AWS_ACCESS_KEY_ID` | S3/R2 file storage access |
| `FRONTEND_URL` | Allowed CORS origin |
| `WEBHOOK_BASE_URL` | Public URL for receiving webhooks from Meta/WABA |

---

## 18. Development Phases & Milestones

| Phase | Duration | Deliverables | Priority |
|-------|----------|-------------|----------|
| **Phase 1 — Foundation** | Weeks 1–4 | Auth system, multi-tenancy, user/org management, RBAC, basic lead CRUD, pipeline + Kanban, stages, manual lead creation | Critical |
| **Phase 2 — Lead Capture** | Weeks 5–8 | Meta Forms integration, Custom Forms builder, WhatsApp lead capture, WABA integration, webhook handlers, duplicate detection, real-time pipeline updates | Critical |
| **Phase 3 — Communication** | Weeks 9–12 | Inbox module, real-time messaging, conversation management, assignment system, message status tracking, internal notes, quick replies | Critical |
| **Phase 4 — Automation** | Weeks 13–17 | Workflow engine, all trigger types, all action types, delay queue, WhatsApp template management, email sending, variable system, execution logs | High |
| **Phase 5 — Calendar** | Weeks 18–20 | Booking links, availability management, appointment scheduling, event status management, reminders, calendar UI | High |
| **Phase 6 — Advanced Features** | Weeks 21–24 | Landing page builder, custom fields, field mapping, CSV import/export, opportunities, contact groups, performance tracking, advanced filters | Medium |
| **Phase 7 — Polish & Scale** | Weeks 25–28 | Performance optimization, load testing, mobile PWA, accessibility audit, analytics dashboard, documentation, launch prep | Medium |

### 18.1 MVP Scope (Phases 1–3)

The Minimum Viable Product for initial user testing and early customer onboarding includes: **authentication, multi-tenancy, lead management with pipeline/Kanban, Meta Forms integration, WhatsApp lead capture, and the Inbox module**. This represents the core value loop of the product.

---

## 19. Open Questions & Decisions Required

| # | Question | Impact | Owner |
|---|----------|--------|-------|
| OQ-1 | Will the platform support custom domains per organization (e.g., `crm.acmecorp.com`)? | Architecture, DNS, SSL management | Product + Infra |
| OQ-2 | What is the data retention policy for deleted leads? Soft delete only, or hard delete after N days? | GDPR compliance, storage costs | Legal + Product |
| OQ-3 | Is SMS (non-WhatsApp) a requirement in Phase 1 or Phase 2? | Third-party SMS provider integration | Product |
| OQ-4 | What languages/locales must the UI support at launch? | i18n infrastructure, translations | Product |
| OQ-5 | Will the platform offer a public API for third-party integrations (Zapier, etc.)? | API key management, rate limiting | Product |
| OQ-6 | Are there specific GDPR / data residency requirements (EU data storage)? | Database region selection | Legal |
| OQ-7 | What is the policy for lead assignment when the assigned agent is deactivated? | Automatic reassignment logic | Product |
| OQ-8 | Should the landing page builder support custom code injection (GTM, pixels)? | Security review required | Product + Security |

---

## 20. Glossary

| Term | Definition |
|------|-----------|
| **Organization (Tenant)** | A company or business using the CRM platform. All data is isolated per organization. |
| **Lead** | A person or contact who has expressed interest; the central unit of the CRM. |
| **Pipeline** | A configurable sequence of stages that represents a sales or qualification process. |
| **Stage** | A step within a pipeline (e.g., New, Contacted, Qualified, Closed Won). |
| **WABA** | WhatsApp Business API — the official Meta API for business messaging at scale. |
| **Workflow** | An automation rule consisting of one trigger and one or more sequential actions. |
| **Trigger** | The event that starts a workflow execution (e.g., lead created, stage changed). |
| **Action** | A step in a workflow that performs an operation (e.g., send WhatsApp, add tag). |
| **Variable** | A dynamic placeholder (`{%name%}`) that is replaced with lead data at runtime. |
| **RBAC** | Role-Based Access Control — the permission system controlling what users can see and do. |
| **Kanban** | A visual board where columns represent stages and cards represent leads. |
| **Conversation** | A thread of messages between a lead and the organization via a channel (WhatsApp, etc.). |
| **WebSocket** | A persistent, real-time bidirectional connection between browser and server. |
| **JWT** | JSON Web Token — a signed, stateless token used for authentication. |
| **E.164** | International phone number format: +[country code][number], e.g., +919876543210. |
| **leadgen_id** | Meta's unique identifier for a lead form submission, used to fetch full lead data. |
| **Round-Robin** | An assignment strategy that distributes leads evenly across available agents in rotation. |
| **Soft Delete** | Marking a record as deleted without removing it from the database (`is_deleted` flag). |

---

*— End of Document —*

> **CRM SaaS Platform PRD v1.0 | Confidential**