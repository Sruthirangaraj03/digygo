import { query } from '../../db';
import { emitToTenant } from '../../socket';
import { normalizePhone, fromJID, isGroupJID } from './phoneUtils';

export async function handleInboundMessage(tenantId: string, msg: any): Promise<void> {
  // Ignore group messages, status messages, and messages we sent
  if (!msg.message) return;
  if (isGroupJID(msg.key?.remoteJid ?? '')) return;
  if (msg.key?.fromMe) return;

  const senderJID = msg.key?.remoteJid ?? '';
  const rawPhone = fromJID(senderJID);
  const phone = normalizePhone(rawPhone);

  // Extract text content
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    '[Media message]';

  if (!text) return;

  // Find matching lead by phone number
  const leadRes = await query(
    `SELECT id, first_name || ' ' || last_name AS name, phone, assigned_to
     FROM leads
     WHERE tenant_id=$1::uuid AND is_deleted=FALSE
       AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE '%' || RIGHT(REGEXP_REPLACE($2, '[^0-9]', '', 'g'), 10)
     LIMIT 1`,
    [tenantId, phone],
  );

  const lead = leadRes.rows[0] ?? null;
  const leadId = lead?.id ?? null;
  const leadName = lead?.name ?? `+${phone}`;

  // Find or create conversation for this phone/channel
  let convId: string;
  const existingConv = await query(
    `SELECT id FROM conversations
     WHERE tenant_id=$1::uuid AND channel='personal_wa'
       ${leadId ? 'AND lead_id=$2::uuid' : 'AND lead_id IS NULL AND last_message ILIKE $2'}
     ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
    leadId ? [tenantId, leadId] : [tenantId, `%${phone}%`],
  );

  if (existingConv.rows[0]) {
    convId = existingConv.rows[0].id;
  } else {
    const newConv = await query(
      `INSERT INTO conversations (tenant_id, lead_id, channel, status, unread_count, last_message_at)
       VALUES ($1::uuid, $2, 'personal_wa', 'open', 0, NOW())
       RETURNING id`,
      [tenantId, leadId],
    );
    convId = newConv.rows[0].id;
  }

  // Insert message
  const wamid = msg.key?.id ?? null;
  const msgRes = await query(
    `INSERT INTO messages (conversation_id, tenant_id, lead_id, sender, body, is_note, wamid, status, created_at)
     VALUES ($1, $2::uuid, $3, 'lead', $4, FALSE, $5, 'delivered', NOW())
     ON CONFLICT (wamid) DO NOTHING
     RETURNING *`,
    [convId, tenantId, leadId, text, wamid],
  );

  if (!msgRes.rows[0]) return; // Duplicate — already processed

  // Update conversation unread + last message
  await query(
    `UPDATE conversations
     SET last_message=$1, last_message_at=NOW(), unread_count=unread_count+1
     WHERE id=$2`,
    [text.slice(0, 200), convId],
  );

  // Increment daily received count
  await query(
    `INSERT INTO wa_personal_stats (tenant_id, date, messages_received)
     VALUES ($1::uuid, CURRENT_DATE, 1)
     ON CONFLICT (tenant_id, date) DO UPDATE SET messages_received = wa_personal_stats.messages_received + 1`,
    [tenantId],
  ).catch(() => null);

  // Emit real-time events
  const payload = {
    ...msgRes.rows[0],
    lead_name: leadName,
    lead_phone: `+${phone}`,
    channel: 'personal_wa',
  };
  emitToTenant(tenantId, 'message:new', payload);
  emitToTenant(tenantId, 'conversation:updated', {
    id: convId,
    lead_id: leadId,
    lead_name: leadName,
    lead_phone: `+${phone}`,
    channel: 'personal_wa',
    last_message: text.slice(0, 200),
    last_message_at: new Date().toISOString(),
    unread_count: 1,
  });

  // Trigger inbox_message workflow if lead exists
  if (lead) {
    try {
      const { triggerWorkflows } = await import('../../routes/workflows');
      await triggerWorkflows('inbox_message', {
        id: lead.id, name: lead.name, phone: lead.phone,
        assigned_to: lead.assigned_to, tenant_id: tenantId,
        channel: 'personal_wa',
      } as any, tenantId, 'system');
    } catch { /* ignore */ }
  }
}
