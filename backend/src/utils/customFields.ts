import { query } from '../db';

/** Strip {%...%} template-variable wrappers from a key → plain slug */
export function cleanFieldKey(key: string): string {
  return key.replace(/^\{%\s*/, '').replace(/\s*%\}$/, '').trim();
}

/**
 * Given a slug→value map, ensure each slug has:
 *   1. A row in custom_fields (auto-created if missing)
 *   2. A row in lead_field_values for this lead (upserted)
 * Keys are cleaned with cleanFieldKey before processing.
 */
export async function backfillCustomFields(
  leadId: string,
  tenantId: string,
  data: Record<string, string>,
): Promise<void> {
  for (const [rawKey, value] of Object.entries(data)) {
    const slug = cleanFieldKey(rawKey);
    if (!slug || !value) continue;
    try {
      let cfRes = await query(
        'SELECT id FROM custom_fields WHERE tenant_id=$1 AND slug=$2 LIMIT 1',
        [tenantId, slug],
      );
      if (!cfRes.rows[0]) {
        const fieldName = slug
          .split(/[_\-]+/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        try {
          cfRes = await query(
            `INSERT INTO custom_fields (tenant_id, name, type, slug, required)
             VALUES ($1,$2,'Single Line',$3,false) RETURNING id`,
            [tenantId, fieldName, slug],
          );
        } catch {
          cfRes = await query(
            'SELECT id FROM custom_fields WHERE tenant_id=$1 AND slug=$2 LIMIT 1',
            [tenantId, slug],
          );
        }
      }
      if (cfRes.rows[0]?.id) {
        await query(
          `INSERT INTO lead_field_values (lead_id, tenant_id, field_id, value)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (lead_id, field_id) DO UPDATE SET value=$4, updated_at=NOW()`,
          [leadId, tenantId, cfRes.rows[0].id, value],
        );
      }
    } catch (err) {
      console.error('[backfillCustomFields]', slug, err);
    }
  }
}
