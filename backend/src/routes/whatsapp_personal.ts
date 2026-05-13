import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import {
  startSession, stopSession, destroySession,
  getQR, getStatus, sendText,
} from '../services/whatsapp/sessionManager';
import { toJID } from '../services/whatsapp/phoneUtils';
import { emitToTenant } from '../socket';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// GET /api/whatsapp-personal/status
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await getStatus(req.user!.tenantId!);
    res.json(status);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/whatsapp-personal/qr — poll for latest QR (returns null if already connected)
router.get('/qr', async (req: AuthRequest, res: Response) => {
  const qr = getQR(req.user!.tenantId!);
  res.json({ qr });
});

// POST /api/whatsapp-personal/connect — initiate QR session
router.post('/connect', checkPermission('integrations:manage'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenantId!;
  try {
    // Always destroy first — wipes stale auth files so Baileys generates a fresh QR
    // instead of trying to silently reconnect from a previous incomplete session.
    await destroySession(tenantId).catch(() => null);
    await new Promise<void>((r) => setTimeout(r, 300)); // let Node.js close file handles
    await startSession(tenantId);
    res.json({ success: true, message: 'Session starting — scan the QR code' });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to start session' });
  }
});

// DELETE /api/whatsapp-personal/disconnect
router.delete('/disconnect', checkPermission('integrations:manage'), async (req: AuthRequest, res: Response) => {
  try {
    await destroySession(req.user!.tenantId!);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/whatsapp-personal/send — send message to a lead/number
router.post('/send', checkPermission('inbox:send'), async (req: AuthRequest, res: Response) => {
  const { lead_id, phone, message } = req.body as { lead_id?: string; phone?: string; message: string };
  const { tenantId, userId } = req.user!;

  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }

  try {
    let targetPhone = phone;
    let leadId = lead_id ?? null;
    let leadName = '';

    if (lead_id) {
      const leadRes = await query(
        `SELECT id, name, phone FROM leads
         WHERE id=$1::uuid AND tenant_id=$2::uuid AND is_deleted=FALSE`,
        [lead_id, tenantId],
      );
      if (!leadRes.rows[0]) { res.status(404).json({ error: 'Lead not found' }); return; }
      targetPhone = leadRes.rows[0].phone;
      leadName = leadRes.rows[0].name;
    }

    if (!targetPhone) { res.status(400).json({ error: 'phone or lead_id required' }); return; }

    const jid = toJID(targetPhone);
    await sendText(tenantId!, jid, message.trim());

    // Find or create conversation
    let convId: string;
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
         VALUES ($1::uuid, $2, 'personal_wa', 'open', 0, NOW()) RETURNING id`,
        [tenantId, leadId],
      );
      convId = newConv.rows[0].id;
    }

    const msgRes = await query(
      `INSERT INTO messages (conversation_id, tenant_id, lead_id, sender, body, is_note, status, created_at)
       VALUES ($1, $2::uuid, $3, 'agent', $4, FALSE, 'sent', NOW()) RETURNING *`,
      [convId, tenantId, leadId, message.trim()],
    );

    await query(
      `UPDATE conversations SET last_message=$1, last_message_at=NOW() WHERE id=$2`,
      [message.trim().slice(0, 200), convId],
    );

    // Log in lead activity
    if (leadId) {
      await query(
        `INSERT INTO lead_activities (lead_id, tenant_id, type, title, detail, created_by)
         VALUES ($1::uuid, $2::uuid, 'whatsapp', 'WhatsApp sent (Personal)', $3, $4::uuid)`,
        [leadId, tenantId, message.trim().slice(0, 255), userId],
      ).catch(() => null);
    }

    emitToTenant(tenantId!, 'message:new', { ...msgRes.rows[0], channel: 'personal_wa', lead_name: leadName });
    res.status(201).json({ success: true, message: msgRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to send message' });
  }
});

// GET /api/whatsapp-personal/stats — sent/received counts + 7-day trend + session history
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [todayRes, monthRes, weekRes, sessionRes] = await Promise.all([
      query(
        `SELECT messages_sent, messages_received FROM wa_personal_stats
         WHERE tenant_id=$1::uuid AND date=CURRENT_DATE`,
        [req.user!.tenantId],
      ),
      query(
        `SELECT COALESCE(SUM(messages_sent),0) AS total_sent,
                COALESCE(SUM(messages_received),0) AS total_received
         FROM wa_personal_stats
         WHERE tenant_id=$1::uuid AND date >= DATE_TRUNC('month', CURRENT_DATE)`,
        [req.user!.tenantId],
      ),
      query(
        `SELECT date::text, COALESCE(messages_sent,0) AS sent, COALESCE(messages_received,0) AS received
         FROM wa_personal_stats
         WHERE tenant_id=$1::uuid AND date >= CURRENT_DATE - INTERVAL '6 days'
         ORDER BY date ASC`,
        [req.user!.tenantId],
      ),
      query(
        `SELECT phone, connected_at, disconnected_at, disconnect_reason
         FROM wa_session_history
         WHERE tenant_id=$1::uuid
         ORDER BY connected_at DESC LIMIT 10`,
        [req.user!.tenantId],
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({
      today: {
        sent:     todayRes.rows[0]?.messages_sent     ?? 0,
        received: todayRes.rows[0]?.messages_received ?? 0,
      },
      month: {
        sent:     Number(monthRes.rows[0]?.total_sent     ?? 0),
        received: Number(monthRes.rows[0]?.total_received ?? 0),
      },
      week: weekRes.rows,
      sessions: sessionRes.rows,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Analytics helpers ─────────────────────────────────────────────────────────

function periodBounds(period: string): { start: string; prevStart: string; prevEnd: string } {
  const MS_DAY = 86_400_000;
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let startMs: number;
  let durationMs: number;

  switch (period) {
    case 'today':
      startMs = todayMs; durationMs = MS_DAY; break;
    case 'yesterday':
      startMs = todayMs - MS_DAY; durationMs = MS_DAY; break;
    case 'month':
      startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      durationMs = todayMs - startMs + MS_DAY; break;
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      startMs = new Date(now.getFullYear(), q * 3, 1).getTime();
      durationMs = todayMs - startMs + MS_DAY; break;
    }
    default: // week
      startMs = todayMs - 6 * MS_DAY; durationMs = 7 * MS_DAY;
  }

  const fmt = (ms: number) => new Date(ms).toISOString().split('T')[0];
  return { start: fmt(startMs), prevStart: fmt(startMs - durationMs), prevEnd: fmt(startMs) };
}

// GET /api/whatsapp-personal/analytics?period=week
router.get('/analytics', async (req: AuthRequest, res: Response) => {
  const { period = 'week' } = req.query as { period?: string };
  const tenantId = req.user!.tenantId!;
  const { start, prevStart, prevEnd } = periodBounds(period);
  const startTs    = start     + 'T00:00:00Z';
  const prevStartTs = prevStart + 'T00:00:00Z';
  const prevEndTs   = prevEnd   + 'T00:00:00Z';

  try {
    const [cur, prev, curContacts, prevContacts, reply] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(messages_sent),0)::int AS sent,
                COALESCE(SUM(messages_received),0)::int AS received
         FROM wa_personal_stats WHERE tenant_id=$1::uuid AND date >= $2::date`,
        [tenantId, start],
      ),
      query(
        `SELECT COALESCE(SUM(messages_sent),0)::int AS sent,
                COALESCE(SUM(messages_received),0)::int AS received
         FROM wa_personal_stats WHERE tenant_id=$1::uuid AND date >= $2::date AND date < $3::date`,
        [tenantId, prevStart, prevEnd],
      ),
      query(
        `SELECT COUNT(DISTINCT COALESCE(m.remote_jid, m.lead_id::text))::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id AND c.channel = 'personal_wa'
         WHERE m.tenant_id=$1::uuid AND m.created_at >= $2::timestamptz`,
        [tenantId, startTs],
      ),
      query(
        `SELECT COUNT(DISTINCT COALESCE(m.remote_jid, m.lead_id::text))::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id AND c.channel = 'personal_wa'
         WHERE m.tenant_id=$1::uuid AND m.created_at >= $2::timestamptz AND m.created_at < $3::timestamptz`,
        [tenantId, prevStartTs, prevEndTs],
      ),
      query(
        `WITH conv_stats AS (
           SELECT m.conversation_id,
             COUNT(*) FILTER (WHERE m.sender='agent')    AS sent_cnt,
             COUNT(*) FILTER (WHERE m.sender='customer') AS recv_cnt
           FROM messages m
           JOIN conversations c ON c.id = m.conversation_id AND c.channel = 'personal_wa'
           WHERE m.tenant_id=$1::uuid AND m.created_at >= $2::timestamptz
           GROUP BY m.conversation_id
         )
         SELECT COUNT(*) FILTER (WHERE recv_cnt > 0)::int AS total_inbound,
                COUNT(*) FILTER (WHERE recv_cnt > 0 AND sent_cnt > 0)::int AS replied
         FROM conv_stats`,
        [tenantId, startTs],
      ),
    ]);

    const totalInbound = reply.rows[0]?.total_inbound ?? 0;
    const replied      = reply.rows[0]?.replied ?? 0;
    const replyRate    = totalInbound > 0 ? Math.round((replied / totalInbound) * 100) : 0;

    res.json({
      sent:      { value: cur.rows[0]?.sent ?? 0,          prev: prev.rows[0]?.sent ?? 0 },
      received:  { value: cur.rows[0]?.received ?? 0,      prev: prev.rows[0]?.received ?? 0 },
      contacts:  { value: curContacts.rows[0]?.count ?? 0, prev: prevContacts.rows[0]?.count ?? 0 },
      replyRate: { value: replyRate, totalInbound, replied },
    });
  } catch (err: any) { res.status(500).json({ error: err.message ?? 'Server error' }); }
});

// GET /api/whatsapp-personal/volume?period=week
router.get('/volume', async (req: AuthRequest, res: Response) => {
  const { period = 'week' } = req.query as { period?: string };
  const tenantId = req.user!.tenantId!;
  const { start } = periodBounds(period);
  try {
    const result = await query(
      `SELECT date::text,
              COALESCE(messages_sent,0)::int AS sent,
              COALESCE(messages_received,0)::int AS received
       FROM wa_personal_stats
       WHERE tenant_id=$1::uuid AND date >= $2::date ORDER BY date ASC`,
      [tenantId, start],
    );
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message ?? 'Server error' }); }
});

// GET /api/whatsapp-personal/top-contacts?period=week&limit=5
router.get('/top-contacts', async (req: AuthRequest, res: Response) => {
  const { period = 'week', limit = '5' } = req.query as { period?: string; limit?: string };
  const tenantId = req.user!.tenantId!;
  const { start } = periodBounds(period);
  const startTs = start + 'T00:00:00Z';
  try {
    const result = await query(
      `SELECT
         COALESCE(l.name,  REGEXP_REPLACE(COALESCE(m.remote_jid,''), '@.*$', '')) AS contact_name,
         COALESCE(l.phone, REGEXP_REPLACE(COALESCE(m.remote_jid,''), '@.*$', '')) AS phone,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE m.sender='agent')::int    AS sent,
         COUNT(*) FILTER (WHERE m.sender='customer')::int AS received
       FROM messages m
       JOIN  conversations c ON c.id = m.conversation_id AND c.channel = 'personal_wa'
       LEFT JOIN leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id AND l.is_deleted = FALSE
       WHERE m.tenant_id=$1::uuid AND m.created_at >= $2::timestamptz
       GROUP BY COALESCE(l.name,  REGEXP_REPLACE(COALESCE(m.remote_jid,''), '@.*$', '')),
                COALESCE(l.phone, REGEXP_REPLACE(COALESCE(m.remote_jid,''), '@.*$', ''))
       ORDER BY total DESC LIMIT $3`,
      [tenantId, startTs, parseInt(limit) || 5],
    );
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message ?? 'Server error' }); }
});

// GET /api/whatsapp-personal/logs?period=week&direction=all&search=&limit=50&offset=0
router.get('/logs', async (req: AuthRequest, res: Response) => {
  const { period = 'week', direction = 'all', search = '', limit = '50', offset = '0' } =
    req.query as Record<string, string>;
  const tenantId = req.user!.tenantId!;
  const { start } = periodBounds(period);
  const startTs = start + 'T00:00:00Z';

  const baseParams: any[] = [tenantId, startTs];
  let where = `m.tenant_id=$1::uuid AND m.created_at >= $2::timestamptz AND c.channel='personal_wa'`;

  if (direction === 'sent')     where += ` AND m.sender='agent'`;
  else if (direction === 'received') where += ` AND m.sender='customer'`;

  if (search.trim()) {
    baseParams.push(`%${search.trim()}%`);
    const n = baseParams.length;
    where += ` AND (l.name ILIKE $${n} OR l.phone ILIKE $${n} OR m.remote_jid ILIKE $${n})`;
  }

  const dataParams = [...baseParams, parseInt(limit) || 50, parseInt(offset) || 0];
  const lIdx = dataParams.length - 1;
  const oIdx = dataParams.length;

  try {
    const [rows, countRes] = await Promise.all([
      query(
        `SELECT m.id, m.sender, m.body, m.created_at, m.wa_account, m.remote_jid, m.status, m.type,
                COALESCE(l.name,  REGEXP_REPLACE(COALESCE(m.remote_jid,''), '@.*$', '')) AS contact_name,
                COALESCE(l.phone, REGEXP_REPLACE(COALESCE(m.remote_jid,''), '@.*$', '')) AS contact_phone
         FROM messages m
         JOIN  conversations c ON c.id = m.conversation_id
         LEFT JOIN leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id AND l.is_deleted = FALSE
         WHERE ${where}
         ORDER BY m.created_at DESC LIMIT $${lIdx} OFFSET $${oIdx}`,
        dataParams,
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM messages m
         JOIN  conversations c ON c.id = m.conversation_id
         LEFT JOIN leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id AND l.is_deleted = FALSE
         WHERE ${where}`,
        baseParams,
      ),
    ]);
    res.json({ rows: rows.rows, total: countRes.rows[0]?.total ?? 0 });
  } catch (err: any) { res.status(500).json({ error: err.message ?? 'Server error' }); }
});

// GET /api/whatsapp-personal/settings — tenant WA personal settings
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const res2 = await query(
      `SELECT settings->>'wa_auto_create_lead' AS wa_auto_create_lead FROM tenants WHERE id=$1::uuid`,
      [req.user!.tenantId],
    );
    res.json({ wa_auto_create_lead: res2.rows[0]?.wa_auto_create_lead === 'true' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/whatsapp-personal/settings — update WA personal settings
router.patch('/settings', async (req: AuthRequest, res: Response) => {
  const { wa_auto_create_lead } = req.body as { wa_auto_create_lead?: boolean };
  try {
    await query(
      `UPDATE tenants
       SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('wa_auto_create_lead', $1::text)
       WHERE id=$2::uuid`,
      [String(!!wa_auto_create_lead), req.user!.tenantId],
    );
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
