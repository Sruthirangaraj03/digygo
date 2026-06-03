const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface BrandingData {
  tenantId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  replyToEmail: string | null;
  cachedAt: number;
}

const domainToTenantId = new Map<string, { id: string; cachedAt: number }>();
const domainToBranding = new Map<string, BrandingData>();

export function getCachedTenantId(domain: string): string | null {
  const entry = domainToTenantId.get(domain);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    domainToTenantId.delete(domain);
    return null;
  }
  return entry.id;
}

export function getCachedBranding(domain: string): BrandingData | null {
  const entry = domainToBranding.get(domain);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    domainToBranding.delete(domain);
    return null;
  }
  return entry;
}

export function setCachedDomain(domain: string, tenantId: string, branding: BrandingData): void {
  domainToTenantId.set(domain, { id: tenantId, cachedAt: Date.now() });
  domainToBranding.set(domain, { ...branding, cachedAt: Date.now() });
}

export function setCachedTenantId(domain: string, tenantId: string): void {
  domainToTenantId.set(domain, { id: tenantId, cachedAt: Date.now() });
}

export function invalidateDomainCache(domain: string): void {
  domainToTenantId.delete(domain);
  domainToBranding.delete(domain);
}

// NOTE: In-memory cache works correctly for single PM2 process (current setup).
// If PM2 is ever scaled to multiple workers (cluster mode), migrate this cache
// to Redis to prevent out-of-sync state between processes.
