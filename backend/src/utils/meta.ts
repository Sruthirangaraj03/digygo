import { normalizePhone } from './phone';

export interface ParsedLeadFields {
  name: string;
  email: string;
  phone: string;
  customValues: Record<string, string>;
}

/**
 * Converts Meta field_data array + CRM field_mapping into normalized lead fields.
 * Handles first_name/last_name concatenation, phone normalization, email lowercasing.
 * Used by webhook handler, fetchAndInsertAllLeads, and pollMetaLeads — single source of truth.
 */
export function parseMetaFieldData(
  fieldData: Array<{ name: string; values: string[] }>,
  mapping: Array<{ fb_field: string; crm_field: string }>
): ParsedLeadFields {
  const fdMap: Record<string, string> = {};
  for (const f of fieldData) fdMap[f.name] = (f.values?.[0] ?? '').trim();

  let firstName = '';
  let lastName  = '';
  let name  = '';
  let email = '';
  let phone = '';
  const customValues: Record<string, string> = {};

  if (mapping.length > 0) {
    for (const m of mapping) {
      const val = fdMap[m.fb_field] ?? '';
      if (!val) continue;
      switch (m.crm_field) {
        case 'name':       name      = val; break;
        case 'first_name': firstName = val; break;
        case 'last_name':  lastName  = val; break;
        case 'email':      email     = val; break;
        case 'phone':      phone     = val; break;
        default:
          if (m.crm_field.startsWith('custom:'))
            customValues[m.crm_field.slice(7)] = val;
      }
    }
    if (!name) name = [firstName, lastName].filter(Boolean).join(' ');
    // Leak 4 fix: pick up standard fields not covered by the explicit mapping
    if (!email) email = fdMap['email'] ?? fdMap['email_address'] ?? '';
    if (!phone) phone = fdMap['phone_number'] ?? fdMap['phone'] ?? fdMap['mobile'] ?? fdMap['mobile_phone'] ?? '';
    if (!name)  name  = fdMap['full_name'] ?? [fdMap['first_name'] ?? '', fdMap['last_name'] ?? ''].filter(Boolean).join(' ');
  } else {
    for (const f of fieldData) {
      const val = (f.values?.[0] ?? '').trim();
      if (!val) continue;
      switch (f.name) {
        case 'full_name':    name      = val; break;
        case 'first_name':   firstName = val; break;
        case 'last_name':    lastName  = val; break;
        case 'email':
        case 'email_address': email    = val; break;
        case 'phone_number':
        case 'phone':
        case 'mobile':
        case 'mobile_phone': phone    = val; break;
      }
    }
    if (!name) name = [firstName, lastName].filter(Boolean).join(' ');
  }

  email = email.toLowerCase().trim();
  phone = phone ? normalizePhone(phone) : '';
  if (!name) name = email || phone || 'Meta Lead';

  return { name, email, phone, customValues };
}
