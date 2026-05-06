import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ChevronDown, TrendingUp, CheckCircle2, Loader2, ArrowUpRight, Users, Clock, AlertCircle } from 'lucide-react';

const RANGES = [
  { id: 'all_time',   label: 'All Time' },
  { id: 'this_month', label: 'Month' },
  { id: 'this_week',  label: 'Week' },
  { id: 'today',      label: 'Today' },
  { id: 'custom',     label: 'Custom' },
];

// ── Shared ────────────────────────────────────────────────────────────────────

function PipelineDropdown({ pipelines, selected, onChange }: {
  pipelines: { id: string; name: string }[];
  selected: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = pipelines.find(p => p.id === selected)?.name ?? 'Select Pipeline';

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-gray-800 hover:border-gray-300 transition-colors min-w-[180px] shadow-sm"
      >
        <span className="flex-1 text-left truncate">{name}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 min-w-[200px] bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1.5 max-h-72 overflow-y-auto">
          {pipelines.map(pl => (
            <button key={pl.id} onClick={() => { onChange(pl.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${pl.id === selected ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-gray-700 hover:bg-gray-50 font-medium'}`}>
              {pl.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, badge, badgeColor }: {
  label: string;
  value: string | number;
  sub?: string;
  badge?: string;
  badgeColor?: 'green' | 'orange' | 'blue' | 'purple' | 'amber';
}) {
  const badgeStyles: Record<string, string> = {
    green:  'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    blue:   'bg-blue-50 text-blue-600',
    purple: 'bg-violet-50 text-violet-600',
    amber:  'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[38px] font-black text-gray-900 leading-none tracking-tight">{value}</p>
        {badge && badgeColor && (
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 mb-0.5 ${badgeStyles[badgeColor]}`}>
            <ArrowUpRight className="w-3 h-3" />{badge}
          </span>
        )}
      </div>
      {sub && <p className="text-[12px] text-gray-400 mt-2">{sub}</p>}
    </div>
  );
}

// ── Trend Chart ───────────────────────────────────────────────────────────────
function TrendChart({ winLoss }: { winLoss: any[] }) {
  if (!winLoss.length) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-[13px]">No trend data for this period</div>
  );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={winLoss} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradWon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', fontSize: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '10px 14px' }}
          labelStyle={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}
        />
        <Area type="monotone" dataKey="new_leads" name="New Leads" stroke="#6366f1" strokeWidth={2} fill="url(#gradLeads)" dot={false} activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} />
        <Area type="monotone" dataKey="won" name="Won" stroke="#10b981" strokeWidth={2} fill="url(#gradWon)" dot={false} activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Stage Funnel ──────────────────────────────────────────────────────────────
function StageFunnel({ stages }: { stages: any[] }) {
  if (!stages.length) return <p className="text-[13px] text-center text-gray-400 py-8">No data</p>;
  const maxCount = Math.max(...stages.map(s => s.lead_count), 1);

  return (
    <div className="space-y-2.5">
      {stages.map((stage, i) => {
        const barW  = Math.max(Math.round(stage.lead_count / maxCount * 100), 2);
        const color = stage.is_won ? '#10b981' : ['#6366f1','#3b82f6','#06b6d4','#8b5cf6','#f59e0b','#ea580c'][i % 6];
        const prev  = stages[i - 1];
        const drop  = prev && prev.lead_count > 0 ? Math.round((1 - stage.lead_count / prev.lead_count) * 100) : null;

        return (
          <div key={stage.stage_name}>
            {drop !== null && (
              <p className="text-[10px] text-gray-400 pl-1 mb-1">↓ {drop}% drop-off</p>
            )}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-gray-500 w-20 shrink-0 truncate">{stage.stage_name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div className="h-full rounded-full flex items-center justify-end pr-2.5 transition-all duration-500 min-w-[24px]"
                  style={{ width: `${barW}%`, background: color }}>
                  {barW > 15 && <span className="text-[11px] font-bold text-white">{stage.lead_count}</span>}
                </div>
              </div>
              {barW <= 15 && <span className="text-[12px] font-bold text-gray-700 w-5">{stage.lead_count}</span>}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0"
                style={{
                  background: stage.is_won ? '#f0fdf4' : stage.avg_days > 7 ? '#fef2f2' : stage.avg_days > 2 ? '#fefce8' : '#f0fdf4',
                  color:      stage.is_won ? '#16a34a' : stage.avg_days > 7 ? '#ef4444' : stage.avg_days > 2 ? '#ca8a04' : '#16a34a',
                }}>
                {stage.is_won ? 'Won' : `${stage.avg_days}d`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Source Table ──────────────────────────────────────────────────────────────
function SourceTable({ sources }: { sources: any[] }) {
  if (!sources.length) return <p className="text-[13px] text-center text-gray-400 py-8">No data</p>;
  const max = Math.max(...sources.map(s => s.total), 1);

  return (
    <div className="space-y-3">
      {sources.slice(0, 7).map((s, i) => {
        const colors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ea580c','#8b5cf6','#06b6d4'];
        const c = colors[i % colors.length];
        return (
          <div key={s.source}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                <span className="text-[13px] font-semibold text-gray-700 truncate max-w-[120px]">{s.source}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] shrink-0">
                <span className="text-gray-400">{s.total}</span>
                <span className="font-bold px-1.5 py-0.5 rounded text-[11px]" style={{ background: `${c}15`, color: c }}>{s.conv_pct}%</span>
              </div>
            </div>
            <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.round(s.total / max * 100)}%`, background: c }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Staff Table ───────────────────────────────────────────────────────────────
function StaffTable({ staff }: { staff: any[] }) {
  const active = staff.filter(s => s.assigned > 0);
  if (!active.length) return <p className="text-[13px] text-center text-gray-400 py-8">No staff data</p>;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 pb-2 mb-2 border-b border-gray-100">
        {['Staff', 'Leads', 'Won', 'Conv%'].map(h => (
          <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</span>
        ))}
      </div>
      <div className="space-y-3">
        {active.slice(0, 8).map((s, i) => (
          <div key={s.id} className="grid grid-cols-4 gap-2 items-center">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: ['#6366f1','#3b82f6','#10b981','#f59e0b','#ea580c'][i % 5] }}>
                {(s.name?.[0] ?? '?').toUpperCase()}
              </div>
              <span className="text-[12px] font-semibold text-gray-700 truncate">{s.name}</span>
            </div>
            <span className="text-[13px] font-bold text-gray-800">{s.assigned}</span>
            <span className="text-[13px] font-bold text-emerald-600">{s.won}</span>
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg w-fit bg-orange-50 text-orange-600">{s.conv_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lead Flow Bar Chart ───────────────────────────────────────────────────────
function LeadFlowChart({ flow }: { flow: any[] }) {
  if (!flow.length) return <div className="flex items-center justify-center h-32 text-gray-400 text-[13px]">No inflow data</div>;
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={flow} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #f3f4f6', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
        <Bar dataKey="count" name="Leads" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Alert Lists ───────────────────────────────────────────────────────────────
function IdleLeads({ stale }: { stale: any }) {
  const count = stale?.stale_count ?? 0;
  if (!count) return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      <p className="text-[13px] font-semibold text-emerald-600">All leads active</p>
      <p className="text-[11px] text-gray-400">No leads stuck 7+ days</p>
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-gray-400 mb-3">{count} leads stuck for 7+ days</p>
      {stale.list?.map((l: any) => (
        <div key={l.id} className="flex items-center justify-between px-3 py-2.5 bg-red-50 rounded-xl border border-red-100">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-800 truncate">{l.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{l.stage_name ?? '—'} · {l.assigned_name ?? 'Unassigned'}</p>
          </div>
          <span className="text-[12px] font-bold text-red-500 shrink-0 ml-3 bg-white px-2.5 py-1 rounded-lg border border-red-100">{l.days_stale}d</span>
        </div>
      ))}
    </div>
  );
}

function OverdueList({ followups }: { followups: any }) {
  const list    = followups?.overdue_list ?? [];
  const overdue = followups?.overdue ?? 0;
  if (!overdue) return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      <p className="text-[13px] font-semibold text-emerald-600">No overdue follow-ups</p>
      <p className="text-[11px] text-gray-400">Team is on top of all tasks</p>
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-gray-400 mb-3">{overdue} of {followups.total ?? 0} overdue</p>
      {list.slice(0, 6).map((o: any, i: number) => (
        <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-800 truncate">{o.lead_name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{o.staff_name ?? 'Unassigned'}</p>
          </div>
          <span className="text-[12px] font-bold text-amber-600 shrink-0 ml-3 bg-white px-2.5 py-1 rounded-lg border border-amber-100">{o.overdue_days}d late</span>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Card({ title, sub, children, className = '' }: {
  title?: string; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-[14px] font-bold text-gray-800">{title}</h3>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [range, setRange]           = useState('all_time');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [plLoading, setPlLoading]   = useState(true);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/api/reports/pipelines')
      .then(rows => { setPipelines(rows); if (rows.length) setPipelineId(rows[0].id); })
      .catch(() => toast.error('Failed to load pipelines'))
      .finally(() => setPlLoading(false));
  }, []);

  useEffect(() => {
    if (!pipelineId) return;
    if (range === 'custom' && (!fromDate || !toDate)) return;
    setLoading(true);
    setData(null);
    const p = new URLSearchParams({ pipeline_id: pipelineId, range });
    if (range === 'custom') { p.set('from', fromDate); p.set('to', toDate); }
    api.get<any>(`/api/reports/pipeline-analytics?${p}`)
      .then(setData)
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [pipelineId, range, fromDate, toDate]);

  const pipelineName = pipelines.find(p => p.id === pipelineId)?.name ?? '';

  return (
    <div className="space-y-5 pb-12">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-black text-gray-900 tracking-tight">Pipeline Analytics</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {pipelineName ? `${pipelineName}` : 'Select a pipeline'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range */}
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                  range === r.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {r.label}
              </button>
            ))}
          </div>

          {/* Pipeline dropdown */}
          {!plLoading && pipelines.length > 0 && (
            <PipelineDropdown pipelines={pipelines} selected={pipelineId} onChange={setPipelineId} />
          )}
        </div>
      </div>

      {/* Custom date range */}
      {range === 'custom' && (
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-orange-200 bg-white" />
          <span className="text-gray-400 text-[13px]">→</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-orange-200 bg-white" />
        </div>
      )}

      {/* Loading */}
      {(plLoading || loading) && (
        <div className="flex items-center justify-center h-72 text-gray-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[13px]">Loading analytics…</span>
        </div>
      )}

      {!loading && !plLoading && pipelines.length === 0 && (
        <div className="text-center py-20 text-gray-400 text-[13px]">No pipelines found. Create a pipeline first.</div>
      )}

      {data && !loading && (() => {
        const kpi = data.kpi ?? {};
        const total = kpi.total_leads ?? 0;
        const won   = kpi.won ?? 0;
        const active = kpi.active ?? 0;
        const wonPct    = total > 0 ? Math.round(won / total * 100) : 0;
        const activePct = total > 0 ? Math.round(active / total * 100) : 0;

        return (
          <div className="space-y-5">

            {/* ── KPI Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                label="Total Leads"
                value={total}
                sub="in selected period"
                badge={`${kpi.conv_pct ?? 0}% conv`}
                badgeColor="purple"
              />
              <KpiCard
                label="Won"
                value={won}
                sub={won > 0 ? `${kpi.avg_days_to_close ?? 0} days avg to close` : 'no wins yet'}
                badgeColor="green"
              />
              <KpiCard
                label="Conv. Rate"
                value={`${kpi.conv_pct ?? 0}%`}
                sub={`${won} of ${total} leads converted`}
                badgeColor="orange"
              />
              <KpiCard
                label="Avg Days to Win"
                value={`${kpi.avg_days_to_close ?? 0}d`}
                sub="from creation to won stage"
                badgeColor="blue"
              />
              <KpiCard
                label="Active"
                value={active}
                sub="leads not yet won"
                badgeColor="amber"
              />
            </div>

            {/* ── Lead Breakdown ── */}
            {total > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-bold text-gray-700">Lead Breakdown</h3>
                  <span className="text-[12px] text-gray-400">{total} total</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {wonPct > 0    && <div style={{ width: `${wonPct}%`,    background: '#10b981' }} className="transition-all duration-700 rounded-l-full" title={`Won ${won}`} />}
                  {activePct > 0 && <div style={{ width: `${activePct}%`, background: '#6366f1' }} className="transition-all duration-700" title={`Active ${active}`} />}
                  <div className="flex-1 bg-gray-100 rounded-r-full" />
                </div>
                <div className="flex items-center gap-5 mt-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[11px] text-gray-500">Won {wonPct}% <span className="text-gray-400">({won})</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                    <span className="text-[11px] text-gray-500">Active {activePct}% <span className="text-gray-400">({active})</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="text-[11px] text-gray-500">Other <span className="text-gray-400">({Math.max(total - won - active, 0)})</span></span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Trend + Stage Funnel ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <Card title="New Leads vs Won" sub="Monthly trend" className="lg:col-span-3">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-violet-500 rounded" />
                    <span className="text-[11px] text-gray-500">New Leads</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                    <span className="text-[11px] text-gray-500">Won</span>
                  </div>
                </div>
                <TrendChart winLoss={data.win_loss} />
              </Card>

              <Card title="Stage Funnel" sub="Leads per stage · idle days" className="lg:col-span-2">
                <StageFunnel stages={data.stages} />
              </Card>
            </div>

            {/* ── Lead Inflow + Sources ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <Card title="Lead Inflow" sub="Daily lead volume" className="lg:col-span-2">
                <LeadFlowChart flow={data.lead_flow} />
              </Card>
              <Card title="Lead Sources" sub="Total leads and conversion by source" className="lg:col-span-3">
                <SourceTable sources={data.sources} />
              </Card>
            </div>

            {/* ── Staff + Follow-ups summary ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card title="Staff Performance" sub="Leads assigned, won, and conversion" className="lg:col-span-2">
                <StaffTable staff={data.staff} />
              </Card>

              {/* Follow-up summary numbers */}
              <Card title="Follow-up Health">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total', value: data.followups?.total ?? 0, color: 'text-gray-800', bg: 'bg-gray-50' },
                    { label: 'Completed', value: data.followups?.completed ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Pending', value: data.followups?.pending ?? 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Overdue', value: data.followups?.overdue ?? 0, color: 'text-red-600', bg: 'bg-red-50' },
                  ].map(item => (
                    <div key={item.label} className={`${item.bg} rounded-xl p-3`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{item.label}</p>
                      <p className={`text-[28px] font-black ${item.color} leading-none`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                {(data.followups?.total ?? 0) > 0 && (
                  <div className="mt-4">
                    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                      <div style={{ width: `${Math.round((data.followups.completed / data.followups.total) * 100)}%` }} className="bg-emerald-500 transition-all" />
                      <div style={{ width: `${Math.round(((data.followups.pending - data.followups.overdue) / data.followups.total) * 100)}%` }} className="bg-blue-400 transition-all" />
                      <div style={{ width: `${Math.round((data.followups.overdue / data.followups.total) * 100)}%` }} className="bg-red-400 transition-all" />
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* ── Alerts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card title="Idle Leads" sub="No activity in 7+ days">
                <IdleLeads stale={data.stale} />
              </Card>
              <Card title="Overdue Follow-ups" sub="Past due date, not completed">
                <OverdueList followups={data.followups} />
              </Card>
            </div>

          </div>
        );
      })()}
    </div>
  );
}
