-- Enforce unique phone per tenant for active (non-deleted) leads
-- Uses a partial index so soft-deleted leads don't block re-import
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_phone_per_tenant
  ON leads(tenant_id, phone)
  WHERE phone IS NOT NULL AND phone <> '' AND is_deleted = FALSE;

-- Also enforce unique email per tenant for active leads
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_email_per_tenant
  ON leads(tenant_id, LOWER(email))
  WHERE email IS NOT NULL AND email <> '' AND is_deleted = FALSE;

-- Enforce unique slug per tenant for custom fields (already exists, this is a no-op if present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_fields_tenant_slug
  ON custom_fields(tenant_id, slug);
