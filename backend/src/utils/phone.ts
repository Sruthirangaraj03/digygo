/**
 * Normalizes a raw phone string to E.164 format where possible.
 * Handles Indian STD codes, country codes with/without +, common formatting chars.
 * Defaults to +91 prefix for bare 10-digit numbers (Indian market default).
 */
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  // Strip common formatting characters (spaces, dashes, dots, parens)
  let p = raw.replace(/[\s\-().]/g, '');
  // IDD prefix 00 → +
  if (p.startsWith('00')) p = '+' + p.slice(2);
  // Indian STD leading 0 → +91
  else if (p.startsWith('0') && !p.startsWith('0+')) p = '+91' + p.slice(1);
  // Bare 10-digit number with no country code → assume +91
  if (!p.startsWith('+')) {
    p = p.replace(/\D/g, '');
    if (p.length === 10) p = '+91' + p;
    else if (p.length === 12 && p.startsWith('91')) p = '+' + p;
    else p = '+' + p;
  }
  return p;
}

/**
 * Strips all non-digit characters for comparison purposes (dedup checks).
 */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Masks a phone number by replacing all but the last 4 digits with *.
 * Used when leads:mask_phone permission is ON for a staff member.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return phone ?? null;
  const stripped = phone.replace(/\D/g, '');
  if (stripped.length <= 4) return '****';
  const visible = phone.slice(-4);
  return '*'.repeat(phone.length - 4) + visible;
}
