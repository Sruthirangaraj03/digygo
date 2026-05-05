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
    const now          = new Date();
    const thisMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Range param — affects range_leads, source_breakdown, staff leaderboard new_in_range
    const rangeParam = (req.query.range as string) || '30d';
    let rangeStart: Date;
    let rangeLabel: string;
    switch (rangeParam) {
      case '90d':
        rangeStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        rangeLabel = 'Last 90 Days';
        break;
      case 'this_month':
        rangeStart = thisMonth;
        rangeLabel = 'This Month';
        break;
      case 'all':
        rangeStart = new Date(0);
        rangeLabel = 'All Time';
        break;
      default:
        rangeStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        rangeLabel = 'Last 30 Days';
    }

    const leadFilter = onlyAssigned ? `AND l.assigned_to = '${userId}'` : '';

    const [
      totalLeads,
      leadsThisMonth,
      leadsLastMonth,
      leadsInRange,
      convertedLeads,
      staleLeads,
      overdueFollowups,
      sourceBreakdown,
      pipelineFunnel,
      staffLeaderboard,
      todayFollowups,
    ] = await Promise.all([
      // Total leads — all time
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE ${leadFilter}`, [tenantId]),

      // Leads this calendar month
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at >= $2 ${leadFilter}`, [tenantId, thisMonth]),

      // Leads last calendar month
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at >= $2 AND l.created_at <= $3 ${leadFilter}`, [tenantId, lastMonth, lastMonthEnd]),

      // Leads in selected range
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at >= $2 ${leadFilter}`, [tenantId, rangeStart]),

      // Converted leads (in won stage) — all time
      query(`SELECT COUNT(*)::int AS n FROM leads l JOIN pipeline_stages ps ON ps.id = l.stage_id WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND ps.is_won=TRUE ${leadFilter}`, [tenantId]),

      // Stale leads — no activity in 7+ days
      query(`SELECT COUNT(*)::int AS n FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.updated_at < $2 ${leadFilter}`, [tenantId, sevenDaysAgo]),

      // Overdue follow-ups
      query(`SELECT COUNT(*)::int AS n FROM lead_followups f JOIN leads l ON l.id = f.lead_id WHERE f.tenant_id=$1 AND f.completed=FALSE AND f.due_at < NOW() ${onlyAssigned ? `AND l.assigned_to='${userId}'` : ''}`, [tenantId]),

      // Source breakdown — filtered by range
      query(`SELECT l.source, COUNT(*)::int AS count FROM leads l WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at >= $2 ${leadFilter} GROUP BY l.source ORDER BY count DESC`, [tenantId, rangeStart]),

      // Per-pipeline funnel — each pipeline with its own stages
      query(`
        SELECT p.id AS pipeline_id, p.name AS pipeline_name,
          ps.name AS stage, ps.is_won, ps.stage_order,
          COUNT(l.id)::int AS count
        FROM pipelines p
        JOIN pipeline_stages ps ON ps.pipeline_id = p.id
        LEFT JOIN leads l ON l.stage_id = ps.id AND l.is_deleted = FALSE AND l.tenant_id = $1
        WHERE p.tenant_id = $1
        GROUP BY p.id, p.name, ps.id, ps.name, ps.is_won, ps.stage_order
        ORDER BY p.name, ps.stage_order
      `, [tenantId]),

      // Staff leaderboard — assigned_count (all time), converted (all time), new_in_range (range-filtered)
      query(`
        SELECT u.name, u.id,
          COUNT(DISTINCT l.id)::int AS assigned_count,
          COUNT(DISTINCT CASE WHEN ps.is_won = TRUE THEN l.id END)::int AS converted,
          COUNT(DISTINCT CASE WHEN l.created_at >= $2 THEN l.id END)::int AS new_in_range
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.is_deleted = FALSE AND l.tenant_id = $1
        LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
        WHERE u.tenant_id = $1 AND u.is_active = TRUE AND (u.is_owner IS NULL OR u.is_owner = FALSE)
        GROUP BY u.id, u.name
        ORDER BY converted DESC
      `, [tenantId, rangeStart]),

      // Today's follow-ups for this user
      query(`SELECT f.id, f.title, f.description, f.due_at, l.name AS lead_name, l.id AS lead_id FROM lead_followups f JOIN leads l ON l.id = f.lead_id WHERE f.tenant_id=$1 AND f.completed=FALSE AND DATE(f.due_at) = CURRENT_DATE ${onlyAssigned ? `AND l.assigned_to='${userId}'` : ''} ORDER BY f.due_at ASC LIMIT 10`, [tenantId]),
    ]);

    const total     = totalLeads.rows[0].n;
    const converted = convertedLeads.rows[0].n;
    const thisM     = leadsThisMonth.rows[0].n;
    const lastM     = leadsLastMonth.rows[0].n;
    const growth    = lastM === 0 ? (thisM > 0 ? 100 : 0) : Math.round(((thisM - lastM) / lastM) * 100);

    // Per-staff conversion rate
    const leaderboardWithRate = staffLeaderboard.rows.map((s: any) => ({
      ...s,
      conversion_rate_pct: s.assigned_count === 0 ? 0 : Math.round((s.converted / s.assigned_count) * 100),
    }));

    // Best source from range-filtered breakdown (first non-null source)
    const bestSourceRow = sourceBreakdown.rows.find((s: any) => s.source) ?? null;
    const bestSource = bestSourceRow ? { source: bestSourceRow.source as string, count: bestSourceRow.count as number } : null;

    // Build per-pipeline funnel structure
    const funnelMap: Record<string, { id: string; name: string; stages: any[] }> = {};
    for (const row of pipelineFunnel.rows) {
      if (!funnelMap[row.pipeline_id]) {
        funnelMap[row.pipeline_id] = { id: row.pipeline_id, name: row.pipeline_name, stages: [] };
      }
      funnelMap[row.pipeline_id].stages.push({ stage: row.stage, is_won: row.is_won, count: row.count });
    }
    const pipeline_funnels = Object.values(funnelMap);

    res.json({
      total_leads:       total,
      leads_this_month:  thisM,
      leads_last_month:  lastM,
      growth_pct:        growth,
      range_leads:       leadsInRange.rows[0].n,
      range:             rangeParam,
      range_label:       rangeLabel,
      converted_leads:   converted,
      conversion_rate:   total === 0 ? 0 : Math.round((converted / total) * 100),
      stale_leads:       staleLeads.rows[0].n,
      overdue_followups: overdueFollowups.rows[0].n,
      best_source:       bestSource,
      source_breakdown:  sourceBreakdown.rows,
      pipeline_funnels,
      staff_leaderboard: leaderboardWithRate,
      today_followups:   todayFollowups.rows,
      role:              isPrivileged ? role : (isManager ? 'manager' : 'staff'),
    });
  } catch (err) {
    console.error('[dashboard:analytics]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
