import { query } from '../db';
import { emitToUser } from '../socket';

/**
 * Sends a "new lead" in-app notification to:
 *  1. The tenant owner (always)
 *  2. Staff members with staff:manage permission (excluding the creator)
 *  3. The assigned staff member, if set and not the creator
 */
export async function sendNewLeadNotification(
  tenantId: string,
  lead: { id: string; name: string; source?: string; pipeline_id?: string; stage_id?: string; assigned_to?: string },
  creatorUserId: string | null,
): Promise<void> {
  const recipientSet = new Set<string>();

  const ownerRow = await query(
    `SELECT id FROM users WHERE tenant_id = $1::uuid AND is_owner = TRUE AND is_active = TRUE LIMIT 1`,
    [tenantId],
  );
  if (ownerRow.rows[0]) recipientSet.add(ownerRow.rows[0].id);

  const managers = await query(
    `SELECT u.id FROM users u
     LEFT JOIN user_permissions up ON up.user_id = u.id
     WHERE u.tenant_id = $1::uuid
       AND u.is_active = TRUE
       AND u.is_owner IS NOT TRUE
       AND ($2::uuid IS NULL OR u.id != $2::uuid)
       AND (up.permissions->>'staff:manage')::boolean = TRUE`,
    [tenantId, creatorUserId ?? null],
  );
  for (const row of managers.rows) recipientSet.add(row.id);

  if (lead.assigned_to && lead.assigned_to !== creatorUserId) {
    recipientSet.add(lead.assigned_to);
  }

  if (recipientSet.size === 0) return;

  const pipelineInfo = await query(
    `SELECT p.name AS pipeline_name, ps.name AS stage_name
     FROM pipelines p
     LEFT JOIN pipeline_stages ps ON ps.id = $1::uuid AND ps.pipeline_id = p.id
     WHERE p.id = $2::uuid`,
    [lead.stage_id ?? null, lead.pipeline_id ?? null],
  );
  const { pipeline_name = '', stage_name = '' } = pipelineInfo.rows[0] ?? {};
  const notifTitle = `New Lead: ${lead.name}`;
  const notifMessage = pipeline_name
    ? `Added to ${pipeline_name}${stage_name ? ` · ${stage_name}` : ''}`
    : `Source: ${lead.source || 'Manual'}`;

  for (const uid of recipientSet) {
    const nRes = await query(
      `INSERT INTO notifications (tenant_id, user_id, title, message, type)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'new_lead') RETURNING id, created_at`,
      [tenantId, uid, notifTitle, notifMessage],
    );
    if (nRes.rows[0]) {
      emitToUser(uid, 'notification:new', {
        id:         nRes.rows[0].id,
        type:       'new_lead',
        title:      notifTitle,
        message:    notifMessage,
        is_read:    false,
        created_at: nRes.rows[0].created_at,
      });
    }
  }
}
