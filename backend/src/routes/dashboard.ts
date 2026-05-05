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

// GET /api/dashboard/analytics — role-based analytics for the new dashboard
router.get('/analytics', async (req: AuthRequest, res: Response) => {
  const { tenantId, userId, role } = req.user!;
  if (!tenantId) { res.json({}); return; }

  const isPrivileged = role === 'super_admin' || role === 'owner';
  let onlyAssigned = false;
  let isManager = false;

  if (!isPrivileged) {
    const [oa, sm] = await Promise.all([
      hasPermission(userId, 'leads:only_assigned', tenantId),
      hasPermission(userId, 'staff:manage', tenantId),
    ]);
    onlyAssigned = oa;
    isManager    = sm;
  }

  try {
    const now        = new Date();
    const thisMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const leadFilter = onlyAssigned
      ? `AND l.assigned_to = '${userId}'`
      : '';

    const [
      totalLeads,
      leadsThisMonth,
      leadsLastMonth,
      convertedLeads,
      staleLeads,
      overdueFollowups,
      sourceBreakdown,
      pipelineFunnel,
      staffLeaderboard,
      todayFollowups,
    ] = await Promise.all([
      // Total leads
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE ${leadFilter}`, [tenantId]),

      // Leads this month
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at >= $2 ${leadFilter}`, [tenantId, thisMonth]),

      // Leads last month
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at >= $2 AND l.created_at <= $3 ${leadFilter}`, [tenantId, lastMonth, lastMonthEnd]),

      // Converted leads (in a won stage)
      query(`SELECT COUNT(*)::int AS n FROM leads l JOIN pipeline_stages ps ON ps.id = l.stage_id WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND ps.is_won=TRUE ${leadFilter}`, [tenantId]),

      // Stale leads — no activity in 7+ days
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.updated_at < $2 ${leadFilter}`, [tenantId, sevenDaysAgo]),

      // Overdue follow-ups
      query(`SELECT COUNT(*)::int AS n FROM lead_followups f JOIN leads l ON l.id = f.lead_id WHERE f.tenant_id=$1 AND f.completed=FALSE AND f.due_at < NOW() ${onlyAssigned ? `AND l.assigned_to='${userId}'` : ''}`, [tenantId]),

      // Source breakdown
      query(`SELECT l.source, COUNT(*)::int AS count FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE ${leadFilter} GROUP BY l.source ORDER BY count DESC`, [tenantId]),

      // Pipeline funnel
      query(`SELECT ps.name AS stage, ps.is_won, COUNT(l.id)::int AS count FROM pipeline_stages ps LEFT JOIN leads l ON l.stage_id = ps.id AND l.is_deleted=FALSE AND l.tenant_id=$1 WHERE ps.tenant_id=$1 GROUP BY ps.id, ps.name, ps.is_won, ps.stage_order ORDER BY ps.stage_order`, [tenantId]),

      // Staff leaderboard — leads in won stages per staff member
      query(`SELECT u.name, u.id, COUNT(l.id)::int AS converted, COUNT(CASE WHEN l.created_at >= $2 THEN 1 END)::int AS new_this_month FROM users u LEFT JOIN leads l ON l.assigned_to = u.id AND l.is_deleted=FALSE AND l.tenant_id=$1 LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id AND ps.is_won=TRUE WHERE u.tenant_id=$1 AND u.is_active=TRUE AND (u.is_owner IS NULL OR u.is_owner=FALSE) GROUP BY u.id, u.name ORDER BY converted DESC`, [tenantId, thisMonth]),

      // Today's follow-ups for this user
      query(`SELECT f.id, f.title, f.description, f.due_at, l.name AS lead_name, l.id AS lead_id FROM lead_followups f JOIN leads l ON l.id = f.lead_id WHERE f.tenant_id=$1 AND f.completed=FALSE AND DATE(f.due_at) = CURRENT_DATE ${onlyAssigned ? `AND l.assigned_to='${userId}'` : ''} ORDER BY f.due_at ASC LIMIT 10`, [tenantId]),
    ]);

    const total     = totalLeads.rows[0].n;
    const converted = convertedLeads.rows[0].n;
    const thisM     = leadsThisMonth.rows[0].n;
    const lastM     = leadsLastMonth.rows[0].n;
    const growth    = lastM === 0 ? (thisM > 0 ? 100 : 0) : Math.round(((thisM - lastM) / lastM) * 100);

    res.json({
      total_leads:       total,
      leads_this_month:  thisM,
      leads_last_month:  lastM,
      growth_pct:        growth,
      converted_leads:   converted,
      conversion_rate:   total === 0 ? 0 : Math.round((converted / total) * 100),
      stale_leads:       staleLeads.rows[0].n,
      overdue_followups: overdueFollowups.rows[0].n,
      source_breakdown:  sourceBreakdown.rows,
      pipeline_funnel:   pipelineFunnel.rows,
      staff_leaderboard: staffLeaderboard.rows,
      today_followups:   todayFollowups.rows,
      role:              isPrivileged ? role : (isManager ? 'manager' : 'staff'),
    });
  } catch (err) {
    console.error('[dashboard:analytics]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
