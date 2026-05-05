import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, requireTenant, AuthRequest } from '../middleware/auth';
import { hasPermission } from '../middleware/permissions';

const router = Router();
router.use(requireAuth);
router.use(requireTenant);

// GET /api/lead-generation/overview
// Returns unified form stats for both Meta and Custom forms
router.get('/overview', async (req: AuthRequest, res: Response) => {
  const { tenantId, userId, role } = req.user!;

  const isPrivileged = role === 'super_admin' || role === 'owner';
  if (!isPrivileged) {
    const [canMeta, canCustom] = await Promise.all([
      hasPermission(userId, 'meta_forms:read', tenantId),
      hasPermission(userId, 'custom_forms:read', tenantId),
    ]);
    if (!canMeta && !canCustom) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
  }

  try {
    const [metaResult, customResult, totalRes] = await Promise.all([
      // Meta forms — join leads via meta_form_id
      query(`
        SELECT
          mf.form_id          AS id,
          mf.form_name        AS name,
          'meta'              AS channel,
          COALESCE(mf.meta_status, 'ACTIVE') AS status,
          mf.page_name,
          NULL::text          AS slug,
          COUNT(l.id) FILTER (WHERE DATE(l.created_at) = CURRENT_DATE)::int   AS leads_today,
          COUNT(l.id) FILTER (WHERE l.created_at >= NOW() - INTERVAL '7 days')::int  AS leads_week,
          COUNT(l.id) FILTER (WHERE l.created_at >= NOW() - INTERVAL '30 days')::int AS leads_month,
          COUNT(l.id)::int    AS leads_total,
          MAX(l.created_at)   AS last_lead_at
        FROM meta_forms mf
        LEFT JOIN leads l
          ON l.meta_form_id = mf.form_id
         AND l.tenant_id    = mf.tenant_id
         AND l.is_deleted   = FALSE
        WHERE mf.tenant_id = $1 AND mf.is_active = TRUE
        GROUP BY mf.form_id, mf.form_name, mf.meta_status, mf.page_name
      `, [tenantId]),

      // Custom forms — join leads via source = 'form:{name}'
      query(`
        SELECT
          cf.id::text         AS id,
          cf.name,
          'custom'            AS channel,
          CASE WHEN cf.is_active THEN 'active' ELSE 'inactive' END AS status,
          NULL::text          AS page_name,
          cf.slug,
          COUNT(l.id) FILTER (WHERE DATE(l.created_at) = CURRENT_DATE)::int   AS leads_today,
          COUNT(l.id) FILTER (WHERE l.created_at >= NOW() - INTERVAL '7 days')::int  AS leads_week,
          COUNT(l.id) FILTER (WHERE l.created_at >= NOW() - INTERVAL '30 days')::int AS leads_month,
          COUNT(l.id)::int    AS leads_total,
          MAX(l.created_at)   AS last_lead_at
        FROM custom_forms cf
        LEFT JOIN leads l
          ON l.source      = 'form:' || cf.name
         AND l.tenant_id   = cf.tenant_id
         AND l.is_deleted  = FALSE
        WHERE cf.tenant_id = $1 AND cf.is_active = TRUE
        GROUP BY cf.id, cf.name, cf.is_active, cf.slug
      `, [tenantId]),

      // Total leads across all sources (for KPI card)
      query(`SELECT COUNT(*)::int AS n FROM leads WHERE tenant_id=$1 AND is_deleted=FALSE`, [tenantId]),
    ]);

    const allForms = [
      ...metaResult.rows,
      ...customResult.rows,
    ].sort((a, b) => (b.leads_month ?? 0) - (a.leads_month ?? 0));

    const leadsToday = allForms.reduce((s, f) => s + (f.leads_today ?? 0), 0);
    const bestForm   = allForms.reduce((best: any, f) =>
      (!best || (f.leads_month ?? 0) > (best.leads_month ?? 0)) ? f : best, null
    );

    // Dead: has received leads before but none in last 7 days
    const deadForms = allForms.filter(f => (f.leads_total ?? 0) > 0 && (f.leads_week ?? 0) === 0);

    res.json({
      summary: {
        total_leads:        totalRes.rows[0].n,
        active_forms_count: allForms.length,
        leads_today:        leadsToday,
        best_form: bestForm ? {
          name:    bestForm.name,
          channel: bestForm.channel,
          count:   bestForm.leads_month,
        } : null,
      },
      dead_forms: deadForms.map(f => ({
        id:           f.id,
        name:         f.name,
        channel:      f.channel,
        last_lead_at: f.last_lead_at,
      })),
      forms: allForms,
    });
  } catch (err: any) {
    console.error('[lead-generation:overview]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/lead-generation/sparkline?channel=meta|custom&id={id}&name={form_name}
// Returns 7-day daily counts + last 5 leads for the form
router.get('/sparkline', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { channel, id, name } = req.query as Record<string, string>;

  try {
    let countRows: any[];
    let recentRows: any[];

    if (channel === 'meta') {
      const [cr, rr] = await Promise.all([
        query(`
          SELECT DATE(l.created_at) AS day, COUNT(*)::int AS count
          FROM leads l
          WHERE l.tenant_id = $1 AND l.meta_form_id = $2 AND l.is_deleted = FALSE
            AND l.created_at >= CURRENT_DATE - 6
          GROUP BY DATE(l.created_at)
          ORDER BY day ASC
        `, [tenantId, id]),
        query(`
          SELECT l.id, l.name, l.phone, l.email, l.created_at
          FROM leads l
          WHERE l.tenant_id = $1 AND l.meta_form_id = $2 AND l.is_deleted = FALSE
          ORDER BY l.created_at DESC LIMIT 5
        `, [tenantId, id]),
      ]);
      countRows  = cr.rows;
      recentRows = rr.rows;
    } else {
      const [cr, rr] = await Promise.all([
        query(`
          SELECT DATE(l.created_at) AS day, COUNT(*)::int AS count
          FROM leads l
          WHERE l.tenant_id = $1 AND l.source = 'form:' || $2 AND l.is_deleted = FALSE
            AND l.created_at >= CURRENT_DATE - 6
          GROUP BY DATE(l.created_at)
          ORDER BY day ASC
        `, [tenantId, name]),
        query(`
          SELECT l.id, l.name, l.phone, l.email, l.created_at
          FROM leads l
          WHERE l.tenant_id = $1 AND l.source = 'form:' || $2 AND l.is_deleted = FALSE
          ORDER BY l.created_at DESC LIMIT 5
        `, [tenantId, name]),
      ]);
      countRows  = cr.rows;
      recentRows = rr.rows;
    }

    // Fill all 7 days (gaps = 0)
    const sparkline = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toISOString().split('T')[0];
      const found  = countRows.find(r => {
        const rd = r.day instanceof Date ? r.day : new Date(r.day);
        return rd.toISOString().split('T')[0] === dayStr;
      });
      return { day: dayStr, count: found?.count ?? 0 };
    });

    res.json({ sparkline, recent_leads: recentRows });
  } catch (err: any) {
    console.error('[lead-generation:sparkline]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
