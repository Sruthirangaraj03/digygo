# Tech Stack
## CRM SaaS Platform

---

## Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18+ | UI component library |
| Vite | Latest | Build tool and dev server |
| Tailwind CSS | 3+ | Utility-first styling |
| React Router | 6+ | Client-side routing |
| Socket.io Client | Latest | WebSocket real-time connection |
| React Virtual | Latest | Virtualized lists (> 100 items) |
| Axios / Fetch | - | HTTP client for API calls |

### Frontend Principles
- Code splitting per module (lazy loading — no monolithic bundle)
- Optimistic UI updates for stage moves, tag changes
- Single WebSocket connection per session with multiplexed rooms
- All avatars and uploads served via CDN in WebP format
- PWA support (Phase 2): installable, push notifications, home screen icon

---

## Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 LTS | Runtime environment |
| Express or NestJS | Latest | REST API + WebSocket server |
| Socket.io | Latest | Real-time WebSocket handling |
| Zod / Joi | Latest | Input validation and schema enforcement |
| bcrypt | Latest | Password hashing (cost factor 12) |
| jsonwebtoken | Latest | JWT generation and verification (RS256) |
| BullMQ | Latest | Job queue for automation workflows |
| Nodemailer / Resend SDK | Latest | Email sending |
| Multer | Latest | File upload handling |
| DOMPurify equivalent | Latest | HTML sanitization |

---

## Database

| Technology | Purpose |
|-----------|---------|
| PostgreSQL 15+ | Primary relational data store |
| Prisma or Drizzle ORM | Query builder, migrations, type safety |
| PgBouncer | Connection pooling (max 20 connections per API instance) |
| Row-Level Security (RLS) | Secondary tenant isolation at DB level |

### PostgreSQL Optimization Strategy
- `organization_id` index on every table
- Composite indexes: `(org_id, stage_id)`, `(org_id, assigned_to)`, `(org_id, created_at)`
- Cursor-based (keyset) pagination for lead lists
- `EXPLAIN ANALYZE` on every query affecting > 1000 rows
- JSONB for custom fields and flexible config storage

---

## Cache & Queue

| Technology | Purpose |
|-----------|---------|
| Redis | Session storage, permission caching, pub/sub, round-robin assignment |
| BullMQ (Redis-backed) | Automation workflow job queue with delay and retry support |

### Redis Usage
- User permissions cached: 5-minute TTL
- Pipeline/stage lists: 1-minute TTL
- Template lists: 10-minute TTL
- Round-robin assignment counter: key = `rr:{org_id}`
- Explicit cache invalidation on every write

---

## File Storage

| Technology | Purpose |
|-----------|---------|
| AWS S3 or Cloudflare R2 | File attachments, CSV exports, uploaded assets |
| CDN (Cloudflare) | Static assets (JS, CSS, images), uploaded media in WebP |

### Limits
- Max file size: 25MB per file
- Max daily uploads per org: 100MB
- Allowed MIME types validated on upload

---

## Authentication & Security

| Technology | Purpose |
|-----------|---------|
| JWT (RS256) | Stateless authentication with asymmetric key signing |
| bcrypt (cost 12) | Password hashing |
| HttpOnly Cookies | Secure refresh token storage (SameSite=Strict) |
| AES-256 | Encryption of stored secrets (API keys, tokens) |
| Nginx or Cloudflare Proxy | API gateway, rate limiting, SSL termination, DDoS protection |

### Token Configuration
- Access token TTL: 15 minutes (stored in memory, not localStorage)
- Refresh token TTL: 7 days (HttpOnly + Secure + SameSite=Strict cookie)
- Token rotation: new refresh token issued on every use (one-time use)
- Concurrent session limit: 5 per user (configurable per org)

---

## Integrations

| Service | Purpose |
|---------|---------|
| Meta Graph API (v17+) | Facebook/Instagram lead forms OAuth and webhook ingestion |
| WhatsApp Business API (WABA) | WhatsApp messaging, template sending, status webhooks |
| SMTP / Resend / SendGrid / Postmark | Transactional email sending |
| Google Meet / Zoom | Meeting link generation for calendar events |
| reCAPTCHA v3 | Bot prevention on public forms |
| AWS S3 / Cloudflare R2 | File storage |

---

## DevOps & Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker + Docker Compose | Local development environment with seed data |
| GitHub Actions | CI/CD pipeline |
| VPS / Hostinger | Production hosting |
| Nginx | Reverse proxy and SSL termination |

### CI/CD Flow
1. PR opened → automated tests run (unit + integration)
2. Merge to `main` → auto-deploy to staging
3. Manual promotion → production

---

## Testing

| Tool | Type | Target |
|------|------|--------|
| Jest / Vitest | Unit tests | > 80% line coverage |
| Supertest + test DB | Integration tests | > 70% critical paths |
| Playwright or Cypress | E2E tests | All primary user flows |
| k6 or Artillery | Load tests | 500 concurrent users |
| OWASP ZAP | Security tests | OWASP Top 10 |
| axe-core | Accessibility | WCAG 2.1 AA |

---

## Environment Variables

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
| `WEBHOOK_BASE_URL` | Public URL for receiving Meta/WABA webhooks |
