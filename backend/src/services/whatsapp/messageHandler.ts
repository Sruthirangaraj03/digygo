import { query } from '../../db';
import { emitToTenant } from '../../socket';
import { normalizePhone, fromJID, isGroupJID } from './phoneUtils';

/**
 * Extracts a human-readable text label from any Baileys message type.
 * Unwraps ephemeral (disappearing), viewOnce, and other container types first,
 * then extracts the actual content from the inner message.
 */
function extractText(msg: any): string {
  const m = msg.message;
  if (!m) return '';

  // Unwrap container types: disappearing messages, view-once, captioned documents, etc.
  const inner: any =
    m.ephemeralMessage?.message ??
    m.viewOnceMessage?.message ??
    m.viewOnceMessageV2?.message ??
    m.viewOnceMessageV2Extension?.message ??
    m.documentWithCaptionMessage?.message ??
    m.editedMessage?.message ??
    m;

  // Plain text (most common)
  if (inner.conversation) return inner.conversation;
  if (inner.extendedTextMessage?.text) return inner.extendedTextMessage.text;

  // Media with optional caption
  if (inner.imageMessage)    return inner.imageMessage.caption?.trim()    || '[Image]';
  if (inner.videoMessage)    return inner.videoMessage.caption?.trim()    || '[Video]';
  if (inner.audioMessage)    return inner.audioMessage.ptt                ? '[Voice note]' : '[Audio]';
  if (inner.documentMessage) return inner.documentMessage.fileName
    ? `[Document: ${inner.documentMessage.fileName}]` : '[Document]';

  // Other rich types
  if (inner.stickerMessage)             return '[Sticker]';
  if (inner.locationMessage)            return '[Location]';
  if (inner.liveLocationMessage)        return '[Live Location]';
  if (inner.contactMessage)             return `[Contact: ${inner.contactMessage.displayName ?? 'Unknown'}]`;
  if (inner.contactsArrayMessage)       return '[Contacts]';
  if (inner.reactionMessage)            return `[Reaction: ${inner.reactionMessage.text ?? ''}]`;
  if (inner.pollCreationMessage)        return `[Poll: ${inner.pollCreationMessage.name ?? ''}]`;
  if (inner.pollUpdateMessage)          return '[Poll vote]';
  if (inner.buttonsResponseMessage)     return inner.buttonsResponseMessage.selectedDisplayText   || '[Button reply]';
  if (inner.listResponseMessage)        return inner.listResponseMessage.title                    || '[List reply]';
  if (inner.templateButtonReplyMessage) return inner.templateButtonReplyMessage.selectedDisplayText || '[Reply]';
  if (inner.groupInviteMessage)         return `[Group invite: ${inner.groupInviteMessage.groupName ?? ''}]`;
  if (inner.orderMessage)               return '[Order]';
  if (inner.productMessage)             return '[Product]';
  if (inner.paymentMessage)             return '[Payment]';

  return '[Media message]';
}

export async function handleInboundMessage(tenantId: string, msg: any): Promise<void> {
  // Ignore group messages, status messages, and messages we sent
  if (!msg.message) return;
  if (isGroupJID(msg.key?.remoteJid ?? '')) return;
  if (msg.key?.fromMe) return;

  const senderJID = msg.key?.remoteJid ?? '';
  const rawPhone = fromJID(senderJID);
  const phone = normalizePhone(rawPhone);

  const text = extractText(msg);
  if (!text) return;

  // Find matching lead by phone number (last 10 digits match)
  const leadRes = await query(
    `SELECT id, name, phone, assigned_to
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
  if (leadId) {
    const existingConv = await query(
      `SELECT id FROM conversations
       WHERE tenant_id=$1::uuid AND channel='personal_wa' AND lead_id=$2::uuid
       ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
      [tenantId, leadId],
    );
    if (existingConv.rows[0]) {
      convId = existingConv.rows[0].id;
    } else {
      const newConv = await query(
        `INSERT INTO conversations (tenant_id, lead_id, channel, status, unread_count, last_message_at)
         VALUES ($1::uuid, $2::uuid, 'personal_wa', 'open', 0, NOW()) RETURNING id`,
        [tenantId, leadId],
      );
      convId = newConv.rows[0].id;
    }
  } else {
    // Unknown number — find existing conversation by phone to avoid duplicate threads
    const existingAnon = await query(
      `SELECT id FROM conversations
       WHERE tenant_id=$1::uuid AND channel='personal_wa' AND lead_id IS NULL AND phone=$2
       ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
      [tenantId, phone],
    );
    if (existingAnon.rows[0]) {
      convId = existingAnon.rows[0].id;
    } else {
      const newConv = await query(
        `INSERT INTO conversations (tenant_id, lead_id, channel, status, unread_count, last_message_at, phone)
         VALUES ($1::uuid, NULL, 'personal_wa', 'open', 0, NOW(), $2) RETURNING id`,
        [tenantId, phone],
      );
      convId = newConv.rows[0].id;
    }
  }

  // Insert message
  const wamid = msg.key?.id ?? null;
  const msgRes = await query(
    `INSERT INTO messages (conversation_id, tenant_id, lead_id, sender, body, is_note, wamid, status, created_at)
     VALUES ($1, $2::uuid, $3, 'customer', $4, FALSE, $5, 'delivered', NOW())
     ON CONFLICT (wamid) WHERE wamid IS NOT NULL DO NOTHING
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
    status: 'open',
    last_message: text.slice(0, 200),
    last_message_at: new Date().toISOString(),
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
