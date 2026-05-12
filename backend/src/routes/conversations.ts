import path from 'path';
import fs from 'fs';
import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission, hasPermission } from '../middleware/permissions';
import { maskPhone } from '../utils/phone';
import { decrypt } from '../utils/crypto';
import { emitToTenant } from '../socket';
import https from 'https';
import { sendText, getSession } from '../services/whatsapp/sessionManager';
import { toJID } from '../services/whatsapp/phoneUtils';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

const WA_MEDIA_DIR = process.env.WA_MEDIA_DIR || path.join(process.cwd(), 'wa_media');

function sendWAMessage(phoneNumberId: string, token: string, toPhone: string, text: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhone.replace(/\D/g, ''),
      type: 'text',
      text: { body: text },
    });
    const options = {
      hostname: 'graph.facebook.com',
      path: `/v17.0/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// GET /api/conversations
router.get('/', checkPermission('inbox:send'), async (req: AuthRequest, res: Response) => {
  const { userId, tenantId, role } = req.user!;
  const { status, assigned_to, search } = req.query as Record<string, string>;
  const isSuperAdmin = role === 'super_admin';

  let viewAll = isSuperAdmin;
  if (!isSuperAdmin) {
    try {
      const ownerRes = await query('SELECT is_owner FROM users WHERE id=$1', [userId]);
      if (ownerRes.rows[0]?.is_owner) {
        viewAll = true;
      } else {
        viewAll = await hasPermission(userId, 'inbox:view_all', tenantId);
      }
    } catch { viewAll = false; }
  }

  // Format anonymous phone as +E164 for display; leads.phone is shown as-is (already formatted)
  let sql = `
    SELECT c.*,
           COALESCE(l.name, '+' || c.phone, 'Unknown')   AS lead_name,
           COALESCE(l.phone, '+' || c.phone)             AS lead_phone,
           u.name AS assigned_name
    FROM conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    LEFT JOIN users u ON u.id = c.assigned_to
    WHERE c.tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (!viewAll) {
    const userIdx = params.push(userId);
    sql += ` AND (c.assigned_to = $${userIdx} OR l.assigned_to = $${userIdx})`;
  }

  if (status)      { params.push(status);        sql += ` AND c.status = $${params.length}`; }
  if (assigned_to) { params.push(assigned_to);   sql += ` AND c.assigned_to = $${params.length}`; }
  // Search by lead name OR anonymous phone
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (l.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
  }
  sql += ' ORDER BY c.last_message_at DESC NULLS LAST';

  try {
    const result = await query(sql, params);
    let rows = result.rows;
    if (!isSuperAdmin) {
      let shouldMask = false;
      try { shouldMask = await hasPermission(userId, 'leads:mask_phone', tenantId); } catch {}
      if (shouldMask) rows = rows.map((r: any) => ({ ...r, lead_phone: maskPhone(r.lead_phone) }));
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/conversations/media/:msgId — serve downloaded WA media with auth
router.get('/media/:msgId', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const msgRes = await query(
      `SELECT media_url FROM messages WHERE id=$1 AND tenant_id=$2`,
      [req.params.msgId, tenantId],
    );
    const relPath = msgRes.rows[0]?.media_url;
    if (!relPath) { res.status(404).json({ error: 'Media not found' }); return; }

    const filePath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }

    res.sendFile(filePath);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/conversations/:id/messages
// Supports: ?limit=50&before=<ISO timestamp> for cursor-based pagination
router.get('/:id/messages', checkPermission('inbox:send'), async (req: AuthRequest, res: Response) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    const params: any[] = [req.params.id, req.user!.tenantId];
    let sql = `SELECT * FROM messages WHERE conversation_id=$1 AND tenant_id=$2`;

    if (before) {
      params.push(before);
      sql += ` AND created_at < $${params.length}::timestamptz`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    res.json(result.rows.reverse()); // return ascending (oldest first)
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', checkPermission('inbox:send'), async (req: AuthRequest, res: Response) => {
  const { body, is_note } = req.body as { body?: string; is_note?: boolean };
  if (!body?.trim()) { res.status(400).json({ error: 'body required' }); return; }
  try {
    const convRes = await query(
      `SELECT c.*, COALESCE(l.phone, c.phone) AS lead_phone
       FROM conversations c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.id=$1 AND c.tenant_id=$2`,
      [req.params.id, req.user!.tenantId],
    );
    if (!convRes.rows[0]) { res.status(404).json({ error: 'Conversation not found' }); return; }
    const conv = convRes.rows[0];

    let wamid: string | null = null;

    // Send via WABA
    if (!is_note && conv.channel === 'whatsapp' && conv.lead_phone) {
      try {
        const wabaRes = await query(
          'SELECT phone_number_id, access_token FROM waba_integrations WHERE tenant_id=$1 AND is_active=TRUE',
          [req.user!.tenantId],
        );
        if (wabaRes.rows[0]) {
          const { phone_number_id, access_token: encToken } = wabaRes.rows[0];
          const token = decrypt(encToken);
          const waResp = await sendWAMessage(phone_number_id, token, conv.lead_phone, body.trim());
          wamid = waResp?.messages?.[0]?.id ?? null;
        }
      } catch (e) { console.error('WABA send error:', e); }
    }

    // Send via Personal WhatsApp (Baileys)
    let deliveryFailed = false;
    if (!is_note && conv.channel === 'personal_wa') {
      if (!conv.lead_phone) {
        console.error('[Personal WA] No phone on conversation', req.params.id);
        deliveryFailed = true;
      } else {
        try {
          wamid = await sendText(req.user!.tenantId!, toJID(conv.lead_phone), body.trim());
        } catch (e: any) {
          console.error('[Personal WA] Send error:', e?.message ?? e);
          deliveryFailed = true;
        }
      }
    }

    const msgStatus = (is_note || !deliveryFailed) ? 'sent' : 'failed';
    const msgRes = await query(
      `INSERT INTO messages (conversation_id, tenant_id, lead_id, sender, body, is_note, wamid, status, created_at)
       VALUES ($1,$2,$3,'agent',$4,$5,$6,$7,NOW()) RETURNING *`,
      [req.params.id, req.user!.tenantId, conv.lead_id ?? null, body.trim(), is_note ?? false, wamid, msgStatus],
    );

    if (!is_note) {
      await query(
        `UPDATE conversations SET last_message=$1, last_message_at=NOW(), unread_count=0 WHERE id=$2`,
        [body.trim(), req.params.id],
      );
      // Emit conversation:updated so all connected clients update the preview and re-sort
      emitToTenant(req.user!.tenantId!, 'conversation:updated', {
        id:              req.params.id,
        last_message:    body.trim(),
        last_message_at: new Date().toISOString(),
        unread_count:    0,
      });
    }

    emitToTenant(req.user!.tenantId!, 'message:new', msgRes.rows[0]);
    res.status(201).json(msgRes.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/conversations/:id/typing — sends WA typing presence update
router.post('/:id/typing', checkPermission('inbox:send'), async (req: AuthRequest, res: Response) => {
  try {
    const convRes = await query(
      `SELECT c.channel, COALESCE(l.phone, c.phone) AS lead_phone
       FROM conversations c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.id=$1 AND c.tenant_id=$2`,
      [req.params.id, req.user!.tenantId],
    );
    if (!convRes.rows[0]) { res.json({ success: false }); return; }
    const { channel, lead_phone } = convRes.rows[0];

    if (channel === 'personal_wa' && lead_phone) {
      const sock = getSession(req.user!.tenantId!);
      if (sock) {
        const jid = toJID(lead_phone);
        sock.sendPresenceUpdate('composing', jid).catch(() => null);
        setTimeout(() => sock.sendPresenceUpdate('paused', jid).catch(() => null), 3000);
      }
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/conversations/:id/assign
router.patch('/:id/assign', checkPermission('inbox:send'), async (req: AuthRequest, res: Response) => {
  const { assigned_to } = req.body as { assigned_to?: string | null };
  try {
    const result = await query(
      'UPDATE conversations SET assigned_to=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [assigned_to ?? null, req.params.id, req.user!.tenantId],
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    const full = await query(
      `SELECT c.*,
              COALESCE(l.name, '+' || c.phone, 'Unknown') AS lead_name,
              COALESCE(l.phone, '+' || c.phone)           AS lead_phone,
              u.name AS assigned_name
       FROM conversations c
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN users u ON u.id = c.assigned_to
       WHERE c.id=$1 AND c.tenant_id=$2`,
      [req.params.id, req.user!.tenantId],
    );
    const payload = full.rows[0] ?? result.rows[0];
    emitToTenant(req.user!.tenantId!, 'conversation:updated', payload);
    res.json(payload);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/conversations/:id/status
router.patch('/:id/status', checkPermission('inbox:send'), async (req: AuthRequest, res: Response) => {
  const { status } = req.body as { status?: string };
  if (!status) { res.status(400).json({ error: 'status required' }); return; }
  try {
    const result = await query(
      'UPDATE conversations SET status=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [status, req.params.id, req.user!.tenantId],
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    const full = await query(
      `SELECT c.*,
              COALESCE(l.name, '+' || c.phone, 'Unknown') AS lead_name,
              COALESCE(l.phone, '+' || c.phone)           AS lead_phone,
              u.name AS assigned_name
       FROM conversations c
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN users u ON u.id = c.assigned_to
       WHERE c.id=$1 AND c.tenant_id=$2`,
      [req.params.id, req.user!.tenantId],
    );
    const payload = full.rows[0] ?? result.rows[0];
    emitToTenant(req.user!.tenantId!, 'conversation:updated', payload);
    res.json(payload);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/conversations/:id/read — mark as read + send blue-tick receipts back to WA
router.patch('/:id/read', checkPermission('inbox:send'), async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'UPDATE conversations SET unread_count=0 WHERE id=$1 AND tenant_id=$2',
      [req.params.id, req.user!.tenantId],
    );

    // Send read receipts back to WhatsApp Personal (blue ticks)
    const sock = getSession(req.user!.tenantId!);
    if (sock) {
      const unread = await query(
        `SELECT wamid, remote_jid FROM messages
         WHERE conversation_id=$1 AND tenant_id=$2 AND sender='customer' AND status='delivered'
           AND wamid IS NOT NULL AND remote_jid IS NOT NULL`,
        [req.params.id, req.user!.tenantId],
      );
      if (unread.rows.length > 0) {
        const keys = unread.rows.map((r: any) => ({
          remoteJid: r.remote_jid,
          id:        r.wamid,
          fromMe:    false,
        }));
        sock.readMessages(keys).catch(() => null);

        const wamids = unread.rows.map((r: any) => r.wamid);
        await query(
          `UPDATE messages SET status='read' WHERE wamid = ANY($1) AND tenant_id=$2`,
          [wamids, req.user!.tenantId],
        ).catch(() => null);
      }
    }

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
