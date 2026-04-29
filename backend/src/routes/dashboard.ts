import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { hasPermission } from '../middleware/permissions';

const router = Router();
router.use(requireAuth);
// No requireTenant — super_admin has no tenantId but can visit /dashboard

// GET /api/dashboard/stats
// Returns permission-gated counts. Does not require staff:view or inbox:view_all
// — uses lightweight COUNT queries scoped to tenantId only.
router.get('/stats', async (req: AuthRequest, res: Response) => {
  const { tenantId, userId, role } = req.user!;
  const isPrivileged = role === 'super_admin' || role === 'owner';

  // Super admin with no tenant context: return empty stats (they use /admin, not /dashboard)
  if (!tenantId) {
    res.json({
      stats: {},
      visible: { total_leads: false, active_staff: false, conversations: false, appointments: false },
    });
    return;
  }

  try {
    let canSeeTotalLeads:    boolean;
    let canSeeActiveStaff:   boolean;
    let canSeeConversations: boolean;
    let canSeeAppointments:  boolean;
    let onlyAssigned:        boolean;
    let inboxViewAll:        boolean;

    if (isPrivileged) {
      canSeeTotalLeads    = true;
      canSeeActiveStaff   = true;
      canSeeConversations = true;
      canSeeAppointments  = true;
      onlyAssigned        = false;
      inboxViewAll        = true;
    } else {
      [
        canSeeTotalLeads,
        canSeeActiveStaff,
        canSeeConversations,
        canSeeAppointments,
        onlyAssigned,
        inboxViewAll,
      ] = await Promise.all([
        hasPermission(userId, 'dashboard:total_leads',   tenantId),
        hasPermission(userId, 'dashboard:active_staff',  tenantId),
        hasPermission(userId, 'dashboard:conversations', tenantId),
        hasPermission(userId, 'dashboard:appointments',  tenantId),
        hasPermission(userId, 'leads:only_assigned',     tenantId),
        hasPermission(userId, 'inbox:view_all',          tenantId),
      ]);
    }

    const stats: Record<string, number> = {};
    const fetches: Promise<void>[] = [];

    if (canSeeTotalLeads) {
      fetches.push(
        (onlyAssigned
          ? query('SELECT COUNT(*)::int AS n FROM leads WHERE tenant_id=$1 AND is_deleted=FALSE AND assigned_to=$2', [tenantId, userId])
          : query('SELECT COUNT(*)::int AS n FROM leads WHERE tenant_id=$1 AND is_deleted=FALSE', [tenantId])
        ).then(r => { stats.total_leads = r.rows[0].n; })
      );
    }

    if (canSeeActiveStaff) {
      fetches.push(
        query(
          'SELECT COUNT(*)::int AS n FROM users WHERE tenant_id=$1 AND is_active=TRUE AND is_owner IS NOT TRUE',
          [tenantId]
        ).then(r => { stats.active_staff = r.rows[0].n; })
      );
    }

    if (canSeeConversations) {
      fetches.push(
        (inboxViewAll
          ? query('SELECT COUNT(*)::int AS n FROM conversations WHERE tenant_id=$1', [tenantId])
          : query('SELECT COUNT(*)::int AS n FROM conversations WHERE tenant_id=$1 AND assigned_to=$2', [tenantId, userId])
        ).then(r => { stats.conversations = r.rows[0].n; })
      );
    }

    if (canSeeAppointments) {
      // Appointments are scoped to tenant only — leads:only_assigned is a leads permission,
      // not a calendar permission. All staff can see the tenant's appointment count.
      fetches.push(
        query(
          'SELECT COUNT(*)::int AS n FROM calendar_events WHERE tenant_id=$1 AND is_deleted=FALSE',
          [tenantId]
        ).then(r => { stats.appointments = r.rows[0].n; })
      );
    }

    await Promise.all(fetches);

    res.json({
      stats,
      visible: {
        total_leads:   canSeeTotalLeads,
        active_staff:  canSeeActiveStaff,
        conversations: canSeeConversations,
        appointments:  canSeeAppointments,
      },
    });
  } catch (err) {
    console.error('[dashboard:stats]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
