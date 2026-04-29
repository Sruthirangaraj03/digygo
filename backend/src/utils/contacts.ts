import { query } from '../db';

// Find-or-create a contact record for a captured lead.
// Dedupes on phone first, then email, within the same tenant.
// If a matching contact exists but has no lead_id yet, links it.
// Returns { isNew: true } when a new contact row was inserted.
export async function upsertContact(
  tenantId: string,
  name: string,
  email: string | null | undefined,
  phone: string | null | undefined,
  leadId: string | null | undefined
): Promise<{ isNew: boolean }> {
  try {
    let existingId: string | null = null;
    let existingLeadId: string | null = null;

    if (phone) {
      const r = await query(
        'SELECT id, lead_id FROM contacts WHERE tenant_id=$1 AND phone=$2 LIMIT 1',
        [tenantId, phone]
      );
      if (r.rows[0]) { existingId = r.rows[0].id; existingLeadId = r.rows[0].lead_id; }
    }
    if (!existingId && email) {
      const r = await query(
        'SELECT id, lead_id FROM contacts WHERE tenant_id=$1 AND email=$2 LIMIT 1',
        [tenantId, email]
      );
      if (r.rows[0]) { existingId = r.rows[0].id; existingLeadId = r.rows[0].lead_id; }
    }

    if (existingId) {
      if (leadId && !existingLeadId) {
        await query('UPDATE contacts SET lead_id=$1 WHERE id=$2', [leadId, existingId]);
      }
      return { isNew: false };
    } else {
      await query(
        `INSERT INTO contacts (tenant_id, name, email, phone, lead_id) VALUES ($1,$2,$3,$4,$5)`,
        [tenantId, name, email ?? null, phone ?? null, leadId ?? null]
      );
      return { isNew: true };
    }
  } catch {
    return { isNew: false };
  }
}
