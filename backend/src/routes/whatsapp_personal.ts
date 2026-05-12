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
