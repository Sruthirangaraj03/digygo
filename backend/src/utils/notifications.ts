import { query } from '../db';
import { emitToUser } from '../socket';

// Fix 9: batch-fetch prefs for a set of user IDs
async function batchGetPrefs(
  userIds: string[],
): Promise<Map<string, Record<string, { inApp: boolean; email: boolean }>>> {
  if (userIds.length === 0) return new Map();
  const res = await query(
    `SELECT user_id, prefs FROM notification_preferences WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  );
  const map = new Map<string, Record<string, { inApp: boolean; email: boolean }>>();
  for (const row of res.rows) map.set(row.user_id, row.prefs ?? {});
  return map;
}

// Fix 9: return false only when preference explicitly set inApp=false
function prefAllows(
  prefs: Record<string, { inApp: boolean; email: boolean }> | undefined,
  type: string,
): boolean {
  if (!prefs) return true;
  const p = prefs[type];
  if (!p) return true;
  return p.inApp !== false;
}

/**
 * Sends a "new lead" in-app notification to:
 *  1. The tenant owner (always)
 *  2. Staff members with staff:manage permission (excluding the creator)
 *  3. The assigned staff member, if set and not the creator
 * Fix 9: skips recipients who turned off new_lead in-app notifications
 */
export async function sendNewLeadNotification(
  tenantId: string,
  lead: {
    id: string;
    name: string;
    source?: string;
    pipeline_id?: string;
    stage_id?: string;
    assigned_to?: string;
  },
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

  // Fix 9: filter by preference
  const allIds = [...recipientSet];
  const prefsMap = await batchGetPrefs(allIds);
  const filteredIds = allIds.filter((id) => prefAllows(prefsMap.get(id), 'new_lead'));
  if (filteredIds.length === 0) return;

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

  for (const uid of filteredIds) {
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

/**
 * Fix 6: Notify when a lead is (re)assigned to a staff member.
 * Only fires when assigned_to changes and the new assignee is not the person making the change.
 */
export async function sendLeadAssignedNotification(
  tenantId: string,
  lead: { id: string; name: string },
  assignedToUserId: string,
  assignedByUserId: string | null,
): Promise<void> {
  if (!assignedToUserId || assignedToUserId === assignedByUserId) return;

  // Fix 9: check preference
  const prefsMap = await batchGetPrefs([assignedToUserId]);
  if (!prefAllows(prefsMap.get(assignedToUserId), 'assigned')) return;

  const notifTitle = `Lead Assigned: ${lead.name}`;
  const notifMessage = 'A lead has been assigned to you';

  const nRes = await query(
    `INSERT INTO notifications (tenant_id, user_id, title, message, type)
     VALUES ($1::uuid, $2::uuid, $3, $4, 'assigned') RETURNING id, created_at`,
    [tenantId, assignedToUserId, notifTitle, notifMessage],
  );
  if (nRes.rows[0]) {
    emitToUser(assignedToUserId, 'notification:new', {
      id:         nRes.rows[0].id,
      type:       'assigned',
      title:      notifTitle,
      message:    notifMessage,
      is_read:    false,
      created_at: nRes.rows[0].created_at,
    });
  }
}

/**
 * Fix 7: Single summary notification after bulk import instead of one per lead.
 * Sent to the importer + owner + managers.
 */
export async function sendBulkImportNotification(
  tenantId: string,
  importedCount: number,
  importerUserId: string,
): Promise<void> {
  if (importedCount === 0) return;

  const recipientSet = new Set<string>([importerUserId]);

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
       AND u.id != $2::uuid
       AND (up.permissions->>'staff:manage')::boolean = TRUE`,
    [tenantId, importerUserId],
  );
  for (const row of managers.rows) recipientSet.add(row.id);

  const allIds = [...recipientSet];
  const prefsMap = await batchGetPrefs(allIds);
  const filteredIds = allIds.filter((id) => prefAllows(prefsMap.get(id), 'new_lead'));
  if (filteredIds.length === 0) return;

  const notifTitle = `${importedCount} Lead${importedCount > 1 ? 's' : ''} Imported`;
  const notifMessage = `Bulk import completed — ${importedCount} new lead${importedCount > 1 ? 's' : ''} added`;

  for (const uid of filteredIds) {
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
