import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import https from 'https';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission, hasPermission } from '../middleware/permissions';
import { checkPlan, checkUsage, incrementUsage } from '../middleware/plan';
import { sendEmail, isSmtpConfigured } from '../services/email';
import { decrypt } from '../utils/crypto';
import { maskPhone } from '../utils/phone';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', checkPermission('automation:view'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT w.*,
              COALESCE(s.total_contacts, 0) AS total_contacts,
              COALESCE(s.completed,      0) AS completed,
              COALESCE(s.skipped,        0) AS skipped,
              COALESCE(s.failed,         0) AS failed
       FROM workflows w
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)                                                     AS total_contacts,
           COUNT(*) FILTER (WHERE status = 'completed')                 AS completed,
           COUNT(*) FILTER (WHERE status = 'completed_with_errors')     AS completed_with_errors,
           COUNT(*) FILTER (WHERE status = 'skipped')                   AS skipped,
           COUNT(*) FILTER (WHERE status = 'failed')                    AS failed
         FROM (
           SELECT DISTINCT ON (COALESCE(lead_id::text, id::text)) status
           FROM workflow_executions
           WHERE workflow_id = w.id
           ORDER BY COALESCE(lead_id::text, id::text), enrolled_at DESC
         ) latest
       ) s ON true
       WHERE w.tenant_id=$1
       ORDER BY w.created_at DESC`,
      [req.user!.tenantId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', checkPlan('basic_workflows'), checkPermission('automation:manage'), checkUsage('workflows'), async (req: AuthRequest, res: Response) => {
  const { name, description, nodes, status, allow_reentry } = req.body;
  const nodeList = nodes ?? [];
  const triggerNode = (nodeList as any[]).find((n: any) => n.type === 'trigger');
  const triggerKey   = triggerNode?.actionType ?? '';
  const triggerForms: string[] = Array.isArray(triggerNode?.config?.forms) ? triggerNode.config.forms : [];
  try {
    const result = await query(
      `INSERT INTO workflows (tenant_id, name, description, nodes, status, allow_reentry, trigger_key, trigger_forms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user!.tenantId, name ?? 'Untitled Automation', description ?? '',
       JSON.stringify(nodeList), status ?? 'inactive', allow_reentry ?? false,
       triggerKey, triggerForms]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Workflow Folders (must be before /:id to avoid capture) ──────────────────

router.get('/folders', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM workflow_folders WHERE tenant_id=$1 ORDER BY created_at ASC`,
      [req.user!.tenantId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/folders', checkPermission('automation:manage'), async (req: AuthRequest, res: Response) => {
  const { name, workflow_ids } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }
  try {
    const result = await query(
      `INSERT INTO workflow_folders (tenant_id, name, workflow_ids) VALUES ($1,$2,$3) RETURNING *`,
      [req.user!.tenantId, name.trim(), JSON.stringify(workflow_ids ?? [])]
    );
    res.status(201).json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/folders/:id', checkPermission('automation:manage'), async (req: AuthRequest, res: Response) => {
  const { name, workflow_ids } = req.body;
  const fields: string[] = [];
  const params: any[] = [];
  if (name !== undefined)         { params.push(name);                         fields.push(`name=$${params.length}`); }
  if (workflow_ids !== undefined) { params.push(JSON.stringify(workflow_ids)); fields.push(`workflow_ids=$${params.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  fields.push(`updated_at=NOW()`);
  params.push(req.params.id, req.user!.tenantId);
  try {
    const result = await query(
      `UPDATE workflow_folders SET ${fields.join(',')} WHERE id=$${params.length-1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/folders/:id', checkPermission('automation:manage'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM workflow_folders WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Individual workflow CRUD (after /folders to avoid capture) ────────────────

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user!.tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/:id', checkPermission('automation:manage'), async (req: AuthRequest, res: Response) => {
  const { name, description, nodes, status, allow_reentry } = req.body;
  const fields: string[] = [];
  const params: any[] = [];

  if (name !== undefined)          { params.push(name);                     fields.push(`name=$${params.length}`); }
  if (description !== undefined)   { params.push(description);              fields.push(`description=$${params.length}`); }
  if (nodes !== undefined)         {
    params.push(JSON.stringify(nodes));    fields.push(`nodes=$${params.length}`);
    // Keep denormalised trigger columns in sync so targeted queries stay accurate
    const triggerNode = (nodes as any[]).find((n: any) => n.type === 'trigger');
    const triggerKey   = triggerNode?.actionType ?? '';
    const triggerForms: string[] = Array.isArray(triggerNode?.config?.forms) ? triggerNode.config.forms : [];
    params.push(triggerKey);  fields.push(`trigger_key=$${params.length}`);
    params.push(triggerForms); fields.push(`trigger_forms=$${params.length}`);
  }
  if (status !== undefined) {
    if (status === 'active') {
      // Resolve the trigger_key — either from the nodes being saved now, or from the DB
      let effectiveTriggerKey = '';
      if (nodes !== undefined) {
        const triggerNode = (nodes as any[]).find((n: any) => n.type === 'trigger');
        effectiveTriggerKey = triggerNode?.actionType ?? '';
      } else {
        const cur = await query('SELECT trigger_key FROM workflows WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
        effectiveTriggerKey = cur.rows[0]?.trigger_key ?? '';
      }
      if (!effectiveTriggerKey) {
        res.status(400).json({ error: 'Without a trigger, this automation won\'t run. Set up a trigger first.' });
        return;
      }
    }
    params.push(status); fields.push(`status=$${params.length}`);
  }
  if (allow_reentry !== undefined) { params.push(allow_reentry);            fields.push(`allow_reentry=$${params.length}`); }

  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  fields.push(`updated_at=NOW()`);
  params.push(req.params.id, req.user!.tenantId);

  try {
    const result = await query(
      `UPDATE workflows SET ${fields.join(',')} WHERE id=$${params.length-1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', checkPermission('automation:manage'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM workflows WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id/logs', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role, tenantId } = req.user!;
    let onlyAssigned = false;
    let shouldMaskPhone = false;
    if (role !== 'super_admin') {
      try { onlyAssigned = await hasPermission(userId, 'leads:only_assigned', tenantId); } catch { onlyAssigned = true; }
      try { shouldMaskPhone = await hasPermission(userId, 'leads:mask_phone', tenantId); } catch {}
    }
    const params: any[] = [req.params.id, req.user!.tenantId];
    let assignedFilter = '';
    if (onlyAssigned) {
      params.push(userId);
      assignedFilter = ` AND ld.assigned_to = $${params.length}`;
    }
    const result = await query(
      `SELECT e.*, ld.phone AS lead_phone,
              json_agg(l ORDER BY l.created_at ASC) FILTER (WHERE l.id IS NOT NULL) AS steps
       FROM workflow_executions e
       LEFT JOIN leads ld ON ld.id = e.lead_id
       LEFT JOIN workflow_execution_logs l ON l.execution_id = e.id
       WHERE e.workflow_id=$1 AND e.tenant_id=$2${assignedFilter}
       GROUP BY e.id, ld.phone
       ORDER BY e.enrolled_at DESC
       LIMIT 5000`,
      params
    );
    const rows = shouldMaskPhone
      ? result.rows.map((r: any) => ({ ...r, lead_phone: maskPhone(r.lead_phone) }))
      : result.rows;
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Execution Engine ──────────────────────────────────────────────────────────

interface WFNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay';
  actionType: string;
  label: string;
  config: Record<string, any>;
  branches?: { yes: WFNode[]; no: WFNode[] };
}

export interface LeadContext {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  stage_id?: string;
  stage_name?: string;
  pipeline_id?: string;
  pipeline_name?: string;
  assigned_to?: string;
  assigned_staff_name?: string;
  tags?: string[];
  source?: string;
  status?: string;
  custom_fields?: Record<string, any>;
  form_id?: string;
  form_name?: string;
  event_type_id?: string;
  calendar_name?: string;
}

// Replaces {variable} and {%contact.variable%} placeholders with actual lead values.
// Both formats are equivalent: {%contact.name%} === {name} === Sruthi (for that contact only).
export function interpolate(template: string, lead: LeadContext): string {
  if (!template) return template;
  const nameParts = (lead.name ?? '').trim().split(/\s+/);
  const vars: Record<string, string> = {
    first_name:          nameParts[0] ?? '',
    last_name:           nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
    full_name:           lead.name ?? '',
    name:                lead.name ?? '',
    email:               lead.email ?? '',
    phone:               lead.phone ?? '',
    stage:               lead.stage_name ?? '',
    pipeline:            lead.pipeline_name ?? '',
    assigned_staff:      lead.assigned_staff_name ?? '',
    source:              lead.source ?? '',
    status:              lead.status ?? '',
    today:               new Date().toLocaleDateString(),
    date:                new Date().toLocaleDateString(),
    time:                new Date().toLocaleTimeString(),
    ...(lead.custom_fields ?? {}),
  };
  // Step 1: replace {%contact.field%} format
  const step1 = template.replace(/\{%contact\.(\w+)%\}/g, (_, key) => vars[key] ?? `{%contact.${key}%}`);
  // Step 2: replace legacy {field} format
  return step1.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

async function logStep(
  executionId: string, workflowId: string, tenantId: string,
  node: WFNode, status: string, message: string
): Promise<void> {
  await query(
    `INSERT INTO workflow_execution_logs
       (execution_id, workflow_id, tenant_id, node_id, action_type, status, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [executionId, workflowId, tenantId, node.id ?? `node-${Date.now()}`, node.actionType ?? 'unknown', status, message]
  ).catch((err: any) => console.error('[logStep]', node.actionType, err.message));
}

interface ExecStats { skipped: number; failed: number }

// Leak 5 fix: WhatsApp text send via WABA integration (mirrors conversations.ts pattern)
function sendWAText(phoneNumberId: string, token: string, toPhone: string, text: string): Promise<any> {
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
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON from WhatsApp API')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Leak 7 fix: sync a tag name to the tags + lead_tags junction tables so tag-based
// filtering (which queries lead_tags) stays consistent with workflow-written tags.
async function syncTagToJunction(tenantId: string, leadId: string, tagName: string): Promise<void> {
  const tagRow = await query(
    `INSERT INTO tags (tenant_id, name, color) VALUES ($1,$2,'#94a3b8')
     ON CONFLICT (tenant_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
    [tenantId, tagName]
  ).catch(() => null);
  if (tagRow?.rows[0]) {
    await query(
      `INSERT INTO lead_tags (lead_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [leadId, tagRow.rows[0].id]
    ).catch(() => null);
  }
}

async function unsyncTagFromJunction(tenantId: string, leadId: string, tagName: string): Promise<void> {
  await query(
    `DELETE FROM lead_tags WHERE lead_id=$1
     AND tag_id=(SELECT id FROM tags WHERE tenant_id=$2 AND name=$3 LIMIT 1)`,
    [leadId, tenantId, tagName]
  ).catch(() => null);
}

// Returns userId only if it's a valid UUID (safe to insert into UUID columns).
// Callers like public.ts pass 'system' / 'historical' which are not UUIDs.
function uuidOrNull(id: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export async function executeNodes(
  nodes: WFNode[],
  lead: LeadContext,
  tenantId: string,
  userId: string,
  executionId: string,
  workflowId: string
): Promise<ExecStats> {
  const safeUserId = uuidOrNull(userId);
  const stats: ExecStats = { skipped: 0, failed: 0 };
  for (const node of nodes) {
    if (node.type === 'trigger') continue;

    let status = 'completed';
    let message = '';

    try {
      switch (node.actionType) {

        // ── Add / Update to CRM ────────────────────────────────────────────────
        case 'add_to_crm': {
          const sets: string[] = ['updated_at=NOW()'];
          const vals: any[] = [];
          if (node.config.pipeline_id) { vals.push(node.config.pipeline_id); sets.push(`pipeline_id=$${vals.length}`); }
          if (node.config.stage_id)    { vals.push(node.config.stage_id);    sets.push(`stage_id=$${vals.length}`); }
          if (lead.id && sets.length > 1) {
            vals.push(lead.id, tenantId);
            const updateRes = await query(
              `UPDATE leads SET ${sets.join(',')} WHERE id=$${vals.length - 1} AND tenant_id=$${vals.length} RETURNING pipeline_id, stage_id`,
              vals
            );
            const vRow = updateRes.rows[0];
            const stageName = node.config.stage_id
              ? (await query('SELECT name FROM pipeline_stages WHERE id=$1', [node.config.stage_id])).rows[0]?.name ?? ''
              : '';
            if (!vRow) {
              status = 'failed';
              message = 'add_to_crm: lead not found in database';
            } else if (node.config.pipeline_id && vRow.pipeline_id !== node.config.pipeline_id) {
              status = 'failed';
              message = `add_to_crm: lead not placed in configured pipeline after update`;
            } else if (node.config.stage_id && vRow.stage_id !== node.config.stage_id) {
              status = 'failed';
              message = `add_to_crm: lead not placed in configured stage after update`;
            } else {
              message = stageName ? `Added to CRM · ${stageName}` : 'Added to CRM';
              if (node.config.stage_id) {
                const updatedLead2 = (await query('SELECT * FROM leads WHERE id=$1', [lead.id])).rows[0];
                if (updatedLead2) setImmediate(() => triggerWorkflows('stage_changed', { ...updatedLead2, stage_name: stageName }, tenantId, safeUserId ?? userId).catch(() => null));
              }
            }
          } else {
            status = 'skipped';
            message = 'add_to_crm: no pipeline_id or stage_id configured';
          }
          break;
        }

        // ── Change Pipeline Stage ──────────────────────────────────────────────
        case 'change_stage': {
          const stageId = node.config.stage_id as string;
          if (stageId && lead.id) {
            await query(
              `UPDATE leads SET stage_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
              [stageId, lead.id, tenantId]
            );
            const sr = await query('SELECT name FROM pipeline_stages WHERE id=$1', [stageId]);
            const vStage = await query('SELECT stage_id FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
            if (vStage.rows[0]?.stage_id !== stageId) {
              status = 'failed'; message = 'change_stage: stage was not updated on lead';
            } else {
              message = `Moved to ${sr.rows[0]?.name ?? stageId}`;
              const updatedLead = (await query('SELECT * FROM leads WHERE id=$1', [lead.id])).rows[0];
              if (updatedLead) setImmediate(() => triggerWorkflows('stage_changed', { ...updatedLead, stage_name: sr.rows[0]?.name ?? stageId }, tenantId, safeUserId ?? userId).catch(() => null));
            }
          } else {
            status = 'skipped'; message = 'change_stage: no stage_id configured';
          }
          break;
        }

        // ── Assign To Staff ────────────────────────────────────────────────────
        case 'assign_staff': {
          const staffIds: string[] = Array.isArray(node.config.staff_ids)
            ? (node.config.staff_ids as string[])
            : node.config.staff_id ? [node.config.staff_id as string] : [];
          if (staffIds.length > 0 && lead.id) {
            const onlyUnassigned = !!(node.config.unassignedOnly);
            if (onlyUnassigned) {
              const existing = await query('SELECT assigned_to FROM leads WHERE id=$1', [lead.id]);
              if (existing.rows[0]?.assigned_to) { status = 'skipped'; message = 'assign_staff: lead already assigned'; break; }
            }
            // Round-robin: pick based on lead id hash for determinism
            const idx = staffIds.length === 1 ? 0 : Math.abs(lead.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % staffIds.length;
            const staffId = staffIds[idx];
            await query(
              `UPDATE leads SET assigned_to=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
              [staffId, lead.id, tenantId]
            );
            const ur = await query('SELECT name FROM users WHERE id=$1', [staffId]);
            // Verify assignment actually took effect
            const vStaff = await query('SELECT assigned_to FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
            if (vStaff.rows[0]?.assigned_to !== staffId) {
              status = 'failed'; message = `assign_staff: lead was not assigned to ${ur.rows[0]?.name ?? staffId}`;
            } else {
              message = `Assigned: ${ur.rows[0]?.name ?? staffId}`;
            }
          } else {
            status = 'skipped'; message = 'assign_staff: no staff configured';
          }
          break;
        }

        // ── Remove Assigned Staff ──────────────────────────────────────────────
        case 'remove_staff': {
          if (lead.id) {
            await query(
              `UPDATE leads SET assigned_to=NULL, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
              [lead.id, tenantId]
            );
            const vRemove = await query('SELECT assigned_to FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
            if (vRemove.rows[0]?.assigned_to !== null) {
              status = 'failed'; message = 'remove_staff: staff assignment was not cleared';
            } else {
              message = 'Staff unassigned';
            }
          }
          break;
        }

        // ── Add Tag / Tag Contact ──────────────────────────────────────────────
        case 'add_tag':
        case 'tag_contact': {
          const tagList: string[] = Array.isArray(node.config.tags)
            ? (node.config.tags as string[]).filter(Boolean)
            : [(node.config.tag ?? node.config.tagName) as string].filter(Boolean);
          if (tagList.length && lead.id) {
            for (const t of tagList) {
              await query(
                `UPDATE leads SET tags=array_append(tags, $1::text), updated_at=NOW()
                 WHERE id=$2 AND tenant_id=$3 AND NOT ($1=ANY(tags))`,
                [t, lead.id, tenantId]
              );
              await syncTagToJunction(tenantId, lead.id, t);
            }
            // Verify every tag was actually added
            const vTags = await query(
              `SELECT tags FROM leads WHERE id=$1 AND tenant_id=$2`,
              [lead.id, tenantId]
            );
            const actualTags: string[] = vTags.rows[0]?.tags ?? [];
            const missing = tagList.filter((t) => !actualTags.includes(t));
            if (missing.length > 0) {
              status = 'failed';
              message = `add_tag: tag(s) not found on lead after update: ${missing.join(', ')}`;
            } else {
              message = `Tags added: ${tagList.join(', ')}`;
            }
          } else {
            status = 'skipped'; message = 'add_tag: no tags configured';
          }
          break;
        }

        // ── Remove Tag ─────────────────────────────────────────────────────────
        case 'remove_tag': {
          const tagList: string[] = Array.isArray(node.config.tags)
            ? (node.config.tags as string[]).filter(Boolean)
            : [(node.config.tag) as string].filter(Boolean);
          if (tagList.length && lead.id) {
            for (const t of tagList) {
              await query(
                `UPDATE leads SET tags=array_remove(tags, $1::text), updated_at=NOW()
                 WHERE id=$2 AND tenant_id=$3`,
                [t, lead.id, tenantId]
              );
              await unsyncTagFromJunction(tenantId, lead.id, t);
            }
            // Verify all tags were actually removed
            const vRmTags = await query(
              `SELECT tags FROM leads WHERE id=$1 AND tenant_id=$2`,
              [lead.id, tenantId]
            );
            const remainingTags: string[] = vRmTags.rows[0]?.tags ?? [];
            const stillPresent = tagList.filter((t) => remainingTags.includes(t));
            if (stillPresent.length > 0) {
              status = 'failed';
              message = `remove_tag: tag(s) still present on lead after removal: ${stillPresent.join(', ')}`;
            } else {
              message = `Tags removed: ${tagList.join(', ')}`;
            }
          } else {
            status = 'skipped'; message = 'remove_tag: no tag configured';
          }
          break;
        }

        // ── Change Lead Quality ────────────────────────────────────────────────
        case 'change_lead_quality': {
          const quality = node.config.quality as string;
          if (quality && lead.id) {
            await query(
              `UPDATE leads SET custom_fields = COALESCE(custom_fields,'{}')::jsonb || $1::jsonb, updated_at=NOW()
               WHERE id=$2 AND tenant_id=$3`,
              [JSON.stringify({ lead_quality: quality }), lead.id, tenantId]
            );
            const vQuality = await query(
              `SELECT custom_fields->>'lead_quality' AS lq FROM leads WHERE id=$1 AND tenant_id=$2`,
              [lead.id, tenantId]
            );
            if (vQuality.rows[0]?.lq !== quality) {
              status = 'failed'; message = `change_lead_quality: value not set correctly after update`;
            } else {
              message = `Quality: ${quality}`;
            }
          } else {
            status = 'skipped'; message = 'change_lead_quality: no quality configured';
          }
          break;
        }

        // ── Update Contact Attributes ──────────────────────────────────────────
        case 'update_attributes': {
          if (lead.id) {
            const allowed = ['name', 'email', 'phone', 'source'];
            const sets: string[] = ['updated_at=NOW()'];
            const vals: any[] = [];
            for (const field of allowed) {
              if (node.config[field] !== undefined && node.config[field] !== '') {
                vals.push(node.config[field]);
                sets.push(`${field}=$${vals.length}`);
              }
            }
            if (sets.length > 1) {
              vals.push(lead.id, tenantId);
              await query(
                `UPDATE leads SET ${sets.join(',')} WHERE id=$${vals.length - 1} AND tenant_id=$${vals.length}`,
                vals
              );
              // Verify each updated field
              const vAttr = await query('SELECT * FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
              const updatedRow = vAttr.rows[0];
              const failedFields = allowed.filter(
                (f) => node.config[f] !== undefined && node.config[f] !== '' && updatedRow?.[f] !== node.config[f]
              );
              if (failedFields.length > 0) {
                status = 'failed'; message = `update_attributes: fields not updated: ${failedFields.join(', ')}`;
              } else {
                message = `Updated: ${sets.slice(1).map((s) => s.split('=')[0]).join(', ')}`;
              }
            } else {
              status = 'skipped'; message = 'update_attributes: nothing to update';
            }
          }
          break;
        }

        // ── Remove from CRM / Remove Contact ──────────────────────────────────
        case 'remove_from_crm':
        case 'remove_contact': {
          if (lead.id && !lead.id.startsWith('test-')) {
            await query(
              `UPDATE leads SET is_deleted=TRUE, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
              [lead.id, tenantId]
            );
            const vDel = await query('SELECT is_deleted FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
            if (!vDel.rows[0]?.is_deleted) {
              status = 'failed'; message = 'remove_contact: lead was not marked as deleted';
            } else {
              message = 'Lead removed';
            }
          } else if (lead.id?.startsWith('test-')) {
            status = 'skipped';
            message = 'remove_contact: test contact is not a real CRM lead';
          }
          break;
        }

        // ── Add Note ───────────────────────────────────────────────────────────
        case 'create_note': {
          const rawContent = (node.config.noteContent ?? node.config.content ?? node.config.message) as string ?? 'Automated note';
          const content = interpolate(rawContent, lead);
          if (lead.id && !lead.id.startsWith('test-')) {
            const noteRes = await query(
              `INSERT INTO lead_notes (lead_id, tenant_id, title, content, created_by)
               VALUES ($1,$2,$3,$4,$5) RETURNING id`,
              [lead.id, tenantId, 'Workflow Note', content, safeUserId]
            );
            if (!noteRes.rows[0]?.id) {
              status = 'failed'; message = 'create_note: note was not created in database';
            } else {
              message = `Note: ${content.slice(0, 80)}`;
              setImmediate(() => triggerWorkflows('notes_added', lead, tenantId, safeUserId ?? userId).catch(() => null));
            }
          } else {
            status = 'skipped';
            message = lead.id?.startsWith('test-')
              ? 'create_note: test contact is not a real CRM lead — use a contact from CRM to test this action'
              : 'create_note: no lead ID';
          }
          break;
        }

        // ── Create Follow-up ───────────────────────────────────────────────────
        case 'create_followup': {
          const title = (node.config.title ?? 'Workflow Follow-up') as string;
          // Support both due_hours (legacy) and dueDays/dueUnit (editor UI)
          let dueHours = 24;
          if (node.config.due_hours) {
            dueHours = parseInt(node.config.due_hours as string) || 24;
          } else if (node.config.dueDays) {
            const days = parseFloat(node.config.dueDays as string) || 1;
            const unit = (node.config.dueUnit as string) ?? 'days';
            dueHours = unit === 'hours' ? days : days * 24;
          }
          const dueAt = new Date(Date.now() + dueHours * 3600000).toISOString();
          if (lead.id && !lead.id.startsWith('test-')) {
            const rawAssignTo = (node.config.assignTo ?? userId) as string;
            const assignTo = uuidOrNull(rawAssignTo);
            const fuRes = await query(
              `INSERT INTO lead_followups (lead_id, tenant_id, title, description, due_at, assigned_to, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
              [lead.id, tenantId, title, (node.config.notes ?? node.config.description ?? '') as string, dueAt, assignTo, safeUserId]
            );
            if (!fuRes.rows[0]?.id) {
              status = 'failed'; message = 'create_followup: follow-up was not created in database';
            } else {
              message = `Follow-up: "${title}" in ${dueHours}h`;
              setImmediate(() => triggerWorkflows('follow_up', lead, tenantId, safeUserId ?? userId).catch(() => null));
            }
          } else {
            status = 'skipped';
            message = lead.id?.startsWith('test-')
              ? 'create_followup: test contact is not a real CRM lead — use a contact from CRM to test this action'
              : 'create_followup: no lead ID';
          }
          break;
        }

        // ── Internal Notification ──────────────────────────────────────────────
        case 'internal_notify': {
          const msg = interpolate((node.config.message ?? 'Workflow notification') as string, lead);
          const notifTitle = interpolate((node.config.actionName ?? 'Automation Notification') as string, lead);
          const sendTo = (node.config.sendTo ?? 'assigned') as string;

          let recipientIds: string[] = [];
          if (sendTo === 'specific' && node.config.staff_id) {
            recipientIds = [node.config.staff_id as string];
          } else if (sendTo === 'all') {
            const usersRes = await query(
              `SELECT id FROM users WHERE tenant_id=$1 AND is_active=TRUE`, [tenantId]
            );
            recipientIds = usersRes.rows.map((u: any) => u.id);
          } else if (sendTo === 'assigned' && lead.assigned_to) {
            recipientIds = [lead.assigned_to];
          }

          let notifFailed = 0;
          for (const uid of recipientIds) {
            const nRes = await query(
              `INSERT INTO notifications (tenant_id, user_id, title, message, type)
               VALUES ($1,$2,$3,$4,'automation') RETURNING id`,
              [tenantId, uid, notifTitle, msg]
            );
            if (!nRes.rows[0]?.id) notifFailed++;
          }
          if (recipientIds.length === 0) {
            status = 'skipped'; message = `internal_notify: no recipients found (sendTo=${sendTo})`;
          } else if (notifFailed > 0) {
            status = 'failed'; message = `internal_notify: ${notifFailed}/${recipientIds.length} notifications failed to insert`;
          } else {
            message = `Notified: ${recipientIds.length} recipient(s) · ${sendTo}`;
          }
          break;
        }

        // ── Webhook Call ───────────────────────────────────────────────────────
        case 'webhook_call': {
          const url = interpolate(node.config.url as string, lead);
          if (url) {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead, triggeredAt: new Date().toISOString() }),
              signal: AbortSignal.timeout(10000),
            });
            if (!resp.ok) throw new Error(`Webhook ${url} returned ${resp.status}`);
            message = `Webhook called: ${url} → ${resp.status}`;
          } else {
            status = 'skipped'; message = 'webhook_call: no URL configured';
          }
          break;
        }

        // ── Send WhatsApp ──────────────────────────────────────────────────────
        // Leak 5 fix: actually send via WABA integration
        case 'send_whatsapp': {
          const toPhone = lead.phone;
          if (!toPhone) {
            status = 'skipped'; message = 'send_whatsapp: lead has no phone number'; break;
          }
          const wabaRes = await query(
            `SELECT phone_number_id, access_token FROM waba_integrations
             WHERE tenant_id=$1 AND is_active=TRUE LIMIT 1`,
            [tenantId]
          );
          if (!wabaRes.rows[0]) {
            throw new Error('send_whatsapp: WABA integration not configured or inactive — set it up under Integrations → WhatsApp');
          }
          const { phone_number_id, access_token: encToken } = wabaRes.rows[0];
          const waToken = decrypt(encToken);
          const msgText = interpolate(
            (node.config.message ?? node.config.template ?? '') as string, lead
          );
          if (!msgText) {
            status = 'skipped'; message = 'send_whatsapp: no message body configured'; break;
          }
          const waResp = await sendWAText(phone_number_id, waToken, toPhone, msgText);
          if (waResp?.error) {
            throw new Error(`WhatsApp API error (${waResp.error.code}): ${waResp.error.message}`);
          }
          const wamid = waResp?.messages?.[0]?.id ?? '';
          message = `WhatsApp sent to ${toPhone}${wamid ? ` (wamid: ${wamid})` : ''}`;
          break;
        }

        // ── Send Email ─────────────────────────────────────────────────────────
        case 'send_email': {
          const toEmail = interpolate((node.config.to ?? lead.email ?? '') as string, lead);
          const subject = interpolate((node.config.subject ?? 'Message from DigyGo') as string, lead);
          const body    = interpolate((node.config.body ?? node.config.message ?? '') as string, lead);

          if (!toEmail) {
            status = 'skipped'; message = 'send_email: no recipient email address';
          } else if (!isSmtpConfigured()) {
            status = 'skipped'; message = 'send_email: SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS in .env)';
          } else {
            const { messageId } = await sendEmail({
              to:      toEmail,
              subject,
              html:    body.replace(/\n/g, '<br>'),
              text:    body,
            });
            message = `Email sent to ${toEmail} (${messageId})`;
          }
          break;
        }

        // ── Send SMS ───────────────────────────────────────────────────────────
        // Leak 5 fix: fail visibly so the gap shows in execution logs, not as a silent skip
        case 'send_sms': {
          throw new Error('SMS sending not implemented — integrate Twilio/MSG91 and set TWILIO_SID in env');
        }

        // ── Execute Another Automation ─────────────────────────────────────────
        case 'execute_automation': {
          const targetId = node.config.workflow_id as string;
          if (targetId && lead.id) {
            const targetRes = await query(
              `SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2 AND status='active'`,
              [targetId, tenantId]
            );
            if (targetRes.rows[0]) {
              const subNodes: WFNode[] = targetRes.rows[0].nodes ?? [];
              const subStats = await executeNodes(subNodes, lead, tenantId, userId, executionId, targetId);
              stats.skipped += subStats.skipped;
              stats.failed  += subStats.failed;
              message = `Sub-workflow executed: ${targetRes.rows[0].name}`;
            } else {
              status = 'skipped'; message = 'execute_automation: target workflow not found or inactive';
            }
          } else {
            status = 'skipped'; message = 'execute_automation: no workflow_id configured';
          }
          break;
        }

        // ── Remove Workflow (remove contact from this workflow run) ────────────
        case 'remove_workflow': {
          message = 'Contact removed from workflow';
          await logStep(executionId, workflowId, tenantId, node, 'completed', message);
          return stats;
        }

        // ── Exit Workflow ──────────────────────────────────────────────────────
        case 'exit_workflow': {
          message = 'Workflow exited early';
          await logStep(executionId, workflowId, tenantId, node, 'completed', message);
          return stats;
        }

        // ── If / Else Condition ────────────────────────────────────────────────
        case 'if_else': {
          // Support both legacy single-condition and new multi-condition (conditions array)
          interface Condition { field: string; operator: string; value: string }

          const evalOne = (cond: Condition): boolean => {
            // Map frontend CONDITION_FIELDS names → actual lead object keys
            const fieldMap: Record<string, string> = {
              pipeline_stage: 'stage_name',
              assigned_staff: 'assigned_staff_name',
            };
            const resolvedField = fieldMap[cond.field] ?? cond.field;

            // Special case: tag membership check (lead.tags is an array)
            if (cond.field === 'tag') {
              const tagsArr: string[] = Array.isArray((lead as any).tags) ? (lead as any).tags : [];
              const tagVal = (cond.value ?? '').toLowerCase().trim();
              switch ((cond.operator ?? 'equals').replace(/_/g, ' ')) {
                case 'equals':       return tagsArr.some((t) => t.toLowerCase() === tagVal);
                case 'not equals':   return !tagsArr.some((t) => t.toLowerCase() === tagVal);
                case 'contains':     return tagsArr.some((t) => t.toLowerCase().includes(tagVal));
                case 'not contains': return !tagsArr.some((t) => t.toLowerCase().includes(tagVal));
                case 'is empty':     return tagsArr.length === 0;
                case 'is not empty': return tagsArr.length > 0;
                default:             return false;
              }
            }

            // Leak 6 fix: check top-level fields first, then custom_fields by slug
            const rawLeadVal = String(
              (lead as any)[resolvedField] ?? lead.custom_fields?.[cond.field] ?? ''
            );
            const leadVal = rawLeadVal.toLowerCase().trim();
            const val = (cond.value ?? '').toLowerCase().trim();
            switch ((cond.operator ?? 'equals').replace(/_/g, ' ')) {
              case 'equals':       return leadVal === val;
              case 'not equals':   return leadVal !== val;
              case 'contains':     return leadVal.includes(val);
              case 'not contains': return !leadVal.includes(val);
              case 'starts with':  return leadVal.startsWith(val);
              case 'ends with':    return leadVal.endsWith(val);
              case 'is empty':     return leadVal === '';
              case 'is not empty': return leadVal !== '';
              case 'greater than': return parseFloat(rawLeadVal) > parseFloat(val);
              case 'less than':    return parseFloat(rawLeadVal) < parseFloat(val);
              default:             return false;
            }
          };

          let conditionMet: boolean;
          const conditions = node.config.conditions as Condition[] | undefined;
          if (conditions && conditions.length > 0) {
            const logic = (node.config.logic ?? 'AND') as string;
            conditionMet = logic === 'OR'
              ? conditions.some(evalOne)
              : conditions.every(evalOne);
            message = `Condition [${logic} of ${conditions.length}] → ${conditionMet ? 'YES' : 'NO'}`;
          } else {
            // Legacy single-condition
            conditionMet = evalOne({
              field:    (node.config.field    ?? '') as string,
              operator: (node.config.operator ?? 'equals') as string,
              value:    (node.config.value    ?? '') as string,
            });
            message = `Condition [${node.config.field} ${node.config.operator} "${node.config.value}"] → ${conditionMet ? 'YES' : 'NO'}`;
          }

          const branch = conditionMet ? node.branches?.yes : node.branches?.no;
          if (branch?.length) {
            const branchStats = await executeNodes(branch, lead, tenantId, userId, executionId, workflowId);
            stats.skipped += branchStats.skipped;
            stats.failed  += branchStats.failed;
          }
          break;
        }

        // ── Time Delay ─────────────────────────────────────────────────────────
        case 'delay': {
          const amount = parseFloat((node.config.delayAmount ?? node.config.delay_amount ?? '1') as string) || 1;
          const unit   = (node.config.delayUnit ?? node.config.delay_unit ?? 'hours') as string;
          let ms = amount * 3_600_000; // default hours
          if (unit === 'minutes') ms = amount * 60_000;
          if (unit === 'days')    ms = amount * 86_400_000;
          const runAt = new Date(Date.now() + ms).toISOString();

          // Find remaining nodes after this delay node
          const nodeIdx = nodes.indexOf(node);
          const remaining = nodes.slice(nodeIdx + 1);

          if (remaining.length > 0) {
            await query(
              `INSERT INTO scheduled_workflow_steps
                 (workflow_id, execution_id, tenant_id, lead_data, remaining_nodes, run_at)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [workflowId, executionId, tenantId, JSON.stringify(lead), JSON.stringify(remaining), runAt]
            );
            message = `Delay scheduled: ${amount} ${unit} — ${remaining.length} step(s) queued for ${runAt}`;
          } else {
            message = `Delay of ${amount} ${unit} (no further steps after delay)`;
          }
          // Stop processing remaining nodes inline — the worker will resume
          await logStep(executionId, workflowId, tenantId, node, 'completed', message);
          return stats;
        }

        // ── API Request (configurable HTTP method, headers, body) ─────────────
        case 'api_call': {
          const url    = interpolate((node.config.url    ?? '') as string, lead);
          const method = ((node.config.method ?? 'GET') as string).toUpperCase();

          if (!url) { status = 'skipped'; message = 'api_call: no URL configured'; break; }

          let headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (node.config.headers) {
            try { headers = { ...headers, ...JSON.parse(interpolate(node.config.headers as string, lead)) }; }
            catch { /* ignore malformed headers JSON */ }
          }

          const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
          let bodyStr: string | undefined;
          if (hasBody) {
            const rawBody = (node.config.body ?? node.config.payload ?? '') as string;
            bodyStr = rawBody ? interpolate(rawBody, lead) : JSON.stringify({ lead, triggeredAt: new Date().toISOString() });
          }

          const resp = await fetch(url, {
            method,
            headers,
            body: bodyStr,
            signal: AbortSignal.timeout(15000),
          });

          let responseText = '';
          try { responseText = await resp.text(); } catch { /* ignore */ }
          if (!resp.ok) throw new Error(`API request ${method} ${url} returned ${resp.status}: ${responseText.slice(0, 200)}`);
          message = `API ${method} ${url} → ${resp.status}`;

          if (node.config.saveResponse && lead.id) {
            const truncated = responseText.slice(0, 2000);
            await query(
              `UPDATE leads SET custom_fields = COALESCE(custom_fields,'{}')::jsonb || $1::jsonb, updated_at=NOW()
               WHERE id=$2 AND tenant_id=$3`,
              [JSON.stringify({ last_api_response: truncated }), lead.id, tenantId]
            );
          }
          break;
        }

        // ── Change Appointment Status ──────────────────────────────────────────
        case 'change_appointment': {
          const apptStatus = (node.config.status ?? node.config.appointmentStatus ?? '') as string;
          if (!apptStatus) { status = 'skipped'; message = 'change_appointment: no status configured'; break; }

          const statusMap: Record<string, string> = {
            'Booked':      'booked',
            'Cancelled':   'cancelled',
            'Completed':   'completed',
            'No Show':     'noshow',
            'Rescheduled': 'rescheduled',
          };
          const dbStatus = statusMap[apptStatus] ?? apptStatus.toLowerCase();

          if (lead.id) {
            const apptRes = await query(
              `SELECT id FROM calendar_events WHERE lead_id=$1 AND tenant_id=$2 ORDER BY start_time DESC LIMIT 1`,
              [lead.id, tenantId]
            );
            if (apptRes.rows[0]) {
              await query(
                `UPDATE calendar_events SET status=$1, updated_at=NOW() WHERE id=$2`,
                [dbStatus, apptRes.rows[0].id]
              );
              const vAppt = await query('SELECT status FROM calendar_events WHERE id=$1', [apptRes.rows[0].id]);
              if (vAppt.rows[0]?.status !== dbStatus) {
                status = 'failed'; message = `change_appointment: status not updated (got ${vAppt.rows[0]?.status})`;
              } else {
                message = `Appointment: ${dbStatus}`;
              }
            } else {
              status = 'skipped'; message = 'change_appointment: no appointment found for this lead';
            }
          } else {
            status = 'skipped'; message = 'change_appointment: no lead ID';
          }
          break;
        }

        // ── Contact Group (add/remove/move via tags) ───────────────────────────
        case 'contact_group': {
          const groupAction  = (node.config.groupAction  ?? 'add') as string;
          const groupName    = interpolate((node.config.targetList ?? node.config.group ?? '') as string, lead);
          if (!groupName)  { status = 'skipped'; message = 'contact_group: no list/group name configured'; break; }
          if (!lead.id)    { status = 'skipped'; message = 'contact_group: no lead ID'; break; }

          // Represent groups as tags with a "group:" prefix
          const groupTag = `group:${groupName}`;

          if (groupAction === 'remove') {
            await query(
              `UPDATE leads SET tags=array_remove(tags, $1::text), updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
              [groupTag, lead.id, tenantId]
            );
            const vGrpRm = await query('SELECT tags FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
            if ((vGrpRm.rows[0]?.tags ?? []).includes(groupTag)) {
              status = 'failed'; message = `contact_group: tag "${groupTag}" still present after remove`;
            } else {
              message = `Removed from group: ${groupName}`;
            }
          } else if (groupAction === 'move') {
            await query(
              `UPDATE leads SET
                 tags = array_append(
                   array(SELECT unnest(tags) WHERE unnest NOT LIKE 'group:%'),
                   $1::text
                 ),
                 updated_at=NOW()
               WHERE id=$2 AND tenant_id=$3`,
              [groupTag, lead.id, tenantId]
            );
            const vGrpMv = await query('SELECT tags FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
            if (!(vGrpMv.rows[0]?.tags ?? []).includes(groupTag)) {
              status = 'failed'; message = `contact_group: tag "${groupTag}" not found after move`;
            } else {
              message = `Moved to group: ${groupName}`;
            }
          } else {
            // add
            await query(
              `UPDATE leads SET tags=array_append(tags, $1::text), updated_at=NOW()
               WHERE id=$2 AND tenant_id=$3 AND NOT ($1=ANY(tags))`,
              [groupTag, lead.id, tenantId]
            );
            const vGrpAdd = await query('SELECT tags FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
            if (!(vGrpAdd.rows[0]?.tags ?? []).includes(groupTag)) {
              status = 'failed'; message = `contact_group: tag "${groupTag}" not found after add`;
            } else {
              message = `Added to group: ${groupName}`;
            }
          }
          break;
        }

        // ── Contact Group Access ───────────────────────────────────────────────
        case 'contact_group_access': {
          const group = interpolate((node.config.group ?? '') as string, lead);
          if (!group || !lead.id) { status = 'skipped'; message = 'contact_group_access: no group or lead ID'; break; }
          const accessTag = `access:${group}`;
          await query(
            `UPDATE leads SET tags=array_append(tags, $1::text), updated_at=NOW()
             WHERE id=$2 AND tenant_id=$3 AND NOT ($1=ANY(tags))`,
            [accessTag, lead.id, tenantId]
          );
          const vAccess = await query('SELECT tags FROM leads WHERE id=$1 AND tenant_id=$2', [lead.id, tenantId]);
          if (!(vAccess.rows[0]?.tags ?? []).includes(accessTag)) {
            status = 'failed'; message = `contact_group_access: access tag "${accessTag}" not found after update`;
          } else {
            message = `Access granted: ${group}`;
          }
          break;
        }

        // ── Assign To AI Agent ─────────────────────────────────────────────────
        case 'assign_ai': {
          const agentId = (node.config.agentId ?? node.config.agent ?? '') as string;
          if (!agentId) { status = 'skipped'; message = 'assign_ai: no AI agent configured'; break; }
          if (lead.id) {
            await query(
              `UPDATE leads SET custom_fields = COALESCE(custom_fields,'{}')::jsonb || $1::jsonb, updated_at=NOW()
               WHERE id=$2 AND tenant_id=$3`,
              [JSON.stringify({ ai_agent_id: agentId, ai_assigned_at: new Date().toISOString() }), lead.id, tenantId]
            );
            message = `AI agent assigned: ${agentId} (stored in custom_fields.ai_agent_id)`;
          }
          break;
        }

        // ── Event Start Time (informational, marks contact as event-aware) ─────
        case 'event_start_time': {
          const eventTime = (node.config.eventTime ?? '') as string;
          if (lead.id) {
            await query(
              `UPDATE leads SET custom_fields = COALESCE(custom_fields,'{}')::jsonb || $1::jsonb, updated_at=NOW()
               WHERE id=$2 AND tenant_id=$3`,
              [JSON.stringify({ event_start_time: eventTime || new Date().toISOString() }), lead.id, tenantId]
            );
            message = `Event start time recorded: ${eventTime || 'now'}`;
          } else {
            status = 'skipped'; message = 'event_start_time: no lead ID';
          }
          break;
        }

        // ── Instagram DM (requires Meta API — not yet implemented) ───────────
        // Leak 5 fix: throw so execution shows as 'failed', not silently 'skipped'
        case 'post_instagram': {
          throw new Error('Instagram DM not implemented — wire Meta Messenger API to enable this action');
        }

        // ── Facebook Comment Reply (requires Meta API — not yet implemented) ──
        case 'facebook_post': {
          throw new Error('Facebook comment reply not implemented — wire Meta Graph API to enable this action');
        }

        default: {
          status = 'skipped';
          message = `Action "${node.actionType}" is not implemented yet`;
        }
      }
    } catch (err: any) {
      status = 'failed';
      message = err.message ?? 'Execution error';
    }

    if (status === 'skipped') stats.skipped++;
    if (status === 'failed') stats.failed++;
    await logStep(executionId, workflowId, tenantId, node, status, message);

    // Mirror key automation actions to lead_activities so they appear in the Activity Timeline
    if (status === 'completed' && lead.id && !lead.id.startsWith('test-')) {
      let actType: string | null = null;
      let actTitle = '';
      let actDetail: string | null = null;
      if (node.actionType === 'change_stage') {
        actType = 'stage_change';
        actTitle = message; // "Stage changed and verified: Stage Name"
      } else if (node.actionType === 'add_to_crm') {
        actType = 'stage_change';
        actTitle = message;
      } else if (node.actionType === 'assign_staff') {
        actType = 'assigned';
        actTitle = message; // "Assigned and verified: Staff Name"
      } else if (node.actionType === 'add_tag' || node.actionType === 'tag_contact') {
        actType = 'tag_added';
        actTitle = message; // "Tags added and verified: tag1, tag2"
      } else if (node.actionType === 'create_note') {
        actType = 'note';
        actTitle = 'Workflow note added';
        actDetail = message.replace('Note: ', '');
      } else if (node.actionType === 'create_followup') {
        actType = 'followup';
        actTitle = message;
      }
      if (actType) {
        await query(
          `INSERT INTO lead_activities (lead_id, tenant_id, type, title, detail, created_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [lead.id, tenantId, actType, actTitle, actDetail, safeUserId]
        ).catch(() => null);
      }
    }
  }
  return stats;
}

// ── Enrich lead context with names for variable substitution ─────────────────

export async function enrichLead(lead: LeadContext): Promise<LeadContext> {
  const enriched = { ...lead };
  // Fetch full lead row when only id is available (e.g., notes_added / follow_up triggers)
  if (lead.id && !lead.name) {
    const r = await query(
      `SELECT name, email, phone, stage_id, pipeline_id, assigned_to, tags, source, meta_form_id
       FROM leads WHERE id=$1 AND is_deleted=FALSE LIMIT 1`,
      [lead.id]
    ).catch(() => ({ rows: [] }));
    if (r.rows[0]) {
      Object.assign(enriched, r.rows[0]);
      if (r.rows[0].meta_form_id && !enriched.form_id) enriched.form_id = r.rows[0].meta_form_id;
    }
  }
  // Always back-fill form_id from meta_form_id if still missing
  if (!enriched.form_id && (enriched as any).meta_form_id) {
    enriched.form_id = (enriched as any).meta_form_id;
  }
  if (lead.assigned_to && !lead.assigned_staff_name) {
    const r = await query('SELECT name FROM users WHERE id=$1', [lead.assigned_to]);
    enriched.assigned_staff_name = r.rows[0]?.name ?? '';
  }
  if (lead.pipeline_id && !lead.pipeline_name) {
    const r = await query('SELECT name FROM pipelines WHERE id=$1', [lead.pipeline_id]);
    enriched.pipeline_name = r.rows[0]?.name ?? '';
  }
  if (lead.stage_id && !lead.stage_name) {
    const r = await query('SELECT name FROM pipeline_stages WHERE id=$1', [lead.stage_id]);
    enriched.stage_name = r.rows[0]?.name ?? '';
  }
  // Leak 6 fix: fetch custom field values so if_else conditions can evaluate them
  if (lead.id) {
    const cfRes = await query(
      `SELECT cf.slug, lfv.value
       FROM lead_field_values lfv
       JOIN custom_fields cf ON cf.id = lfv.field_id
       WHERE lfv.lead_id = $1`,
      [lead.id]
    ).catch(() => ({ rows: [] }));
    enriched.custom_fields = {};
    for (const row of cfRes.rows) {
      enriched.custom_fields[row.slug] = row.value;
    }
  }
  return enriched;
}

// ── Public trigger entry point ────────────────────────────────────────────────

export async function triggerWorkflows(
  triggerType: string,
  lead: LeadContext,
  tenantId: string,
  userId: string
): Promise<void> {
  try {
    const enrichedLead = await enrichLead(lead);

    // Exact match only — each trigger type fires only its own workflows.
    // No cross-matching between meta_form, opt_in_form, lead_created etc.
    const matchingKeys = [triggerType];

    const formId   = enrichedLead.form_id   ?? '';
    const formName = enrichedLead.form_name ?? '';

    // Targeted query — only fetch workflows whose trigger matches AND whose form
    // filter either (a) is empty/not set (fires for any form) or (b) includes
    // the submitted form's ID or name.
    // For non-form triggers (lead_created, stage_changed, etc.) the trigger_forms
    // filter is irrelevant and must be bypassed so stale form configs don't block them.
    // product_enquired also requires a form to be configured — blank = inactive
    const isFormTrigger = triggerType === 'opt_in_form' || triggerType === 'meta_form' || triggerType === 'product_enquired';
    const result = await query(
      `SELECT * FROM workflows
       WHERE tenant_id = $1
         AND status    = 'active'
         AND trigger_key = ANY($2::text[])
         AND (
           -- Non-form triggers ignore the form filter entirely
           $5 = false
           -- Form triggers: must have at least one form configured AND it must match
           -- Blank trigger_forms = workflow is effectively inactive — never fires
           OR ($5 = true AND ($3 = ANY(trigger_forms) OR $4 = ANY(trigger_forms)))
         )`,
      [tenantId, matchingKeys, formId, formName, isFormTrigger]
    );

    console.log(`[WF] trigger="${triggerType}" form="${formName || formId || '-'}" → ${result.rows.length} matching workflow(s)`);
    for (const wf of result.rows) {
      // Trigger/form matching is already done by the SQL query above.
      // Only keep the lightweight per-lead filters that can't be expressed in SQL
      // (pipeline/stage/source/tag on the lead itself, not the workflow config).
      const nodes: WFNode[] = Array.isArray(wf.nodes) ? wf.nodes : (typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : []);
      const triggerNode = nodes.find((n: WFNode) => n.type === 'trigger');
      if (!triggerNode) continue;

      // ── max_contacts cap ──────────────────────────────────────────────────
      if (wf.max_contacts && (wf.total_contacts ?? 0) >= wf.max_contacts) continue;

      // ── Trigger condition filtering (lead-level, not form-level) ─────────
      if (triggerType === 'stage_changed') {
        const cfgPipeline = triggerNode.config?.pipeline_id as string;
        const cfgStage    = triggerNode.config?.stage_id    as string;
        if (cfgPipeline && cfgPipeline !== enrichedLead.pipeline_id) continue;
        if (cfgStage    && cfgStage    !== enrichedLead.stage_id)    continue;
      }
      if (triggerType === 'lead_created') {
        const cfgPipeline = triggerNode.config?.pipeline_id as string;
        const cfgStage    = triggerNode.config?.stage_id    as string;
        if (cfgPipeline && cfgPipeline !== enrichedLead.pipeline_id) continue;
        if (cfgStage    && cfgStage    !== enrichedLead.stage_id)    continue;
      }

      // Calendar form submitted — must select at least one calendar; blank = don't fire
      if (triggerType === 'calendar_form_submitted') {
        const cfgCalendars = (triggerNode.config?.calendars as string[]) ?? [];
        if (cfgCalendars.length === 0 || !cfgCalendars.includes(enrichedLead.event_type_id ?? '')) continue;
      }

      // ── allowReentry check ────────────────────────────────────────────────
      if (!wf.allow_reentry) {
        const existing = await query(
          `SELECT id FROM workflow_executions WHERE workflow_id=$1 AND lead_id=$2 LIMIT 1`,
          [wf.id, enrichedLead.id]
        );
        if (existing.rows.length > 0) {
          console.log(`[WF] "${wf.name}" skipped — lead already enrolled & allow_reentry=false`);
          const skipExec = await query(
            `INSERT INTO workflow_executions
               (workflow_id, tenant_id, lead_id, lead_name, trigger_type, status, enrolled_at, completed_at)
             VALUES ($1,$2,$3,$4,$5,'skipped',NOW(),NOW()) RETURNING id`,
            [wf.id, tenantId, enrichedLead.id, enrichedLead.name, triggerType]
          ).catch(() => null);
          if (skipExec?.rows[0]) {
            await query(
              `INSERT INTO workflow_execution_logs
                 (execution_id, workflow_id, tenant_id, node_id, action_type, status, message)
               VALUES ($1,$2,$3,'reentry_blocked','reentry_blocked','skipped',
                       'Reentry blocked — contact already enrolled (allow_reentry=false)')`,
              [skipExec.rows[0].id, wf.id, tenantId]
            ).catch(() => null);
            await query(
              `UPDATE workflows SET skipped=skipped+1, updated_at=NOW() WHERE id=$1`,
              [wf.id]
            ).catch(() => null);
          }
          continue;
        }
      }

      // ── Goal: auto-exit if already met ───────────────────────────────────
      if (wf.goal_trigger && wf.goal_field && wf.goal_operator) {
        const goalMet = (() => {
          const raw = String((enrichedLead as any)[wf.goal_field] ?? '');
          const val = (wf.goal_value ?? '').toLowerCase();
          const lead_val = raw.toLowerCase();
          switch (wf.goal_operator) {
            case 'equals':     return lead_val === val;
            case 'not_equals': return lead_val !== val;
            case 'contains':   return lead_val.includes(val);
            case 'is_empty':   return lead_val === '';
            default:           return false;
          }
        })();
        if (goalMet) continue;
      }

      // ── Create execution record ───────────────────────────────────────────
      let execResult: any;
      try {
        execResult = await query(
          `INSERT INTO workflow_executions
             (workflow_id, tenant_id, lead_id, lead_name, trigger_type, status, enrolled_at)
           VALUES ($1,$2,$3,$4,$5,'running',NOW()) RETURNING id`,
          [wf.id, tenantId, enrichedLead.id, enrichedLead.name, triggerType]
        );
      } catch (insertErr: any) {
        if (insertErr.code === '23505') {
          // Unique constraint hit — concurrent duplicate trigger, treat as reentry blocked
          console.log(`[WF] "${wf.name}" blocked by DB guard — concurrent duplicate trigger for lead ${enrichedLead.id}`);
          await query(
            `INSERT INTO workflow_executions
               (workflow_id, tenant_id, lead_id, lead_name, trigger_type, status, enrolled_at, completed_at)
             VALUES ($1,$2,$3,$4,$5,'skipped',NOW(),NOW())`,
            [wf.id, tenantId, enrichedLead.id, enrichedLead.name, triggerType]
          ).catch(() => null);
          await query(`UPDATE workflows SET skipped=skipped+1, updated_at=NOW() WHERE id=$1`, [wf.id]).catch(() => null);
          continue;
        }
        throw insertErr;
      }
      const executionId = execResult.rows[0].id;

      try {
        const stats = await executeNodes(nodes, enrichedLead, tenantId, userId, executionId, wf.id);
        const execStatus = stats.failed > 0 ? 'completed_with_errors' : 'completed';
        await query(
          `UPDATE workflow_executions SET status=$1, completed_at=NOW() WHERE id=$2`,
          [execStatus, executionId]
        );
        await query(
          `UPDATE workflows SET total_contacts=total_contacts+1,
           completed=completed+$2, completed_with_errors=completed_with_errors+$3,
           skipped=skipped+$4, failed=failed+$5, updated_at=NOW() WHERE id=$1`,
          [wf.id, stats.failed === 0 ? 1 : 0, stats.failed > 0 ? 1 : 0, stats.skipped, stats.failed]
        );
      } catch (err: any) {
        await query(
          `UPDATE workflow_executions SET status='failed', completed_at=NOW(), error=$1 WHERE id=$2`,
          [err.message ?? 'Unknown error', executionId]
        );
        await query(
          `UPDATE workflows SET total_contacts=total_contacts+1, failed=failed+1, updated_at=NOW() WHERE id=$1`,
          [wf.id]
        );
      }
    }
  } catch (err) {
    console.error('[Workflow Engine] Error:', err);
  }
}

// ── Analytics endpoint (Task #11) ─────────────────────────────────────────────

router.get('/:id/analytics', async (req: AuthRequest, res: Response) => {
  try {
    // Use safe column access — skipped/failed added in migration_013
    const wfRes = await query(
      `SELECT id, name, total_contacts, completed,
              COALESCE((SELECT column_name FROM information_schema.columns
                WHERE table_name='workflows' AND column_name='failed' LIMIT 1), NULL) AS _chk,
              total_contacts, completed, status, created_at
       FROM workflows WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user!.tenantId]
    ).catch(() => query(
      `SELECT id, name, total_contacts, completed, status, created_at
       FROM workflows WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user!.tenantId]
    ));
    if (!wfRes.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

    // Re-query with safe fallback for missing columns
    const wfFull = await query(
      `SELECT id, name, status, created_at,
              total_contacts,
              completed,
              COALESCE(failed,  0) AS failed,
              COALESCE(skipped, 0) AS skipped
       FROM workflows WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user!.tenantId]
    ).catch(async () => {
      // migration_013 not yet applied — return zeros
      const r = await query(
        `SELECT id, name, status, created_at, total_contacts, completed FROM workflows WHERE id=$1 AND tenant_id=$2`,
        [req.params.id, req.user!.tenantId]
      );
      r.rows[0] = { ...r.rows[0], failed: 0, skipped: 0 };
      return r;
    });
    const wf = wfFull.rows[0];

    // Execution breakdown by day (last 30 days)
    const dailyRes = await query(
      `SELECT DATE_TRUNC('day', enrolled_at) AS day,
              COUNT(*) FILTER (WHERE status='completed') AS completed,
              COUNT(*) FILTER (WHERE status='failed')    AS failed,
              COUNT(*) AS total
       FROM workflow_executions
       WHERE workflow_id=$1 AND enrolled_at > NOW() - INTERVAL '30 days'
       GROUP BY 1 ORDER BY 1`,
      [req.params.id]
    ).catch(() => ({ rows: [] }));

    // Top action step completion rates (join through workflow_executions for safety)
    const stepRes = await query(
      `SELECT l.action_type,
              COUNT(*) FILTER (WHERE l.status='completed') AS completed,
              COUNT(*) FILTER (WHERE l.status='skipped')   AS skipped,
              COUNT(*) FILTER (WHERE l.status='failed')    AS failed,
              COUNT(*) AS total
       FROM workflow_execution_logs l
       JOIN workflow_executions e ON e.id = l.execution_id
       WHERE e.workflow_id=$1
       GROUP BY l.action_type ORDER BY total DESC LIMIT 20`,
      [req.params.id]
    ).catch(() => ({ rows: [] }));

    // Recent executions
    const recentRes = await query(
      `SELECT id, lead_name, trigger_type, status, enrolled_at, completed_at
       FROM workflow_executions
       WHERE workflow_id=$1
       ORDER BY enrolled_at DESC LIMIT 50`,
      [req.params.id]
    ).catch(() => ({ rows: [] }));

    res.json({
      workflow:   wf,
      daily:      dailyRes.rows,
      steps:      stepRes.rows,
      recent:     recentRes.rows,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Workflow versions (Task #12) ──────────────────────────────────────────────

router.get('/:id/versions', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, version, name, saved_by, created_at FROM workflow_versions
       WHERE workflow_id=$1 AND tenant_id=$2 ORDER BY version DESC LIMIT 30`,
      [req.params.id, req.user!.tenantId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id/versions/:vId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM workflow_versions WHERE id=$1 AND workflow_id=$2 AND tenant_id=$3`,
      [req.params.vId, req.params.id, req.user!.tenantId]
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Snapshot a version when workflow is saved (called by PATCH /:id via middleware)
async function snapshotVersion(workflowId: string, tenantId: string, name: string, nodes: any[], userId: string) {
  const lastVer = await query(
    `SELECT COALESCE(MAX(version), 0) AS v FROM workflow_versions WHERE workflow_id=$1`,
    [workflowId]
  );
  const nextVer = (lastVer.rows[0]?.v ?? 0) + 1;
  await query(
    `INSERT INTO workflow_versions (workflow_id, tenant_id, version, name, nodes, saved_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [workflowId, tenantId, nextVer, name, JSON.stringify(nodes), userId]
  );
}

// Override PATCH to also snapshot
router.patch('/:id/snapshot', checkPermission('automation:manage'), async (req: AuthRequest, res: Response) => {
  const { name, nodes } = req.body;
  if (!nodes) { res.status(400).json({ error: 'nodes required' }); return; }
  try {
    await snapshotVersion(req.params.id, req.user!.tenantId!, name ?? 'Untitled', nodes, req.user!.userId!);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Test a specific workflow against a contact ────────────────────────────────
// POST /api/workflows/:id/test
router.post('/:id/test', checkPermission('automation:manage'), async (req: AuthRequest, res: Response) => {
  const { tenantId, userId } = req.user!;
  const { lead_id, phone, name } = req.body as { lead_id?: string; phone?: string; name?: string };

  try {
    // Fetch the workflow (doesn't need to be active for testing)
    const wfRes = await query(
      `SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, tenantId]
    );
    if (!wfRes.rows[0]) { res.status(404).json({ error: 'Workflow not found' }); return; }
    const wf = wfRes.rows[0];
    const nodes: WFNode[] = Array.isArray(wf.nodes) ? wf.nodes : (typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : []);

    let lead: LeadContext;

    if (lead_id) {
      const leadRes = await query(
        `SELECT l.id, l.name, l.email, l.phone, l.stage_id, l.pipeline_id, l.assigned_to, l.tags, l.source, l.status,
                ps.name AS stage_name, p.name AS pipeline_name, u.name AS assigned_staff_name
         FROM leads l
         LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
         LEFT JOIN pipelines p ON p.id = l.pipeline_id
         LEFT JOIN users u ON u.id = l.assigned_to
         WHERE l.id=$1 AND l.tenant_id=$2 AND l.is_deleted=FALSE`,
        [lead_id, tenantId]
      );
      if (!leadRes.rows[0]) { res.status(404).json({ error: 'Lead not found' }); return; }
      lead = leadRes.rows[0] as LeadContext;
    } else if (phone) {
      // Build a minimal test lead from phone number
      const existing = await query(
        `SELECT l.id, l.name, l.email, l.phone, l.stage_id, l.pipeline_id, l.assigned_to, l.tags, l.source, l.status,
                ps.name AS stage_name, p.name AS pipeline_name, u.name AS assigned_staff_name
         FROM leads l
         LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
         LEFT JOIN pipelines p ON p.id = l.pipeline_id
         LEFT JOIN users u ON u.id = l.assigned_to
         WHERE l.phone=$1 AND l.tenant_id=$2 AND l.is_deleted=FALSE LIMIT 1`,
        [phone, tenantId]
      );
      if (existing.rows[0]) {
        lead = existing.rows[0] as LeadContext;
      } else {
        lead = { id: `test-${Date.now()}`, name: name || phone, phone };
      }
    } else if (name) {
      // Re-execute for a test run that had no real lead — rebuild a minimal context
      lead = { id: `test-${Date.now()}`, name };
    } else {
      res.status(400).json({ error: 'Provide lead_id, phone, or name' }); return;
    }

    const enrichedLead = await enrichLead(lead);

    // Create a test execution record
    const execResult = await query(
      `INSERT INTO workflow_executions
         (workflow_id, tenant_id, lead_id, lead_name, trigger_type, status, enrolled_at)
       VALUES ($1,$2,$3,$4,'test','running',NOW()) RETURNING id`,
      [wf.id, tenantId, enrichedLead.id?.startsWith('test-') ? null : enrichedLead.id, enrichedLead.name]
    );
    const executionId = execResult.rows[0].id;

    try {
      const stats = await executeNodes(nodes, enrichedLead, tenantId!, userId!, executionId, wf.id);
      const tExecStatus = stats.failed > 0 ? 'completed_with_errors' : 'completed';
      await query(
        `UPDATE workflow_executions SET status=$1, completed_at=NOW() WHERE id=$2`,
        [tExecStatus, executionId]
      );
      // Increment workflow-level counters so row badges reflect test runs
      await query(
        `UPDATE workflows SET total_contacts=total_contacts+1,
         completed=completed+$2, completed_with_errors=completed_with_errors+$3,
         skipped=skipped+$4, failed=failed+$5, updated_at=NOW() WHERE id=$1`,
        [wf.id, stats.failed === 0 ? 1 : 0, stats.failed > 0 ? 1 : 0, stats.skipped, stats.failed]
      ).catch(() => null);
      // Fetch per-node results from execution logs
      const logsRes = await query(
        `SELECT node_id, status, message FROM workflow_execution_logs WHERE execution_id=$1`,
        [executionId]
      );
      const nodeResults: Record<string, { status: string; message: string }> = {};
      for (const row of logsRes.rows) {
        nodeResults[row.node_id] = { status: row.status, message: row.message ?? '' };
      }
      res.json({
        success: true,
        message: stats.failed > 0 ? `${stats.failed} action(s) failed` : 'All actions completed',
        executionId, stats, nodeResults,
      });
    } catch (err: any) {
      await query(
        `UPDATE workflow_executions SET status='failed', completed_at=NOW(), error=$1 WHERE id=$2`,
        [err.message ?? 'Unknown error', executionId]
      );
      // Increment failed counter so badge updates
      await query(
        `UPDATE workflows SET total_contacts=total_contacts+1, failed=failed+1, updated_at=NOW() WHERE id=$1`,
        [wf.id]
      ).catch(() => null);
      // Still try to return partial node results
      const logsRes = await query(
        `SELECT node_id, status, message FROM workflow_execution_logs WHERE execution_id=$1`,
        [executionId]
      ).catch(() => ({ rows: [] }));
      const nodeResults: Record<string, { status: string; message: string }> = {};
      for (const row of logsRes.rows) {
        nodeResults[row.node_id] = { status: row.status, message: row.message ?? '' };
      }
      res.status(500).json({ error: err.message ?? 'Workflow execution failed', executionId, nodeResults });
    }
  } catch (err) {
    console.error('[Test Workflow]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Manually push a list of contacts into a workflow ──────────────────────────
// POST /api/workflows/:id/bulk-trigger  { lead_ids: string[] }
router.post('/:id/bulk-trigger', checkPermission('automation:manage'), async (req: AuthRequest, res: Response) => {
  const { tenantId, userId } = req.user!;
  const { lead_ids, force } = req.body as { lead_ids?: string[]; force?: boolean };

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    res.status(400).json({ error: 'lead_ids array required' }); return;
  }

  try {
    const wfRes = await query(
      `SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, tenantId]
    );
    if (!wfRes.rows[0]) { res.status(404).json({ error: 'Workflow not found' }); return; }
    const wf = wfRes.rows[0];
    const nodes: WFNode[] = Array.isArray(wf.nodes) ? wf.nodes : JSON.parse(wf.nodes ?? '[]');

    // Respond immediately — execution runs in background
    res.json({ queued: lead_ids.length, workflow: wf.name });

    for (const leadId of lead_ids) {
      setImmediate(async () => {
        try {
          // Check allow_reentry (bypassed when force=true, e.g. manual retry of skipped)
          if (!force && !wf.allow_reentry) {
            const ex = await query(
              `SELECT id FROM workflow_executions WHERE workflow_id=$1 AND lead_id=$2 LIMIT 1`,
              [wf.id, leadId]
            );
            if (ex.rows.length > 0) return;
          }

          const leadRes = await query(
            `SELECT l.*, ps.name AS stage_name, p.name AS pipeline_name, u.name AS assigned_staff_name
             FROM leads l
             LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
             LEFT JOIN pipelines p ON p.id = l.pipeline_id
             LEFT JOIN users u ON u.id = l.assigned_to
             WHERE l.id=$1 AND l.tenant_id=$2 AND l.is_deleted=FALSE`,
            [leadId, tenantId]
          );
          if (!leadRes.rows[0]) return;
          const enrichedLead = await enrichLead(leadRes.rows[0] as LeadContext);

          const execRes = await query(
            `INSERT INTO workflow_executions
               (workflow_id, tenant_id, lead_id, lead_name, trigger_type, status, enrolled_at)
             VALUES ($1,$2,$3,$4,'manual','running',NOW()) RETURNING id`,
            [wf.id, tenantId, leadId, enrichedLead.name]
          );
          const executionId = execRes.rows[0].id;

          try {
            const stats = await executeNodes(nodes, enrichedLead, tenantId!, userId!, executionId, wf.id);
            const bExecStatus = stats.failed > 0 ? 'completed_with_errors' : 'completed';
            await query(`UPDATE workflow_executions SET status=$1, completed_at=NOW() WHERE id=$2`, [bExecStatus, executionId]);
            await query(
              `UPDATE workflows SET total_contacts=total_contacts+1, completed=completed+$2, completed_with_errors=completed_with_errors+$3, skipped=skipped+$4, failed=failed+$5, updated_at=NOW() WHERE id=$1`,
              [wf.id, stats.failed === 0 ? 1 : 0, stats.failed > 0 ? 1 : 0, stats.skipped, stats.failed]
            ).catch(() => null);
          } catch (err: any) {
            await query(
              `UPDATE workflow_executions SET status='failed', completed_at=NOW(), error=$1 WHERE id=$2`,
              [err.message ?? 'Unknown', executionId]
            ).catch(() => null);
            await query(
              `UPDATE workflows SET total_contacts=total_contacts+1, failed=failed+1, updated_at=NOW() WHERE id=$1`,
              [wf.id]
            ).catch(() => null);
          }
        } catch (e: any) {
          console.error('[bulk-trigger] lead', leadId, e.message);
        }
      });
    }
  } catch (err) {
    console.error('[bulk-trigger]', err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// ── Inbound webhook trigger (Task #5) ─────────────────────────────────────────
// POST /api/workflows/trigger/:tenantId (public, no auth)

export const publicWorkflowRouter: RouterType = Router();

publicWorkflowRouter.post('/trigger/:tenantId', async (req: any, res: any) => {
  const { tenantId } = req.params;
  const { lead_id, event, data } = req.body;
  if (!lead_id || !event) { res.status(400).json({ error: 'lead_id and event required' }); return; }

  try {
    const leadRes = await query(
      `SELECT id, name, email, phone, stage_id, pipeline_id, assigned_to, tags, source, status
       FROM leads WHERE id=$1 AND tenant_id=$2`,
      [lead_id, tenantId]
    );
    if (!leadRes.rows[0]) { res.status(404).json({ error: 'Lead not found' }); return; }
    const lead = { ...leadRes.rows[0], ...data };

    setImmediate(() => triggerWorkflows(event, lead, tenantId, 'api').catch(() => null));
    res.json({ success: true, message: `Trigger "${event}" queued for lead ${lead_id}` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Delay queue worker (Task #10) ─────────────────────────────────────────────

export async function processDelayedSteps(): Promise<void> {
  try {
    const due = await query(
      `SELECT * FROM scheduled_workflow_steps
       WHERE status='pending' AND run_at <= NOW()
       ORDER BY run_at ASC LIMIT 20`
    );
    for (const step of due.rows) {
      await query(
        `UPDATE scheduled_workflow_steps SET status='processing', updated_at=NOW() WHERE id=$1`,
        [step.id]
      );
      try {
        const snapshot: LeadContext = step.lead_data;
        const nodes: WFNode[]       = step.remaining_nodes;

        // Leak 10 fix: re-fetch lead so delayed steps use current state, not stale snapshot
        const freshRes = await query(
          `SELECT id, name, email, phone, stage_id, pipeline_id, assigned_to, tags, source, status
           FROM leads WHERE id=$1 AND is_deleted=FALSE LIMIT 1`,
          [snapshot.id]
        ).catch(() => ({ rows: [] }));
        const lead: LeadContext = freshRes.rows[0]
          ? { ...snapshot, ...freshRes.rows[0] }  // fresh DB values override stale snapshot
          : snapshot;                              // fallback: lead deleted, use snapshot for logging

        const delayStats = await executeNodes(nodes, lead, step.tenant_id, 'delay_worker', step.execution_id, step.workflow_id);
        await query(
          `UPDATE scheduled_workflow_steps SET status='completed', updated_at=NOW() WHERE id=$1`,
          [step.id]
        );
        await query(
          `UPDATE workflow_executions SET status='completed', completed_at=NOW() WHERE id=$1`,
          [step.execution_id]
        );
        await query(
          `UPDATE workflows SET skipped=skipped+$2, failed=failed+$3, updated_at=NOW() WHERE id=$1`,
          [step.workflow_id, delayStats.skipped, delayStats.failed]
        ).catch(() => null);
      } catch (err: any) {
        await query(
          `UPDATE scheduled_workflow_steps SET status='failed', error=$1, updated_at=NOW() WHERE id=$2`,
          [err.message ?? 'Unknown', step.id]
        );
      }
    }
  } catch (err) {
    console.error('[Delay Worker] Error:', err);
  }
}

export default router;
