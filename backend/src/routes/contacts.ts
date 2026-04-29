import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { checkPermission, hasPermission } from '../middleware/permissions';
import { checkUsage, incrementUsage } from '../middleware/plan';
import { triggerWorkflows } from './workflows';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// GET /api/contacts
router.get('/', checkPermission('contacts:read'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, tenantId, role } = req.user!;
    const isSuperAdmin = role === 'super_admin';

    let onlyAssigned = false;
    if (!isSuperAdmin) {
      try { onlyAssigned = await hasPermission(userId, 'leads:only_assigned', tenantId); } catch { onlyAssigned = true; }
    }

    const params: any[] = [tenantId];
    let assignedFilter = '';
    if (onlyAssigned) {
      params.push(userId);
      assignedFilter = ` AND l.assigned_to = $${params.length}`;
    }

    const result = await query(
      `SELECT c.*, l.name AS lead_name FROM contacts c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.tenant_id = $1${assignedFilter} ORDER BY c.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/contacts
router.post('/', checkPermission('contacts:create'), checkUsage('contacts'), async (req: AuthRequest, res: Response) => {
  const { name, email, phone, company, lead_id } = req.body;
  if (!name) { res.status(400).json({ error: 'Name required' }); return; }
  try {
    const result = await query(
      `INSERT INTO contacts (tenant_id, name, email, phone, company, lead_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user!.tenantId, name, email, phone, company, lead_id]
    );
    const contact = result.rows[0];
    res.status(201).json(contact);
    const lead = { id: contact.lead_id, name: contact.name, email: contact.email, phone: contact.phone };
    setImmediate(() => {
      incrementUsage(req.user!.tenantId!, 'contacts').catch(() => null);
      triggerWorkflows('contact_created', lead, req.user!.tenantId!, req.user!.userId).catch(() => null);
    });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/contacts/:id
router.patch('/:id', checkPermission('contacts:edit'), async (req: AuthRequest, res: Response) => {
  const { name, email, phone, company, tags } = req.body;
  const fields: string[] = [];
  const params: any[] = [];
  if (name    !== undefined) { params.push(name);    fields.push(`name=$${params.length}`); }
  if (email   !== undefined) { params.push(email);   fields.push(`email=$${params.length}`); }
  if (phone   !== undefined) { params.push(phone);   fields.push(`phone=$${params.length}`); }
  if (company !== undefined) { params.push(company); fields.push(`company=$${params.length}`); }
  if (tags    !== undefined) { params.push(tags);    fields.push(`tags=$${params.length}`); }
  if (!fields.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
  params.push(req.params.id, req.user!.tenantId);
  try {
    const result = await query(
      `UPDATE contacts SET ${fields.join(',')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    const contact = result.rows[0];
    res.json(contact);
    const lead = { id: contact.lead_id, name: contact.name, email: contact.email, phone: contact.phone };
    const triggerType = tags !== undefined ? 'contact_tagged' : 'contact_updated';
    setImmediate(() => triggerWorkflows(triggerType, lead, req.user!.tenantId!, req.user!.userId).catch(() => null));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/contacts/:id
router.delete('/:id', checkPermission('contacts:delete'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM contacts WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
