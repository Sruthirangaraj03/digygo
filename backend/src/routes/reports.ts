import { Router, Response } from 'express';
import { query } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function computeRange(rangeParam: string, fromParam?: string, toParam?: string) {
  const now = new Date();
  let start: Date;
  let end: Date = new Date();

  switch (rangeParam) {
    case 'this_week': {
      const dow  = now.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      break;
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      start = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), 1);
      end   = toParam   ? new Date(toParam + 'T23:59:59') : new Date();
      break;
    default: // this_month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

function requireOwner(req: AuthRequest, res: Response, next: Function) {
  const role = req.user?.role;
  if (role === 'super_admin' || role === 'owner') return next();
  return res.status(403).json({ error: 'Owner access required' });
}

// ── 1. Lead Acquisition ───────────────────────────────────────────────────────
router.get('/lead-acquisition', requireOwner, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  if (!tenantId) return res.status(403).json({ error: 'No tenant' });
  const { range = 'this_month', from, to } = req.query as Record<string, string>;
  const { start, end } = computeRange(range, from, to);

  try {
    const [bySource, byDay] = await Promise.all([
      query(`
        SELECT COALESCE(l.source,'Unknown') AS source,
          COUNT(*)::int AS total,
          COUNT(CASE WHEN ps.is_won THEN 1 END)::int AS won
        FROM leads l LEFT JOIN pipeline_stages ps ON ps.id=l.stage_id
        WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at>=$2 AND l.created_at<=$3
        GROUP BY l.source ORDER BY total DESC
      `, [tenantId, start, end]),
      query(`
        SELECT TO_CHAR(DATE_TRUNC('day',created_at),'DD Mon') AS day,
          DATE_TRUNC('day',created_at) AS day_ts,
          COUNT(*)::int AS count
        FROM leads
        WHERE tenant_id=$1 AND is_deleted=FALSE AND created_at>=$2 AND created_at<=$3
        GROUP BY day_ts,day ORDER BY day_ts ASC
      `, [tenantId, start, end]),
    ]);
    res.json({ by_source: bySource.rows, by_day: byDay.rows });
  } catch (err) {
    console.error('[reports:lead-acquisition]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── 2. Pipeline Health ────────────────────────────────────────────────────────
router.get('/pipeline-health', requireOwner, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  if (!tenantId) return res.status(403).json({ error: 'No tenant' });

  try {
    const result = await query(`
      SELECT p.id AS pipeline_id, p.name AS pipeline_name,
        ps.name AS stage_name, ps.position, ps.is_won,
        COUNT(l.id)::int AS lead_count,
        ROUND(AVG(EXTRACT(EPOCH FROM(NOW()-l.updated_at))/86400))::int AS avg_days
      FROM pipelines p
      JOIN pipeline_stages ps ON ps.pipeline_id=p.id
      LEFT JOIN leads l ON l.stage_id=ps.id AND l.is_deleted=FALSE AND l.tenant_id=$1
      WHERE p.tenant_id=$1
      GROUP BY p.id,p.name,ps.id,ps.name,ps.position,ps.is_won
      ORDER BY p.name, ps.position
    `, [tenantId]);

    const map: Record<string, any> = {};
    for (const r of result.rows) {
      if (!map[r.pipeline_id]) map[r.pipeline_id] = { id: r.pipeline_id, name: r.pipeline_name, stages: [] };
      map[r.pipeline_id].stages.push({
        name: r.stage_name, count: r.lead_count, avg_days: r.avg_days ?? 0, is_won: r.is_won,
      });
    }
    res.json({ pipelines: Object.values(map) });
  } catch (err) {
    console.error('[reports:pipeline-health]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── 3. Conversion Funnel ──────────────────────────────────────────────────────
router.get('/conversion-funnel', requireOwner, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  if (!tenantId) return res.status(403).json({ error: 'No tenant' });
  const { range = 'this_month', from, to } = req.query as Record<string, string>;
  const { start, end } = computeRange(range, from, to);

  try {
    const r = await query(`
      SELECT
        COUNT(DISTINCT l.id)::int AS total,
        COUNT(DISTINCT CASE WHEN lf.lead_id IS NOT NULL THEN l.id END)::int AS contacted,
        COUNT(DISTINCT CASE WHEN ps.is_won THEN l.id END)::int AS won
      FROM leads l
      LEFT JOIN pipeline_stages ps ON ps.id=l.stage_id
      LEFT JOIN (SELECT DISTINCT lead_id FROM lead_followups) lf ON lf.lead_id=l.id
      WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at>=$2 AND l.created_at<=$3
    `, [tenantId, start, end]);

    const { total, contacted, won } = r.rows[0];
    const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;
    res.json({
      stages: [
        { name: 'New Leads', count: total,     pct: 100 },
        { name: 'Contacted', count: contacted,  pct: pct(contacted) },
        { name: 'Won',       count: won,        pct: pct(won) },
      ],
    });
  } catch (err) {
    console.error('[reports:conversion-funnel]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── 4. Source ROI ─────────────────────────────────────────────────────────────
router.get('/source-roi', requireOwner, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  if (!tenantId) return res.status(403).json({ error: 'No tenant' });
  const { range = 'this_month', from, to } = req.query as Record<string, string>;
  const { start, end } = computeRange(range, from, to);

  try {
    const r = await query(`
      SELECT COALESCE(l.source,'Unknown') AS source,
        COUNT(*)::int AS total,
        COUNT(DISTINCT lf.lead_id)::int AS contacted,
        COUNT(CASE WHEN ps.is_won THEN 1 END)::int AS won,
        COALESCE(ROUND(COUNT(CASE WHEN ps.is_won THEN 1 END)::decimal/NULLIF(COUNT(*),0)*100),0)::int AS conv_pct,
        COALESCE(ROUND(COUNT(DISTINCT lf.lead_id)::decimal/NULLIF(COUNT(*),0)*100),0)::int AS contact_pct
      FROM leads l
      LEFT JOIN pipeline_stages ps ON ps.id=l.stage_id
      LEFT JOIN (SELECT DISTINCT lead_id FROM lead_followups) lf ON lf.lead_id=l.id
      WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at>=$2 AND l.created_at<=$3
      GROUP BY l.source ORDER BY total DESC
    `, [tenantId, start, end]);
    res.json({ sources: r.rows });
  } catch (err) {
    console.error('[reports:source-roi]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── 5. Revenue / Deal Value ───────────────────────────────────────────────────
router.get('/revenue', requireOwner, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  if (!tenantId) return res.status(403).json({ error: 'No tenant' });
  const { range = 'this_month', from, to } = req.query as Record<string, string>;
  const { start, end } = computeRange(range, from, to);

  try {
    const [summary, trend] = await Promise.all([
      query(`
        SELECT
          COUNT(CASE WHEN ps.is_won THEN 1 END)::int AS won_count,
          COALESCE(SUM(CASE WHEN ps.is_won THEN (l.custom_fields->>'lead_value')::numeric END),0) AS won_value,
          COALESCE(SUM((l.custom_fields->>'lead_value')::numeric),0) AS pipeline_value,
          COALESCE(AVG(CASE WHEN ps.is_won THEN (l.custom_fields->>'lead_value')::numeric END),0) AS avg_deal
        FROM leads l LEFT JOIN pipeline_stages ps ON ps.id=l.stage_id
        WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at>=$2 AND l.created_at<=$3
      `, [tenantId, start, end]),
      query(`
        SELECT TO_CHAR(DATE_TRUNC('month',l.created_at),'Mon YY') AS month,
          DATE_TRUNC('month',l.created_at) AS month_ts,
          COUNT(*)::int AS new_leads,
          COUNT(CASE WHEN ps.is_won THEN 1 END)::int AS won_count,
          COALESCE(SUM(CASE WHEN ps.is_won THEN (l.custom_fields->>'lead_value')::numeric END),0) AS won_value
        FROM leads l LEFT JOIN pipeline_stages ps ON ps.id=l.stage_id
        WHERE l.tenant_id=$1 AND l.is_deleted=FALSE AND l.created_at >= NOW()-INTERVAL '12 months'
        GROUP BY month_ts,month ORDER BY month_ts ASC
      `, [tenantId]),
    ]);
    res.json({ summary: summary.rows[0], trend: trend.rows });
  } catch (err) {
    console.error('[reports:revenue]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── 6. Team Performance ───────────────────────────────────────────────────────
router.get('/team-performance', requireOwner, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  if (!tenantId) return res.status(403).json({ error: 'No tenant' });
  const { range = 'this_month', from, to } = req.query as Record<string, string>;
  const { start, end } = computeRange(range, from, to);

  try {
    const r = await query(`
      SELECT u.id, u.name,
        COUNT(DISTINCT l.id)::int AS assigned,
        COUNT(DISTINCT CASE WHEN lf_any.lead_id IS NOT NULL THEN l.id END)::int AS contacted,
        COUNT(DISTINCT CASE WHEN ps.is_won THEN l.id END)::int AS won,
        COUNT(DISTINCT f.id)::int AS followups,
        COUNT(DISTINCT n.id)::int AS notes,
        COALESCE(ROUND(COUNT(DISTINCT CASE WHEN ps.is_won THEN l.id END)::decimal/NULLIF(COUNT(DISTINCT l.id),0)*100),0)::int AS conv_pct
      FROM users u
      LEFT JOIN leads l ON l.assigned_to=u.id AND l.is_deleted=FALSE AND l.tenant_id=$1
        AND l.created_at>=$2 AND l.created_at<=$3
      LEFT JOIN pipeline_stages ps ON ps.id=l.stage_id
      LEFT JOIN (SELECT DISTINCT lead_id FROM lead_followups WHERE tenant_id=$1) lf_any ON lf_any.lead_id=l.id
      LEFT JOIN lead_followups f ON f.lead_id=l.id AND f.tenant_id=$1 AND f.created_at>=$2 AND f.created_at<=$3
      LEFT JOIN lead_notes n ON n.lead_id=l.id AND n.tenant_id=$1 AND n.created_at>=$2 AND n.created_at<=$3
      WHERE u.tenant_id=$1 AND u.is_active=TRUE AND (u.is_owner IS NULL OR u.is_owner=FALSE)
      GROUP BY u.id,u.name ORDER BY assigned DESC
    `, [tenantId, start, end]);
    res.json({ staff: r.rows });
  } catch (err) {
    console.error('[reports:team-performance]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── 7. Growth Trend (12 months, no range filter — always shows full year) ────
router.get('/growth', requireOwner, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  if (!tenantId) return res.status(403).json({ error: 'No tenant' });

  try {
    const r = await query(`
      SELECT TO_CHAR(DATE_TRUNC('month',l.created_at),'Mon YY') AS month,
        DATE_TRUNC('month',l.created_at) AS month_ts,
        COUNT(*)::int AS new_leads,
        COUNT(CASE WHEN ps.is_won THEN 1 END)::int AS won
      FROM leads l LEFT JOIN pipeline_stages ps ON ps.id=l.stage_id
      WHERE l.tenant_id=$1 AND l.is_deleted=FALSE
        AND l.created_at >= NOW()-INTERVAL '12 months'
      GROUP BY month_ts,month ORDER BY month_ts ASC
    `, [tenantId]);
    res.json({ months: r.rows });
  } catch (err) {
    console.error('[reports:growth]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── 8. Automation Effectiveness ───────────────────────────────────────────────
router.get('/automation', requireOwner, async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  if (!tenantId) return res.status(403).json({ error: 'No tenant' });
  const { range = 'this_month', from, to } = req.query as Record<string, string>;
  const { start, end } = computeRange(range, from, to);

  try {
    const r = await query(`
      SELECT w.id, w.name, w.trigger_key,
        COUNT(DISTINCT we.id)::int AS total,
        COUNT(DISTINCT CASE WHEN we.status='completed' THEN we.id END)::int AS completed,
        COUNT(DISTINCT CASE WHEN we.status='failed' THEN we.id END)::int AS failed,
        COUNT(DISTINCT we.lead_id)::int AS leads_enrolled
      FROM workflows w
      LEFT JOIN workflow_executions we ON we.workflow_id=w.id
        AND we.tenant_id=$1 AND we.enrolled_at>=$2 AND we.enrolled_at<=$3
      WHERE w.tenant_id=$1 AND w.status='active'
      GROUP BY w.id,w.name,w.trigger_key ORDER BY total DESC
    `, [tenantId, start, end]);
    res.json({ workflows: r.rows });
  } catch (err) {
    console.error('[reports:automation]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
