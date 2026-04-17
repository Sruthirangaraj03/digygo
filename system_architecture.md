# System Architecture
## CRM SaaS Platform

---

## Architecture Pattern

**Multi-Tenant SaaS** with full data isolation per organization (tenant).

Every database table includes an `organization_id` column. This is applied as a mandatory filter on every query — both at the application layer (middleware) and at the database layer (PostgreSQL Row-Level Security). No cross-tenant data leakage is permitted under any circumstances.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│          Browser (React)   Mobile (PWA/RN)              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────────────────┐
│              API Gateway (Nginx / Cloudflare)            │
│         Rate Limiting · SSL Termination · DDoS           │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  Backend API Server                      │
│              Node.js + Express / NestJS                  │
│                                                          │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │ REST API   │  │  WebSocket  │  │ Webhook Receivers │  │
│  │ /api/v1/  │  │  Socket.io  │  │ /api/webhooks/   │  │
│  └────────────┘  └─────────────┘  └──────────────────┘  │
└────────┬─────────────────┬──────────────────────────────┘
         │                 │
┌────────▼──────┐  ┌───────▼────────┐  ┌─────────────────┐
│  PostgreSQL   │  │     Redis      │  │   File Storage  │
│  (Primary DB) │  │ Cache + Queue  │  │   S3 / R2 + CDN │
└───────────────┘  └───────┬────────┘  └─────────────────┘
                           │
                   ┌───────▼────────┐
                   │  BullMQ Worker │
                   │ (Automation    │
                   │  Execution)    │
                   └───────┬────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │  Meta WABA  │  │    SMTP /   │  │   External  │
   │  Graph API  │  │   Resend    │  │  Webhooks   │
   └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Multi-Tenancy Model

| Layer | Enforcement Mechanism |
|-------|-----------------------|
| Application | `organization_id` injected from JWT in every middleware; all DB queries auto-scoped |
| Database | PostgreSQL Row-Level Security (RLS) as secondary safeguard |
| Routing | Subdomain or path-based routing per org (`acme.yourcrm.com`) |
| Isolation | Each org has isolated: leads, pipelines, staff, automation, templates, integrations |

**Shared across all tenants (system-wide only):**
- `plans` table
- `countries` / locale config

---

## Request Lifecycle

```
Client Request
     │
     ▼
Nginx (SSL termination + rate limiting)
     │
     ▼
Express/NestJS Route Handler
     │
     ├─► JWT Middleware
     │       └─ Decode token → validate signature → check expiry
     │       └─ Attach req.user = { id, organization_id, roles[] }
     │
     ├─► RBAC Permission Guard
     │       └─ checkPermission('leads:view_all')
     │       └─ Permission set fetched from Redis (5-min cache)
     │       └─ 403 if permission missing
     │
     ├─► Input Validation (Zod/Joi schema)
     │       └─ 400 VALIDATION_ERROR if schema fails
     │
     ├─► Business Logic / Service Layer
     │       └─ All DB queries auto-filter by organization_id
     │
     ├─► Database (PostgreSQL via ORM)
     │
     └─► Response { data: T, meta?: { total, page, cursor } }
```

---

## Authentication & Session Flow

```
1. POST /api/auth/login (email + password)
         │
         ▼
2. bcrypt.compare(password, hash)
         │
         ▼
3. Generate:
   - Access Token  → JWT RS256, 15-min TTL
   - Refresh Token → random, hashed in DB, 7-day TTL
         │
         ▼
4. Access token → returned in response body (stored in memory by client)
   Refresh token → HttpOnly + Secure + SameSite=Strict cookie
         │
         ▼
5. Client includes: Authorization: Bearer <access_token> on every request
         │
         ▼
6. On 401 TOKEN_EXPIRED → client calls POST /api/auth/refresh
         │
         ▼
7. New access token + rotated refresh token issued
         │
         ▼
8. On logout → refresh token invalidated in DB + cookie cleared
```

---

## Real-Time Architecture (WebSocket)

```
Client (Browser)
     │
     │  wss:// connection on app load
     ▼
Socket.io Server
     │
     ├─ Joins rooms on connect:
     │     org:{organization_id}          ← all org members
     │     user:{user_id}                 ← personal notifications
     │     conversation:{conv_id}         ← inbox thread
     │
     ├─ Events emitted by backend:
     │     lead:created
     │     lead:stage_updated
     │     lead:assigned
     │     lead:updated
     │     conversation:new_message
     │     conversation:assigned
     │     conversation:status_changed
     │     notification:new
     │     calendar:event_updated
     │     workflow:execution_log
     │
     └─ Redis pub/sub used to fan out events
        across multiple API server instances
```

---

## Automation Workflow Engine

```
System Event (lead created, stage changed, etc.)
     │
     ▼
Event Bus / Emitter
     │
     ▼
Automation Service
  └─ Query active workflows matching trigger_type + organization_id
  └─ Evaluate trigger_conditions (JSON logic) against lead context
     │
     ▼ (matching workflows)
Bull Queue (BullMQ / Redis)
  └─ Enqueue workflow_execution job with lead context snapshot
     │
     ▼
BullMQ Worker
  └─ Load workflow.actions[] array
  └─ Execute actions sequentially:
       ├─ send_whatsapp  → WABA Graph API
       ├─ send_email     → SMTP / Resend
       ├─ delay          → re-enqueue with offset
       ├─ condition      → evaluate branch (true/false)
       ├─ add_tag        → DB update
       ├─ update_stage   → DB update + WebSocket emit
       ├─ assign_staff   → DB update + notify user
       ├─ webhook_call   → POST to external URL
       └─ ... (18 action types total)
     │
     ▼
workflow_executions table updated with status + logs
```

---

## Webhook Ingestion Flow (Meta / WABA)

```
Meta/WABA → POST /api/webhooks/meta  (or /whatsapp)
     │
     ▼
1. Acknowledge with 200 OK immediately (< 5 seconds, Meta requirement)
     │
     ▼
2. Verify HMAC-SHA256 signature (X-Hub-Signature-256 header)
     │
     ▼
3. Store raw payload in webhook_logs table
     │
     ▼
4. Enqueue async processing job to BullMQ
     │
     ▼
5. Worker processes:
   ├─ Meta lead webhook → fetch lead data via Graph API → create lead
   └─ WABA message webhook → find/create lead + conversation → insert message
     │
     ▼
6. Emit WebSocket events to org members
7. Trigger automation workflows
8. Push notifications to assigned staff

Retry policy: 3 attempts with exponential backoff (1min → 5min → 30min)
Dead-letter queue for permanently failed jobs
```

---

## Database Architecture

### Tenancy Isolation
Every table (except system-wide) has:
```sql
organization_id UUID NOT NULL REFERENCES organizations(id)
```

All queries follow the pattern:
```sql
SELECT * FROM leads
WHERE organization_id = $1  -- from JWT middleware
AND stage_id = $2
ORDER BY created_at DESC;
```

### Indexing Strategy
```sql
-- Every tenant-scoped table
CREATE INDEX ON leads (organization_id);

-- Composite indexes for common query patterns
CREATE INDEX ON leads (organization_id, stage_id);
CREATE INDEX ON leads (organization_id, assigned_to);
CREATE INDEX ON leads (organization_id, created_at DESC);
CREATE INDEX ON messages (conversation_id, sent_at DESC);
```

### Pagination
- **Cursor-based (keyset)** pagination for lead lists — avoids OFFSET performance degradation at scale
- **Page-based** for smaller admin lists (staff, fields, pipelines)

---

## Caching Strategy

| Data | Cache Key | TTL | Invalidation |
|------|-----------|-----|--------------|
| User permissions | `perms:{user_id}` | 5 min | On role/permission update |
| Pipeline + stage list | `pipelines:{org_id}` | 1 min | On pipeline/stage mutation |
| Template list | `templates:{org_id}` | 10 min | On template create/update |
| Round-robin index | `rr:{org_id}` | Persistent | INCR on each assignment |

---

## File Upload Flow

```
Client → POST /api/upload (multipart/form-data)
     │
     ▼
Multer middleware:
  - MIME type validation
  - File size check (max 25MB)
  - Filename sanitization
     │
     ▼
Upload to S3 / Cloudflare R2
  - Key: {org_id}/{lead_id}/{uuid}.{ext}
     │
     ▼
Store S3 key in DB (lead_field_values or messages table)
     │
     ▼
Serve via CDN URL (never expose raw S3 URL to client)
```

---

## API Design Standards

- **Base URL:** `/api/v1/`
- All requests/responses: `Content-Type: application/json`
- Authentication: `Authorization: Bearer <jwt>` on every request
- Organization scoping: automatic from JWT — no `org_id` needed in URL
- Error format: `{ error: { code: string, message: string, details?: object } }`
- Success format: `{ data: T, meta?: { total, page, cursor } }`

### HTTP Status Codes
| Code | Error Key | Meaning |
|------|-----------|---------|
| 400 | `VALIDATION_ERROR` | Input failed schema validation |
| 400 | `DUPLICATE_LEAD` | Lead with same phone/email exists |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 401 | `TOKEN_EXPIRED` | Access token expired |
| 403 | `FORBIDDEN` | User lacks required permission |
| 404 | `NOT_FOUND` | Resource not found or out of org scope |
| 409 | `CONFLICT` | Slot already booked, race condition |
| 422 | `BUSINESS_RULE_VIOLATION` | Business logic violation |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | External dependency down |

---

## Security Architecture

### Network Layer
- HTTPS/TLS 1.2+ enforced everywhere; HTTP → HTTPS redirect
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- CORS: strict origin whitelist, no wildcard in production
- Rate limits:
  - Authenticated users: 100 req/min
  - Public endpoints: 20 req/min
  - Login endpoint: 10 attempts/15 min per IP → 15-min lockout

### Data Layer
- All secrets (API keys, OAuth tokens): AES-256 encrypted before DB storage
- Passwords: bcrypt (cost factor 12), never stored in plaintext
- Soft deletes only — no hard deletion of leads, conversations, or staff records
- PII field access logged for audit trail
- Daily automated DB backups, 30-day retention

### Application Layer
- All inputs validated with Zod/Joi before processing
- All DB queries use ORM (Prisma/Drizzle) or parameterized statements — never string concatenation
- XSS prevention: Content-Security-Policy headers + output encoding
- CSRF protection: SameSite cookies + CSRF tokens on state-changing requests
- Webhook signature verification: HMAC-SHA256 on all incoming Meta/WABA webhooks

---

## Performance Targets

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Lead list (50 items, paginated) | < 80ms | < 150ms | < 300ms |
| Lead detail view | < 60ms | < 120ms | < 250ms |
| Pipeline Kanban load | < 200ms | < 400ms | < 800ms |
| Send WhatsApp message | < 300ms | < 600ms | < 1500ms |
| Inbound webhook processing | < 100ms | < 200ms | < 500ms |
| Search leads (full-text) | < 150ms | < 300ms | < 600ms |
| Bulk import (1000 rows) | < 5s | < 10s | < 30s |
| CSV export (10,000 leads) | < 8s | < 15s | < 30s |

---

## Deployment Architecture

```
GitHub Repository
     │
     ├─ PR opened → GitHub Actions: run tests
     ├─ Merge to main → auto-deploy to Staging
     └─ Manual trigger → deploy to Production

Environments:
┌─────────────┬──────────────────────────────────────────┐
│ Development │ localhost — Docker Compose + seed data   │
├─────────────┼──────────────────────────────────────────┤
│ Staging     │ Mirrors production — QA, load tests,     │
│             │ client demos                             │
├─────────────┼──────────────────────────────────────────┤
│ Production  │ VPS / Hostinger — Nginx, multi-instance, │
│             │ automated backups, monitoring alerts      │
└─────────────┴──────────────────────────────────────────┘
```

---

## Module Interaction Map

```
Lead Generation ──────────────────────────────┐
  (Meta Forms / Custom Forms /                 │
   Landing Pages / WhatsApp)                  │
        │                                     │
        ▼ creates lead                        │
Lead Management ◄──── Inbox (messages link)   │
  (Pipeline / Kanban / Tags /                  │
   Filters / Import / Export)                  │
        │                                     │
        ├──── triggers ────► Automation        │
        │                   (Workflows /       │
        │                    Actions /         │
        │                    Queue)            │
        │                        │            │
        │                        ▼            │
        ├──── schedules ──► Calendar ◄─────────┘
        │                  (Booking / Events)
        │
        └──── managed by ─► Staff
                            (Roles / RBAC /
                             Assignment /
                             Performance)
                                │
                            Fields
                            (Custom Fields /
                             Mapping /
                             Variables)
```
