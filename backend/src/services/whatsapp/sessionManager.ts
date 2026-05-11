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
const sessions   = new Map<string, ReturnType<typeof makeWASocket>>();
const connectedSessions = new Set<string>();   // tenants with a fully open connection
const pendingQRs = new Map<string, string>();
const retryCount = new Map<string, number>();  // transient-disconnect retry counter

const MAX_RETRIES = 5;  // after 5 failed reconnects, wipe stale auth and give up

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
  // Close any existing socket without touching DB
  await stopSession(tenantId, false);
  pendingQRs.delete(tenantId);

  const authDir = sessionDir(tenantId);
  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  await upsertSessionStatus(tenantId, 'connecting');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['DigyGo CRM', 'Chrome', '1.0'],
    logger: { level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as any,
  });

  sessions.set(tenantId, sock);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrBase64 = await qrcode.toDataURL(qr);
        pendingQRs.set(tenantId, qrBase64);
        emitToTenant(tenantId, 'wa:qr', { qr: qrBase64 });
      } catch { /* ignore */ }
    }

    if (connection === 'open') {
      retryCount.delete(tenantId);       // reset retry counter on success
      connectedSessions.add(tenantId);
      pendingQRs.delete(tenantId);
      const jid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
      const phone = jid ? jid.split('@')[0] : null;
      await upsertSessionStatus(tenantId, 'connected', phone ? `+${phone}` : null);
    }

    if (connection === 'close') {
      connectedSessions.delete(tenantId);
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut || code === 401;

      if (loggedOut) {
        // Explicit logout — wipe auth and stop completely
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
 * Returns live status using in-memory state as the source of truth.
 * DB is only consulted for the phone number (which doesn't change mid-session).
 * This prevents stale 'connecting' states from persisting after server restarts.
 */
export async function getStatus(tenantId: string): Promise<{ status: string; phone: string | null }> {
  if (connectedSessions.has(tenantId)) {
    const res = await query(
      'SELECT phone_number FROM wa_personal_sessions WHERE tenant_id=$1::uuid',
      [tenantId],
    );
    return { status: 'connected', phone: res.rows[0]?.phone_number ?? null };
  }

  if (sessions.has(tenantId)) {
    // Socket exists but handshake not yet complete
    return { status: 'connecting', phone: null };
  }

  // No in-memory session — read DB but treat stale 'connecting' as disconnected
  const res = await query(
    'SELECT status, phone_number FROM wa_personal_sessions WHERE tenant_id=$1::uuid',
    [tenantId],
  );
  const dbStatus = res.rows[0]?.status ?? 'disconnected';
  return {
    status: dbStatus === 'connecting' ? 'disconnected' : dbStatus,
    phone: res.rows[0]?.phone_number ?? null,
  };
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
