import path from 'path';
import fs from 'fs';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import { query } from '../../db';
import { emitToTenant } from '../../socket';
import { handleInboundMessage } from './messageHandler';

const WA_SESSIONS_DIR = process.env.WA_SESSIONS_DIR
  || path.join(process.cwd(), 'wa_sessions');

// In-memory state — source of truth (more reliable than DB after restarts)
const sessions          = new Map<string, ReturnType<typeof makeWASocket>>();
const connectedSessions = new Set<string>();   // tenants with a fully open WA connection
const pendingQRs        = new Map<string, string>();
const retryCount        = new Map<string, number>(); // transient-disconnect retry counter
const intentionallyStopped = new Set<string>(); // prevents spurious retry after manual stop

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

export async function startSession(tenantId: string): Promise<void> {
  // Close any existing socket without touching DB (intentional stop — suppress retry)
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
      const jid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
      const phone = jid ? jid.split('@')[0] : null;
      console.log(`[WA] Connected for tenant ${tenantId.slice(0, 8)}: ${phone ?? 'unknown'}`);
      await upsertSessionStatus(tenantId, 'connected', phone ? `+${phone}` : null);
    }

    if (connection === 'close') {
      connectedSessions.delete(tenantId);
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut || code === 401;
      console.log(`[WA] Connection closed for tenant ${tenantId.slice(0, 8)}: code=${code ?? 'none'}, loggedOut=${loggedOut}`);

      // If this close was triggered by an intentional stopSession call, don't retry
      if (intentionallyStopped.has(tenantId)) return;

      if (loggedOut) {
        retryCount.delete(tenantId);
        sessions.delete(tenantId);
        try { fs.rmSync(sessionDir(tenantId), { recursive: true, force: true }); } catch {}
        await upsertSessionStatus(tenantId, 'disconnected');
      } else {
        const current = (retryCount.get(tenantId) ?? 0) + 1;
        if (current >= MAX_RETRIES) {
          // Stale auth files — give up, wipe, let user re-scan
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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      await handleInboundMessage(tenantId, msg).catch(() => null);
    }
  });
}

export async function stopSession(tenantId: string, updateDb = true): Promise<void> {
  // Mark as intentional so the close event handler doesn't schedule a retry
  intentionallyStopped.add(tenantId);
  setTimeout(() => intentionallyStopped.delete(tenantId), 3000); // clear after close event fires

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

/**
 * Returns live status using in-memory state as source of truth.
 * If there is no live socket in memory, always returns 'disconnected' — DB value is
 * unreliable after restarts (may be stale 'connected' from a previous session).
 */
export async function getStatus(tenantId: string): Promise<{ status: string; phone: string | null }> {
  const res = await query(
    'SELECT phone_number FROM wa_personal_sessions WHERE tenant_id=$1::uuid',
    [tenantId],
  );
  const phone = res.rows[0]?.phone_number ?? null;

  if (connectedSessions.has(tenantId)) return { status: 'connected', phone };
  if (sessions.has(tenantId))          return { status: 'connecting', phone: null };

  // No live socket — always disconnected regardless of what the DB says
  return { status: 'disconnected', phone };
}

/** Called on server boot — restores tenants that had an active session saved to disk */
export async function restoreAllSessions(): Promise<void> {
  if (!fs.existsSync(WA_SESSIONS_DIR)) return;

  const tenantDirs = fs.readdirSync(WA_SESSIONS_DIR);
  for (const tenantId of tenantDirs) {
    const dir = path.join(WA_SESSIONS_DIR, tenantId);
    if (!fs.statSync(dir).isDirectory()) continue;
    const files = fs.readdirSync(dir);
    if (files.length === 0) continue;

    startSession(tenantId).catch(() => null);
  }
}

export async function sendText(tenantId: string, jid: string, text: string): Promise<void> {
  const sock = sessions.get(tenantId);
  if (!sock || !connectedSessions.has(tenantId)) {
    throw new Error('WhatsApp Personal session not connected');
  }
  await sock.sendMessage(jid, { text });

  await query(
    `INSERT INTO wa_personal_stats (tenant_id, date, messages_sent)
     VALUES ($1::uuid, CURRENT_DATE, 1)
     ON CONFLICT (tenant_id, date) DO UPDATE SET messages_sent = wa_personal_stats.messages_sent + 1`,
    [tenantId],
  ).catch(() => null);
}
