import path from 'path';
import fs from 'fs';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import { query } from '../../db';
import { emitToTenant } from '../../socket';
import { handleInboundMessage } from './messageHandler';

const WA_SESSIONS_DIR = process.env.WA_SESSIONS_DIR
  || path.join(process.cwd(), 'wa_sessions');

const WA_MEDIA_DIR = process.env.WA_MEDIA_DIR
  || path.join(process.cwd(), 'wa_media');

// Background queue for historical media downloads — drains at 1 item/sec to avoid overload
interface MediaQueueItem { tenantId: string; msg: any; msgId: string; }
const mediaDownloadQueue: MediaQueueItem[] = [];
let mediaQueueRunning = false;
function drainMediaQueue() {
  if (mediaQueueRunning) return;
  mediaQueueRunning = true;
  const tick = () => {
    const item = mediaDownloadQueue.shift();
    if (!item) { mediaQueueRunning = false; return; }
    downloadAndStoreMedia(item.tenantId, item.msg, item.msgId)
      .catch(() => null)
      .finally(() => setTimeout(tick, 1000));
  };
  tick();
}

// In-memory state — source of truth (more reliable than DB after restarts)
const sessions          = new Map<string, ReturnType<typeof makeWASocket>>();
const connectedSessions = new Set<string>();
const pendingQRs        = new Map<string, string>();
const retryCount        = new Map<string, number>();
const intentionallyStopped = new Set<string>();

// WA contacts cache (phone book contacts from the connected device)
const waContactsCache = new Map<string, { id: string; name: string; phone: string }[]>();

// LID → real phone mapping (multi-device WhatsApp sends @lid JIDs instead of phone JIDs)
const lidToPhone = new Map<string, string>(); // key: "86256281202697" → value: "918072256598"

/**
 * Persist a LID→phone mapping to DB and memory, then merge any LID-based
 * anonymous conversation into the real phone conversation.
 */
async function storeLidMapping(tenantId: string, lidDigits: string, phoneDigits: string): Promise<void> {
  lidToPhone.set(lidDigits, phoneDigits);
  await query(
    `INSERT INTO wa_lid_phone_map (tenant_id, lid_digits, phone_digits, updated_at)
     VALUES ($1::uuid, $2, $3, NOW())
     ON CONFLICT (tenant_id, lid_digits) DO UPDATE SET phone_digits=$3, updated_at=NOW()`,
    [tenantId, lidDigits, phoneDigits],
  ).catch(() => null);

  // Find any LID-based anonymous conversation (phone = lidDigits) and merge it
  // into the real phone conversation so messages appear under the correct contact.
  try {
    const lidConv = await query(
      `SELECT id FROM conversations
       WHERE tenant_id=$1::uuid AND channel='personal_wa' AND lead_id IS NULL
         AND REGEXP_REPLACE(phone,'[^0-9]','','g') = $2
       LIMIT 1`,
      [tenantId, lidDigits],
    );
    if (!lidConv.rows[0]) return; // no LID conversation to merge

    const lidConvId = lidConv.rows[0].id;

    // Find the real phone conversation
    const realConv = await query(
      `SELECT id FROM conversations
       WHERE tenant_id=$1::uuid AND channel='personal_wa'
         AND REGEXP_REPLACE(COALESCE(phone, (SELECT phone FROM leads WHERE id=lead_id)), '[^0-9]','','g')
             LIKE '%' || RIGHT($2, 10)
         AND id != $3
       ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
      [tenantId, phoneDigits, lidConvId],
    );

    if (realConv.rows[0]) {
      const realConvId = realConv.rows[0].id;
      // Move all messages from LID conversation to the real conversation
      await query(`UPDATE messages SET conversation_id=$1 WHERE conversation_id=$2`, [realConvId, lidConvId]);
      // Refresh real conversation preview
      await query(
        `UPDATE conversations c
         SET last_message = m.body, last_message_at = m.created_at,
             unread_count = (SELECT COUNT(*) FROM messages WHERE conversation_id=$1 AND sender='customer')
         FROM (SELECT body, created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1) m
         WHERE c.id = $1`,
        [realConvId],
      );
      // Delete the LID conversation
      await query(`DELETE FROM conversations WHERE id=$1`, [lidConvId]);
      console.log(`[WA] Merged LID conv ${lidConvId} → real conv ${realConvId} (${phoneDigits})`);
      emitToTenant(tenantId, 'conversation:deleted', { id: lidConvId });
      emitToTenant(tenantId, 'conversation:updated', { id: realConvId });
    } else {
      // No real conv found yet — update the LID conversation's phone to the real number
      await query(
        `UPDATE conversations SET phone=$1 WHERE id=$2`,
        [phoneDigits, lidConvId],
      );
      console.log(`[WA] Updated LID conv phone: ${lidDigits} → ${phoneDigits}`);
    }
  } catch (e) {
    console.error('[WA] LID merge error:', e);
  }
}

/**
 * Query WA servers for LIDs of a batch of phone numbers.
 * Uses executeUSyncQuery with both contact + LID protocols (duck-typed, no internal imports).
 * Returns Map<phoneDigits, lidDigits>.
 */
async function lookupLidForPhonesBatch(sock: any, phones: string[]): Promise<Map<string, string>> {
  const phoneToLid = new Map<string, string>();
  if (!phones.length) return phoneToLid;
  try {
    const findChild = (node: any, tag: string): any =>
      (Array.isArray(node?.content) ? node.content : []).find((n: any) => n.tag === tag);

    const usyncQuery = {
      protocols: [
        {
          name: 'contact',
          getQueryElement: () => ({ tag: 'contact', attrs: {} }),
          // Phone number must be in content so WA servers can identify the user
          getUserElement: (u: any) => ({ tag: 'contact', attrs: {}, content: u.phone }),
        },
        {
          name: 'lid',
          getQueryElement: () => ({ tag: 'lid', attrs: {} }),
          getUserElement: (_u: any) => null,
        },
      ],
      users: phones.map(phone => ({ phone: `+${phone}` })),
      context: 'interactive',
      mode:    'query',
      parseUSyncQueryResult(rawResult: any) {
        if (rawResult?.attrs?.type !== 'result') return null;
        try {
          const usync = findChild(rawResult, 'usync');
          const list  = findChild(usync, 'list');
          const items: any[] = [];
          for (const uNode of (list?.content ?? [])) {
            if (!Array.isArray(uNode?.content)) continue;
            const phoneJid = uNode.attrs?.jid as string | undefined;
            const lidNode  = uNode.content.find((c: any) => c.tag === 'lid');
            const lidJid   = lidNode?.attrs?.val as string | undefined;
            if (phoneJid) items.push({ id: phoneJid, lid: lidJid ?? null });
          }
          return { list: items, sideList: [] };
        } catch { return null; }
      },
    };

    const queryResult = await sock.executeUSyncQuery(usyncQuery);
    for (const item of (queryResult?.list ?? [])) {
      if (item?.id && item?.lid) {
        const phone    = (item.id  as string).split('@')[0];
        const lidDigit = (item.lid as string).split('@')[0];
        if (phone && lidDigit) phoneToLid.set(phone, lidDigit);
      }
    }
  } catch (e: any) {
    console.error('[WA] LID batch lookup error:', e?.message ?? e);
  }
  return phoneToLid;
}

/**
 * Query WA servers for the LID of every known conversation phone in this tenant.
 * Runs once 5s after session connects.
 */
async function resolveLidsForTenant(tenantId: string, sock: ReturnType<typeof makeWASocket>): Promise<void> {
  const rows = await query(
    `SELECT DISTINCT REGEXP_REPLACE(COALESCE(l.phone, c.phone), '[^0-9]', '', 'g') AS phone
     FROM conversations c
     LEFT JOIN leads l ON l.id = c.lead_id
     WHERE c.tenant_id=$1::uuid AND c.channel='personal_wa'
       AND COALESCE(l.phone, c.phone) IS NOT NULL
       AND LENGTH(REGEXP_REPLACE(COALESCE(l.phone, c.phone), '[^0-9]', '', 'g')) BETWEEN 10 AND 15
     LIMIT 50`,
    [tenantId],
  );

  const alreadyMappedPhones = new Set(lidToPhone.values());
  const phones = rows.rows
    .map(r => r.phone as string)
    .filter(p => p && !alreadyMappedPhones.has(p));

  if (!phones.length) return;
  console.log(`[WA] Resolving LIDs for ${phones.length} phone(s) via USync...`);

  const phoneToLid = await lookupLidForPhonesBatch(sock as any, phones);
  for (const [phone, lidDigits] of phoneToLid) {
    console.log(`[WA] USync resolved: ${phone} → lid=${lidDigits}`);
    await storeLidMapping(tenantId, lidDigits, phone);
  }
  if (!phoneToLid.size) {
    console.log(`[WA] USync: no LID mappings found for ${phones.length} phone(s)`);
  }
}

const MAX_RETRIES = 5;

function sessionDir(tenantId: string): string {
  return path.join(WA_SESSIONS_DIR, tenantId);
}

async function upsertSessionStatus(tenantId: string, status: string, phoneNumber?: string | null) {
  await query(
    `INSERT INTO wa_personal_sessions (tenant_id, status, phone_number, connected_at, updated_at)
     VALUES ($1::uuid, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id) DO UPDATE
       SET status=$2, phone_number=COALESCE($3, wa_personal_sessions.phone_number),
           connected_at=CASE WHEN $2='connected' THEN NOW() ELSE wa_personal_sessions.connected_at END,
           updated_at=NOW()`,
    [tenantId, status, phoneNumber ?? null, status === 'connected' ? new Date() : null],
  );
  emitToTenant(tenantId, 'wa:status', { status, phone: phoneNumber ?? null });
}

/**
 * Downloads a Baileys media message and stores it to disk.
 * Updates messages.media_url and emits message:updated.
 */
async function downloadAndStoreMedia(tenantId: string, msg: any, msgId: string): Promise<void> {
  const m = msg.message;
  if (!m) return;

  const inner: any =
    m.ephemeralMessage?.message ??
    m.viewOnceMessage?.message ??
    m.viewOnceMessageV2?.message ??
    m.viewOnceMessageV2Extension?.message ??
    m.documentWithCaptionMessage?.message ??
    m.editedMessage?.message ??
    m;

  let mediaKey: string | null = null;
  let ext = 'bin';
  if      (inner.imageMessage)    { mediaKey = 'imageMessage';    ext = 'jpg'; }
  else if (inner.videoMessage)    { mediaKey = 'videoMessage';    ext = 'mp4'; }
  else if (inner.audioMessage)    {
    mediaKey = 'audioMessage';
    ext = inner.audioMessage.ptt ? 'ogg' : 'mp3';
  }
  else if (inner.documentMessage) {
    mediaKey = 'documentMessage';
    const fn = inner.documentMessage.fileName ?? '';
    ext = fn.includes('.') ? fn.split('.').pop()! : 'bin';
  }
  else if (inner.stickerMessage)  { mediaKey = 'stickerMessage';  ext = 'webp'; }

  if (!mediaKey) return;

  try {
    // downloadMediaMessage can work without an active socket using the encrypted keys in the message
    const buffer = await downloadMediaMessage(
      { message: { [mediaKey]: inner[mediaKey] }, key: msg.key } as any,
      'buffer',
      {},
    ) as Buffer;

    const mediaDir = path.join(WA_MEDIA_DIR, tenantId);
    fs.mkdirSync(mediaDir, { recursive: true });

    const filename = `${msgId}.${ext}`;
    const filePath = path.join(mediaDir, filename);
    fs.writeFileSync(filePath, buffer);

    const relPath = `wa_media/${tenantId}/${filename}`;
    await query(`UPDATE messages SET media_url=$1 WHERE id=$2`, [relPath, msgId]);

    emitToTenant(tenantId, 'message:updated', {
      id:        msgId,
      media_url: `/api/conversations/media/${msgId}`,
    });
  } catch (e) {
    console.error(`[WA Media] Download failed for msg ${msgId}:`, (e as Error)?.message ?? e);
  }
}

export async function startSession(tenantId: string): Promise<void> {
  await stopSession(tenantId, false);
  pendingQRs.delete(tenantId);

  const authDir = sessionDir(tenantId);
  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  await upsertSessionStatus(tenantId, 'connecting');

  console.log(`[WA] Starting session for tenant ${tenantId.slice(0, 8)}… auth dir has ${fs.readdirSync(authDir).length} files`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['DigyGo CRM', 'Chrome', '1.0'],
    connectTimeoutMs: 30_000,
    logger: {
      level: 'warn',
      trace: () => {}, debug: () => {}, info: () => {},
      warn:  (msg: any) => console.warn('[Baileys]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
      error: (msg: any) => console.error('[Baileys]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
      fatal: (msg: any) => console.error('[Baileys FATAL]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
      child: () => ({ level: 'warn', trace: () => {}, debug: () => {}, info: () => {},
        warn: (m: any) => console.warn('[Baileys]', m), error: (m: any) => console.error('[Baileys]', m),
        fatal: (m: any) => console.error('[Baileys]', m), child: () => ({}) as any }),
    } as any,
  });

  sessions.set(tenantId, sock);

  // ── Connection lifecycle ──────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[WA] QR generated for tenant ${tenantId.slice(0, 8)}`);
      try {
        const qrBase64 = await qrcode.toDataURL(qr);
        pendingQRs.set(tenantId, qrBase64);
        emitToTenant(tenantId, 'wa:qr', { qr: qrBase64 });
      } catch { /* ignore */ }
    }

    if (connection === 'open') {
      retryCount.delete(tenantId);
      connectedSessions.add(tenantId);
      pendingQRs.delete(tenantId);
      const jid   = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
      const phone = jid ? jid.split('@')[0] : null;
      console.log(`[WA] Connected for tenant ${tenantId.slice(0, 8)}: ${phone ?? 'unknown'}`);
      await upsertSessionStatus(tenantId, 'connected', phone ? `+${phone}` : null);

      // Record session start in history
      if (phone) {
        await query(
          `INSERT INTO wa_session_history (tenant_id, phone, connected_at)
           VALUES ($1::uuid, $2, NOW())`,
          [tenantId, phone],
        ).catch(() => null);
      }

      // Pre-load persisted LID → phone mappings for this tenant so @lid messages
      // arriving immediately after connect can be resolved without waiting for contacts.upsert
      try {
        const lidRows = await query(
          `SELECT lid_digits, phone_digits FROM wa_lid_phone_map WHERE tenant_id=$1::uuid`,
          [tenantId],
        );
        for (const row of lidRows.rows) {
          lidToPhone.set(row.lid_digits, row.phone_digits);
        }
        if (lidRows.rows.length > 0) {
          console.log(`[WA] Pre-loaded ${lidRows.rows.length} LID mappings from DB for tenant ${tenantId.slice(0, 8)}`);
        }
      } catch { /* non-critical */ }

      // 5s after connect: query WA servers for LID of every known conversation phone.
      // This resolves multi-device contacts (@lid JIDs) to their real phone numbers,
      // stores the mapping in DB, and merges any duplicate LID-based conversations.
      setTimeout(() => resolveLidsForTenant(tenantId, sock).catch(() => null), 5_000);

      // Wait 60s for history sync to finish, then backfill phones on anonymous conversations
      // whose messages now have remote_jid filled in by the ON CONFLICT UPDATE
      setTimeout(async () => {
        try {
          const upd = await query(
            `UPDATE conversations c
             SET phone = SPLIT_PART(m.remote_jid, '@', 1)
             FROM (
               SELECT DISTINCT ON (conversation_id) conversation_id, remote_jid
               FROM messages
               WHERE remote_jid IS NOT NULL AND remote_jid LIKE '%@s.whatsapp.net'
               ORDER BY conversation_id, created_at ASC
             ) m
             WHERE c.id = m.conversation_id
               AND c.tenant_id = $1::uuid
               AND c.lead_id IS NULL
               AND c.channel = 'personal_wa'
               AND (c.phone IS NULL OR c.phone = '')`,
            [tenantId],
          );
          const count = upd.rowCount ?? 0;
          if (count > 0) {
            console.log(`[WA] Post-connect backfill: fixed ${count} anonymous conversation(s) with phone`);
            // Re-emit those conversations so frontend refreshes names
            const fixed = await query(
              `SELECT c.id, '+' || c.phone AS lead_phone, c.last_message, c.last_message_at,
                      c.status, c.unread_count, c.assigned_to
               FROM conversations c
               WHERE c.tenant_id = $1::uuid AND c.channel='personal_wa'
                 AND c.lead_id IS NULL AND c.phone IS NOT NULL AND c.phone != ''`,
              [tenantId],
            );
            for (const conv of fixed.rows) {
              emitToTenant(tenantId, 'conversation:updated', {
                ...conv,
                lead_name: conv.lead_phone,
              });
            }
          }
        } catch (e) {
          console.error('[WA] Post-connect backfill error:', e);
        }
      }, 60_000);
    }

    if (connection === 'close') {
      connectedSessions.delete(tenantId);
      const code      = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut || code === 401;
      console.log(`[WA] Connection closed for tenant ${tenantId.slice(0, 8)}: code=${code ?? 'none'}, loggedOut=${loggedOut}`);

      // Record session end in history
      const sessionPhoneOnDisconnect = sock.user?.id ? jidNormalizedUser(sock.user.id).split('@')[0] : null;
      if (sessionPhoneOnDisconnect) {
        const reason = loggedOut ? 'logged_out' : (intentionallyStopped.has(tenantId) ? 'stopped' : 'error');
        await query(
          `UPDATE wa_session_history SET disconnected_at=NOW(), disconnect_reason=$1
           WHERE tenant_id=$2::uuid AND phone=$3 AND disconnected_at IS NULL`,
          [reason, tenantId, sessionPhoneOnDisconnect],
        ).catch(() => null);
      }

      if (intentionallyStopped.has(tenantId)) return;

      if (loggedOut) {
        retryCount.delete(tenantId);
        sessions.delete(tenantId);
        try { fs.rmSync(sessionDir(tenantId), { recursive: true, force: true }); } catch {}
        await upsertSessionStatus(tenantId, 'disconnected');
      } else {
        const current = (retryCount.get(tenantId) ?? 0) + 1;
        if (current >= MAX_RETRIES) {
          retryCount.delete(tenantId);
          sessions.delete(tenantId);
          try { fs.rmSync(sessionDir(tenantId), { recursive: true, force: true }); } catch {}
          await upsertSessionStatus(tenantId, 'disconnected');
        } else {
          retryCount.set(tenantId, current);
          await upsertSessionStatus(tenantId, 'connecting');
          setTimeout(() => startSession(tenantId).catch(() => null), 3000);
        }
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Incoming / history messages ───────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const historical = type === 'append'; // history sync from WA servers
    if (type !== 'notify' && type !== 'append') return;
    const sessionPhone = sock.user?.id ? jidNormalizedUser(sock.user.id).split('@')[0] : null;

    console.log(`[WA] messages.upsert type=${type} count=${messages.length} session=${sessionPhone}`);
    for (let msg of messages) {
      // Resolve @lid JIDs to real phone JIDs using our contacts map
      const remoteJid = msg.key?.remoteJid ?? '';
      if (remoteJid.endsWith('@lid')) {
        const lidDigits = remoteJid.split('@')[0];
        let realPhone = lidToPhone.get(lidDigits);

        // In-memory miss — fall back to persisted DB mapping
        if (!realPhone) {
          try {
            const dbRow = await query(
              `SELECT phone_digits FROM wa_lid_phone_map WHERE tenant_id=$1::uuid AND lid_digits=$2`,
              [tenantId, lidDigits],
            );
            if (dbRow.rows[0]?.phone_digits) {
              realPhone = dbRow.rows[0].phone_digits;
              lidToPhone.set(lidDigits, realPhone!);
              console.log(`[WA] LID resolved from DB: ${remoteJid} → ${realPhone}@s.whatsapp.net`);
            }
          } catch { /* non-critical */ }
        }

        if (realPhone) {
          msg = { ...msg, key: { ...msg.key, remoteJid: `${realPhone}@s.whatsapp.net` } };
          console.log(`[WA] LID resolved: ${remoteJid} → ${realPhone}@s.whatsapp.net`);
        } else {
          console.log(`[WA] LID not resolved: ${remoteJid} (no mapping in memory or DB yet)`);
        }
      }
      console.log(`[WA] msg remoteJid=${msg.key?.remoteJid} fromMe=${msg.key?.fromMe} hasMsg=${!!msg.message} keys=${msg.message ? Object.keys(msg.message).join(',') : 'none'}`);
      const result = await handleInboundMessage(tenantId, msg, { historical, waPhone: sessionPhone }).catch((e) => {
        console.error('[WA] handleInboundMessage error:', e?.message ?? e);
        return null;
      });
      if (result?.hasMedia) {
        if (historical) {
          // Queue historical media — drain at 1/sec to avoid burst overload
          mediaDownloadQueue.push({ tenantId, msg, msgId: result.msgId });
          drainMediaQueue();
        } else {
          // Real-time media — download immediately in background
          downloadAndStoreMedia(tenantId, msg, result.msgId).catch(() => null);
        }
      }
    }
  });

  // ── Delivery / read receipts for messages WE sent ─────────────────────────
  sock.ev.on('message-receipt.update', async (receipts) => {
    for (const receipt of receipts) {
      const wamid = receipt.key?.id;
      if (!wamid) continue;

      let newStatus: string | null = null;
      if (receipt.receipt?.readTimestamp)     newStatus = 'read';
      else if (receipt.receipt?.receiptTimestamp) newStatus = 'delivered';
      if (!newStatus) continue;

      const upd = await query(
        `UPDATE messages SET status=$1 WHERE wamid=$2 AND tenant_id=$3::uuid RETURNING id`,
        [newStatus, wamid, tenantId],
      ).catch(() => null);

      if (upd?.rows[0]) {
        emitToTenant(tenantId, 'message:updated', {
          id:     upd.rows[0].id,
          wamid,
          status: newStatus,
        });
      }
    }
  });

  // ── Message revocation ("Delete for everyone") ───────────────────────────
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      const wamid = update.key?.id;
      if (!wamid) continue;

      // protocolMessage.type 5 = MESSAGE_REVOKE
      const proto = (update.update as any)?.message?.protocolMessage;
      if (proto?.type !== 5) continue;

      const upd = await query(
        `UPDATE messages SET is_deleted=TRUE, body='[Message deleted]'
         WHERE wamid=$1 AND tenant_id=$2::uuid RETURNING id`,
        [wamid, tenantId],
      ).catch(() => null);

      if (upd?.rows[0]) {
        emitToTenant(tenantId, 'message:updated', {
          id:         upd.rows[0].id,
          wamid,
          is_deleted: true,
          body:       '[Message deleted]',
        });
      }
    }
  });

  // ── Contact name sync ─────────────────────────────────────────────────────
  // When WA pushes the phone-book contact list, update any lead whose name
  // looks like a raw phone number (i.e. was never resolved to a real name).
  sock.ev.on('contacts.upsert', async (contacts) => {
    const cached: { id: string; name: string; phone: string }[] = waContactsCache.get(tenantId) ?? [];
    for (const contact of contacts) {
      const digits = contact.id?.split('@')[0];
      if (!digits) continue;

      // Build LID → phone mapping for multi-device contacts
      const lidDigits = (contact as any).lid?.split('@')[0];
      if (lidDigits && digits && !lidToPhone.has(lidDigits)) {
        await storeLidMapping(tenantId, lidDigits, digits);
      }

      if (contact.name) {
        // Update or add to in-memory cache
        const idx = cached.findIndex((c) => c.id === contact.id);
        const entry = { id: contact.id, name: contact.name, phone: digits };
        if (idx >= 0) cached[idx] = entry; else cached.push(entry);

        await query(
          `UPDATE leads
           SET name=$1, updated_at=NOW()
           WHERE tenant_id=$2::uuid
             AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE '%' || RIGHT($3, 10)
             AND (
               name = phone
               OR name ~ '^[+0-9][0-9 ()\\-]{6,}$'
             )`,
          [contact.name, tenantId, digits],
        ).catch(() => null);
      }
    }
    waContactsCache.set(tenantId, cached);
  });
}

export async function stopSession(tenantId: string, updateDb = true): Promise<void> {
  intentionallyStopped.add(tenantId);
  setTimeout(() => intentionallyStopped.delete(tenantId), 3000);

  const sock = sessions.get(tenantId);
  if (sock) {
    try { sock.end(undefined as any); } catch {}
    sessions.delete(tenantId);
  }
  connectedSessions.delete(tenantId);
  if (updateDb) {
    await upsertSessionStatus(tenantId, 'disconnected').catch(() => null);
  }
}

export async function destroySession(tenantId: string): Promise<void> {
  retryCount.delete(tenantId);
  await stopSession(tenantId, true);
  try { fs.rmSync(sessionDir(tenantId), { recursive: true, force: true }); } catch {}
  pendingQRs.delete(tenantId);
}

export function getSession(tenantId: string): ReturnType<typeof makeWASocket> | null {
  return sessions.get(tenantId) ?? null;
}

export function getQR(tenantId: string): string | null {
  return pendingQRs.get(tenantId) ?? null;
}

export async function getStatus(tenantId: string): Promise<{ status: string; phone: string | null }> {
  const res = await query(
    'SELECT phone_number FROM wa_personal_sessions WHERE tenant_id=$1::uuid',
    [tenantId],
  );
  const phone = res.rows[0]?.phone_number ?? null;

  if (connectedSessions.has(tenantId)) return { status: 'connected', phone };
  if (sessions.has(tenantId))          return { status: 'connecting', phone: null };
  return { status: 'disconnected', phone };
}

/** Returns WA phone-book contacts cached from contacts.upsert events. */
export function getWAContacts(tenantId: string): { id: string; name: string; phone: string }[] {
  return waContactsCache.get(tenantId) ?? [];
}

/** Restores tenants that had an active session saved to disk on server boot. */
export async function restoreAllSessions(): Promise<void> {
  if (!fs.existsSync(WA_SESSIONS_DIR)) return;

  for (const tenantId of fs.readdirSync(WA_SESSIONS_DIR)) {
    const dir = path.join(WA_SESSIONS_DIR, tenantId);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (fs.readdirSync(dir).length === 0) continue;
    startSession(tenantId).catch(() => null);
  }
}

/**
 * Sends a text message via Personal WhatsApp.
 * Returns the WA message ID (wamid) so callers can store it for receipt tracking.
 */
export async function sendText(tenantId: string, jid: string, text: string): Promise<string | null> {
  const sock = sessions.get(tenantId);
  if (!sock || !connectedSessions.has(tenantId)) {
    throw new Error('WhatsApp Personal session not connected');
  }
  const sessionPhone = sock.user?.id ? jidNormalizedUser(sock.user.id).split('@')[0] : null;

  // Pre-populate LID mapping for this recipient so their replies are routed correctly
  const recipientDigits = jid.split('@')[0];
  if (recipientDigits && !jid.endsWith('@lid') && ![...lidToPhone.values()].includes(recipientDigits)) {
    lookupLidForPhonesBatch(sock as any, [recipientDigits]).then(async (map) => {
      for (const [phone, lidDigits] of map) {
        if (!lidToPhone.has(lidDigits)) {
          await storeLidMapping(tenantId, lidDigits, phone).catch(() => null);
        }
      }
    }).catch(() => null);
  }

  const result = await sock.sendMessage(jid, { text });
  const wamid  = result?.key?.id ?? null;

  await query(
    `INSERT INTO wa_personal_stats (tenant_id, date, messages_sent, wa_account)
     VALUES ($1::uuid, CURRENT_DATE, 1, $2)
     ON CONFLICT (tenant_id, date) DO UPDATE SET messages_sent = wa_personal_stats.messages_sent + 1`,
    [tenantId, sessionPhone],
  ).catch(() => null);

  if (wamid && sessionPhone) {
    await query(
      `UPDATE messages SET wa_account=$1 WHERE wamid=$2 AND tenant_id=$3::uuid`,
      [sessionPhone, wamid, tenantId],
    ).catch(() => null);
  }

  return wamid;
}

/**
 * Sends a media file via Personal WhatsApp.
 * Returns the WA message ID (wamid).
 */
export async function sendMedia(
  tenantId: string,
  jid: string,
  buffer: Buffer,
  mimetype: string,
  fileName: string,
  caption?: string,
): Promise<string | null> {
  const sock = sessions.get(tenantId);
  if (!sock || !connectedSessions.has(tenantId)) {
    throw new Error('WhatsApp Personal session not connected');
  }

  let content: any;
  if (mimetype.startsWith('image/')) {
    content = { image: buffer, mimetype, caption: caption ?? '' };
  } else if (mimetype.startsWith('video/')) {
    content = { video: buffer, mimetype, caption: caption ?? '' };
  } else if (mimetype.startsWith('audio/')) {
    content = { audio: buffer, mimetype, ptt: false };
  } else {
    content = { document: buffer, mimetype, fileName, caption: caption ?? '' };
  }

  const sessionPhone = sock.user?.id ? jidNormalizedUser(sock.user.id).split('@')[0] : null;
  const result = await sock.sendMessage(jid, content);
  const wamid  = result?.key?.id ?? null;

  await query(
    `INSERT INTO wa_personal_stats (tenant_id, date, messages_sent, wa_account)
     VALUES ($1::uuid, CURRENT_DATE, 1, $2)
     ON CONFLICT (tenant_id, date) DO UPDATE SET messages_sent = wa_personal_stats.messages_sent + 1`,
    [tenantId, sessionPhone],
  ).catch(() => null);

  if (wamid && sessionPhone) {
    await query(
      `UPDATE messages SET wa_account=$1 WHERE wamid=$2 AND tenant_id=$3::uuid`,
      [sessionPhone, wamid, tenantId],
    ).catch(() => null);
  }

  return wamid;
}
