-- Custom domain per tenant (unique — one domain maps to one tenant only)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

-- Domain lifecycle status
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_status TEXT DEFAULT 'none';
-- Allowed values: 'none' | 'dns_pending' | 'verifying' | 'ssl_active' | 'failed'

-- Error message stored when domain verification or SSL provisioning fails
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_error TEXT;

-- When SSL was successfully activated
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_verified_at TIMESTAMPTZ;

-- SSL certificate expiry (populated when certbot runs, used for expiry monitoring)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_ssl_expires_at TIMESTAMPTZ;

-- Certbot rate limit guard: track attempts this week
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_cert_attempts INT DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_last_attempt_at TIMESTAMPTZ;

-- Tenant primary brand color (hex code) — used for full app white-labeling
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#c2410c';

-- Per-tenant reply-to email (white-label emails show their contact)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reply_to_email TEXT;

-- ============================================================
-- DOWN MIGRATION (run manually if rollback needed)
-- ============================================================
-- ALTER TABLE tenants DROP COLUMN IF EXISTS custom_domain;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS domain_status;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS domain_error;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS domain_verified_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS domain_ssl_expires_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS domain_cert_attempts;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS domain_last_attempt_at;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS brand_color;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS reply_to_email;
-- ============================================================
