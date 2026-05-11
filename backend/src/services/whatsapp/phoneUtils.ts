const DEFAULT_COUNTRY = '91';

export function normalizePhone(phone: string, countryCode = DEFAULT_COUNTRY): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith(countryCode)) cleaned = countryCode + cleaned;
  return cleaned;
}

export function toJID(phone: string, countryCode = DEFAULT_COUNTRY): string {
  return `${normalizePhone(phone, countryCode)}@s.whatsapp.net`;
}

export function fromJID(jid: string): string {
  return jid.split('@')[0];
}

export function isGroupJID(jid: string): boolean {
  return jid.endsWith('@g.us');
}
