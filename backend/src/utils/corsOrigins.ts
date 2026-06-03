// Shared CORS origins store — avoids circular imports between index.ts and route files
const allowedOrigins = new Set<string>();

export function initCorsOrigins(origins: string[]): void {
  origins.forEach(o => allowedOrigins.add(o));
}

export function addAllowedOrigin(domain: string): void {
  allowedOrigins.add(`https://${domain}`);
}

export function removeAllowedOrigin(domain: string): void {
  allowedOrigins.delete(`https://${domain}`);
}

export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.has(origin);
}

export function getAllowedOrigins(): Set<string> {
  return allowedOrigins;
}
