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

// In-memory state — source of truth (more reliable than DB after restarts)
const sessions          = new Map<string, ReturnType<typeof makeWASocket>>();
const connectedSessions = new Set<string>();
const pendingQRs        = new Map<string, string>();
const retryCount        = new Map<string, number>();
const intentionallyStopped = new Set<string>();

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
    }

    if (connection === 'close') {
      connectedSessions.delete(tenantId);
      const code      = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut || code === 401;
      console.log(`[WA] Connection closed for tenant ${tenantId.slice(0, 8)}: code=${code ?? 'none'}, loggedOut=${loggedOut}`);

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

    for (const msg of messages) {
      const result = await handleInboundMessage(tenantId, msg, { historical }).catch(() => null);
      if (result?.hasMedia && !historical) {
        // Download media asynchronously — don't block message processing
        downloadAndStoreMedia(tenantId, msg, result.msgId).catch(() => null);
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
    for (const contact of contacts) {
      if (!contact.name) continue;
      const digits = contact.id?.split('@')[0];
      if (!digits) continue;

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
  const result = await sock.sendMessage(jid, { text });
  const wamid  = result?.key?.id ?? null;

  await query(
    `INSERT INTO wa_personal_stats (tenant_id, date, messages_sent)
     VALUES ($1::uuid, CURRENT_DATE, 1)
     ON CONFLICT (tenant_id, date) DO UPDATE SET messages_sent = wa_personal_stats.messages_sent + 1`,
    [tenantId],
  ).catch(() => null);

  return wamid;
}
