import { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, CheckCircle2, Target, Clock, Users, RefreshCw,
  ChevronDown, CalendarClock,
} from 'lucide-react';
import {
  ComposedChart, Bar, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUserLevel } from '@/hooks/useUserLevel';

// ── Types ─────────────────────────────────────────────────────────────────────
interface KpiShape {
  total_leads: number; won: number; active: number;
  conv_pct: number; avg_days_to_close: number;
}
interface StageRow    { stage_name: string; stage_order: number; is_won: boolean; lead_count: number; avg_days: number; }
interface SourceRow   { source: string; total: number; contacted: number; won: number; conv_pct: number; }
interface WinLossRow  { month: string; new_leads: number; won: number; }
interface StaffRow    { id: string; name: string; assigned: number; contacted: number; won: number; followups: number; conv_pct: number; contact_pct: number; }
interface OverdueRow  { lead_name: string; lead_id?: string; staff_name?: string; title?: string; due_at: string; overdue_days: number; }
interface FuSummary   { total: number; completed: number; pending: number; overdue: number; overdue_list: OverdueRow[]; }
interface StaleShape  { stale_count: number; max_days: number; list: { id: string; name: string; stage_name: string; assigned_name: string; days_stale: number }[]; }

interface PipelineData {
  kpi:       KpiShape;
  stages:    StageRow[];
  sources:   SourceRow[];
  lead_flow: { day: string; count: number }[];
  win_loss:  WinLossRow[];
  quality:   { quality: string; count: number }[];
  staff:     StaffRow[];
  followups: FuSummary;
  stale:     StaleShape;
  automation: { id: string; name: string; total: number; completed: number; failed: number; leads_enrolled: number }[];
  tags:      { name: string; color: string; total: number; won: number; conv_pct: number }[];
}

interface StaffData {
  kpi:          KpiShape;
  stages:       StageRow[];
  sources:      { source: string; total: number; won: number; conv_pct: number }[];
  win_loss:     WinLossRow[];
  overdue_list: OverdueRow[];
  followups:    { total: number; completed: number; pending: number; overdue: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PERIODS = [
  { value: 'yesterday',    label: 'Yesterday'    },
  { value: 'today',        label: 'Today'        },
  { value: 'this_week',    label: 'This Week'    },
  { value: 'this_month',   label: 'This Month'   },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'all_time',     label: 'All Time'     },
  { value: 'custom',       label: 'Custom'       },
];

const SOURCE_COLORS = ['#ea580c','#6366f1','#3b82f6','#10b981','#f59e0b','#06b6d4','#8b5cf6','#f43f5e'];
const STAGE_COLORS  = ['#6366f1','#3b82f6','#06b6d4','#8b5cf6','#f59e0b','#ea580c','#f43f5e','#84cc16'];

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-5 h-5 animate-spin text-[#c2410c]" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center justify-center h-[120px] text-[13px] text-[#9a8a7a]">{text}</div>;
}

// Period Filter
function PeriodFilter({ period, onChange, from, to, onFrom, onTo }: {
  period: string; onChange: (v: string) => void;
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => onChange(p.value)}
            className={cn(
              'text-[12px] font-semibold px-3.5 py-1.5 rounded-lg border transition-all',
              period === p.value
                ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-sm'
                : 'bg-white text-[#7a6b5c] border-black/10 hover:border-[#ea580c]/40 hover:text-[#ea580c]',
            )}>
            {p.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
            className="border border-black/10 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#ea580c] transition-colors bg-white" />
          <span className="text-[12px] text-[#9a8a7a] font-medium">to</span>
          <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
            className="border border-black/10 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#ea580c] transition-colors bg-white" />
        </div>
      )}
    </div>
  );
}

// KPI Card
function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  const body = (
    <div className="min-w-0 flex-1">
      <p className={cn('text-[11px] truncate', accent ? 'opacity-75 text-white' : 'text-[#7a6b5c]')}>{label}</p>
      <h3 className={cn('font-bold text-[24px] leading-tight tracking-tight', accent ? 'text-white' : 'text-[#1c1410]')}>
        {value}
      </h3>
      {sub && <p className={cn('text-[10px] mt-0.5 truncate', accent ? 'opacity-65 text-white' : 'text-[#9a8a7a]')}>{sub}</p>}
    </div>
  );
  if (accent) return (
    <div className="rounded-xl px-4 py-3.5 flex items-center gap-3"
      style={{ background: 'linear-gradient(135deg,#c2410c 0%,#ea580c 55%,#f97316 100%)', boxShadow: '0 4px 20px rgba(234,88,12,0.25)' }}>
      <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-white" />
      </div>
      {body}
    </div>
  );
  return (
    <div className="bg-white rounded-xl px-4 py-3.5 flex items-center gap-3 border border-black/5 shadow-sm">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      {body}
    </div>
  );
}

// Section card
function Card({ title, sub, children, className }: {
  title: string; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden', className)}>
      <div className="px-5 py-4 border-b border-black/5">
        <p className="text-[14px] font-bold text-[#1c1410]">{title}</p>
        {sub && <p className="text-[11px] text-[#9a8a7a] mt-0.5">{sub}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// Trend chart — Bar (new leads, blue) + Area (won, orange)
function TrendChart({ data }: { data: WinLossRow[] }) {
  if (!data.length) return <EmptyState text="No trend data for this period" />;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9a8a7a' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9a8a7a' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f0ebe5', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="new_leads" name="New Leads" fill="#bfdbfe" radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Area dataKey="won" name="Won" type="monotone" fill="rgba(234,88,12,0.12)" stroke="#ea580c" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Horizontal bar list (sources, staff, stages)
function HBarList({ items, getLabel, getRight, getWidth, getColor, avatar }: {
  items: any[];
  getLabel:  (item: any) => string;
  getRight?: (item: any) => React.ReactNode;
  getWidth:  (item: any) => number;
  getColor?: (item: any, i: number) => string;
  avatar?:   (item: any) => string;
}) {
  if (!items.length) return <EmptyState text="No data" />;
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item, i) => {
        const color = getColor ? getColor(item, i) : '#ea580c';
        return (
          <div key={i} className="flex items-center gap-2.5">
            {avatar && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${color}18` }}>
                <span className="text-[10px] font-bold" style={{ color }}>
                  {avatar(item).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#1c1410] truncate">{getLabel(item)}</p>
              <div className="mt-0.5">
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.max(getWidth(item), 2)}%`, background: color, minWidth: 4 }} />
              </div>
            </div>
            {getRight && <div className="shrink-0 text-right">{getRight(item)}</div>}
          </div>
        );
      })}
    </div>
  );
}

// Stage funnel with drop-off
function StageFunnel({ stages }: { stages: StageRow[] }) {
  if (!stages.length) return <EmptyState text="No stage data" />;
  const maxCount = Math.max(...stages.map((s) => s.lead_count), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((stage, i) => {
        const prev = stages[i - 1];
        const dropPct = prev && prev.lead_count > 0
          ? Math.round((1 - stage.lead_count / prev.lead_count) * 100) : null;
        const barW = Math.max(Math.round((stage.lead_count / maxCount) * 100), stage.lead_count > 0 ? 3 : 0);
        const color = stage.is_won ? '#10b981' : STAGE_COLORS[i % STAGE_COLORS.length];
        const idle = stage.avg_days ?? 0;
        const [idleBg, idleColor] = idle > 7 ? ['#fef2f2','#ef4444'] : idle > 2 ? ['#fefce8','#ca8a04'] : ['#f0fdf4','#16a34a'];
        return (
          <div key={stage.stage_name}>
            {dropPct !== null && (
              <div className="flex items-center gap-1.5 my-1 pl-1">
                <div className="w-px h-3 bg-[#e5d5c5]" />
                <span className="text-[10px] text-[#b0a090] font-medium">{dropPct}% drop-off</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-[#4a3a2a] w-[90px] shrink-0 truncate">{stage.stage_name}</span>
              <div className="flex-1 bg-[#f4efe9] rounded-full h-7 overflow-hidden">
                <div className="h-full rounded-full flex items-center justify-end pr-2.5 transition-all duration-500"
                  style={{ width: `${barW}%`, background: color }}>
                  {barW > 14 && <span className="text-[11px] font-bold text-white">{stage.lead_count}</span>}
                </div>
              </div>
              {barW <= 14 && <span className="text-[12px] font-bold text-[#1c1410] w-5 text-right">{stage.lead_count}</span>}
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0"
                style={{ background: stage.is_won ? '#f0fdf4' : idleBg, color: stage.is_won ? '#16a34a' : idleColor }}>
                {stage.is_won ? 'Won ✓' : `${idle}d idle`}
              </span>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-[#c0b0a0] mt-1 pt-2 border-t border-black/[0.04]">
        Idle = avg days since last activity for leads in this stage
      </p>
    </div>
  );
}

// Lead breakdown bar
function LeadBreakdown({ total, won, active }: { total: number; won: number; active: number }) {
  if (!total) return null;
  const wonPct    = Math.round((won / total) * 100);
  const activePct = Math.round((active / total) * 100);
  const lostPct   = Math.max(100 - wonPct - activePct, 0);
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-bold text-[#1c1410]">Lead Breakdown</p>
        <span className="text-[11px] text-[#9a8a7a]">{total} total leads</span>
      </div>
      <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5">
        {wonPct > 0    && <div style={{ width: `${wonPct}%`,    background: '#10b981' }} className="transition-all duration-700" />}
        {activePct > 0 && <div style={{ width: `${activePct}%`, background: '#6366f1' }} className="transition-all duration-700" />}
        {lostPct > 0   && <div style={{ width: `${lostPct}%`,   background: '#f4efe9' }} className="transition-all duration-700" />}
      </div>
      <div className="flex items-center gap-4 mt-2.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span className="text-[11px] text-[#9a8a7a]">Won {wonPct}% ({won})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
          <span className="text-[11px] text-[#9a8a7a]">Active {activePct}% ({active})</span>
        </div>
        {lostPct > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#e5d5c5]" />
            <span className="text-[11px] text-[#9a8a7a]">Other {lostPct}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Overdue list
function OverdueList({ items }: { items: OverdueRow[] }) {
  if (!items.length) return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <CheckCircle2 className="w-8 h-8 text-[#10b981]" />
      <p className="text-[13px] font-semibold text-[#10b981]">No overdue follow-ups</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-[#fefce8] rounded-xl border border-[#fef08a]">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#1c1410] truncate">{item.lead_name}</p>
            <p className="text-[10px] text-[#9a8a7a] mt-0.5">{item.staff_name ?? item.title ?? ''}</p>
          </div>
          <span className="text-[11px] font-bold text-[#ca8a04] shrink-0 ml-3 bg-white px-2 py-1 rounded-lg border border-[#fde047]">
            {item.overdue_days}d late
          </span>
        </div>
      ))}
    </div>
  );
}

// Stale/idle leads list
function StaleList({ stale }: { stale: StaleShape }) {
  if (!stale?.stale_count) return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <CheckCircle2 className="w-8 h-8 text-[#10b981]" />
      <p className="text-[13px] font-semibold text-[#10b981]">All leads active</p>
      <p className="text-[11px] text-[#9a8a7a]">No leads stuck for 7+ days</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-[#9a8a7a] mb-1">{stale.stale_count} leads stuck · max {stale.max_days}d</p>
      {stale.list?.map((l, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-[#fef2f2] rounded-xl border border-[#fee2e2]">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#1c1410] truncate">{l.name}</p>
            <p className="text-[10px] text-[#9a8a7a] mt-0.5">{l.stage_name ?? '—'} · {l.assigned_name ?? 'Unassigned'}</p>
          </div>
          <span className="text-[11px] font-bold text-[#ef4444] shrink-0 ml-3 bg-white px-2 py-1 rounded-lg border border-[#fecaca]">
            {l.days_stale}d
          </span>
        </div>
      ))}
    </div>
  );
}

// Follow-up summary 4-box
function FollowupSummary({ fu }: { fu: { total: number; completed: number; pending: number; overdue: number } }) {
  const items = [
    { label: 'Total',     value: fu.total ?? 0,     color: '#6366f1' },
    { label: 'Completed', value: fu.completed ?? 0, color: '#10b981' },
    { label: 'Pending',   value: fu.pending ?? 0,   color: '#f59e0b' },
    { label: 'Overdue',   value: fu.overdue ?? 0,   color: '#ef4444' },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map(({ label, value, color }) => (
        <div key={label} className="text-center p-3 rounded-xl" style={{ background: `${color}0f` }}>
          <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
          <p className="text-[11px] text-[#9a8a7a] mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// Pipeline dropdown
function PipelineDropdown({ pipelines, selected, onChange }: {
  pipelines: { id: string; name: string }[];
  selected: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = pipelines.find((p) => p.id === selected)?.name ?? 'Select Pipeline';

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-white border border-black/10 rounded-xl px-4 py-2 text-[13px] font-semibold text-[#1c1410] hover:border-primary/40 transition-colors min-w-[180px] shadow-sm">
        <span className="flex-1 text-left truncate">{name}</span>
        <ChevronDown className={cn('w-4 h-4 text-[#9e8e7e] shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 min-w-[200px] bg-white border border-black/8 rounded-xl shadow-xl z-50 py-1.5 max-h-64 overflow-y-auto">
          {pipelines.map((pl) => (
            <button key={pl.id} onClick={() => { onChange(pl.id); setOpen(false); }}
              className={cn('w-full text-left px-4 py-2.5 text-[13px] transition-colors',
                pl.id === selected ? 'bg-primary/8 text-primary font-semibold' : 'text-[#1c1410] hover:bg-[#faf8f6] font-medium')}>
              {pl.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Owner Report ──────────────────────────────────────────────────────────────
function OwnerReport() {
  const [pipelines, setPipelines]   = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [period, setPeriod]         = useState('this_month');
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');
  const [data, setData]             = useState<PipelineData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [plLoading, setPlLoading]   = useState(true);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/api/reports/pipelines')
      .then((rows) => { setPipelines(rows); if (rows.length) setPipelineId(rows[0].id); })
      .catch(() => toast.error('Failed to load pipelines'))
      .finally(() => setPlLoading(false));
  }, []);

  useEffect(() => {
    if (!pipelineId) return;
    if (period === 'custom' && (!from || !to)) return;
    setLoading(true); setData(null);
    const params = new URLSearchParams({ pipeline_id: pipelineId, range: period });
    if (period === 'custom') { params.set('from', from); params.set('to', to); }
    api.get<PipelineData>(`/api/reports/pipeline-analytics?${params}`)
      .then(setData).catch(() => toast.error('Failed to load analytics')).finally(() => setLoading(false));
  }, [pipelineId, period, from, to]);

  const maxSource = data ? Math.max(...data.sources.map((s) => s.total), 1) : 1;
  const maxStaff  = data ? Math.max(...data.staff.map((s) => s.assigned), 1) : 1;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-bold text-[#1c1410]">Business Analytics</h1>
          <p className="text-[12px] text-[#9a8a7a] mt-0.5">Full pipeline performance · owner view</p>
        </div>
        {!plLoading && pipelines.length > 0 && (
          <PipelineDropdown pipelines={pipelines} selected={pipelineId} onChange={setPipelineId} />
        )}
      </div>

      <PeriodFilter period={period} onChange={setPeriod} from={from} to={to} onFrom={setFrom} onTo={setTo} />

      {(plLoading || loading) && <Spinner />}
      {!plLoading && !loading && pipelines.length === 0 && (
        <div className="text-center py-20 text-[13px] text-[#9a8a7a]">No pipelines found. Create a pipeline first.</div>
      )}

      {data && !loading && (
        <div className="flex flex-col gap-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total Leads"     value={data.kpi.total_leads}             sub={`${data.kpi.active} active`}              icon={TrendingUp}   accent />
            <KpiCard label="Won"             value={data.kpi.won}                     sub={`${data.kpi.conv_pct}% conversion`}       icon={CheckCircle2} />
            <KpiCard label="Active Leads"    value={data.kpi.active}                  sub="Not yet in a won stage"                   icon={Users} />
            <KpiCard label="Avg Days to Win" value={`${data.kpi.avg_days_to_close}d`} sub="From lead creation to won"                icon={Clock} />
          </div>

          {/* Breakdown bar */}
          <LeadBreakdown total={data.kpi.total_leads} won={data.kpi.won} active={data.kpi.active} />

          {/* Trend + Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card title="New Leads vs Won — Monthly" sub="Volume trend over the selected period" className="lg:col-span-3">
              <TrendChart data={data.win_loss} />
            </Card>
            <Card title="Lead Sources" sub={`${data.sources.length} sources · volume & conversion`} className="lg:col-span-2">
              <HBarList
                items={data.sources}
                getLabel={(s) => s.source}
                getWidth={(s) => Math.round((s.total / maxSource) * 100)}
                getColor={(_, i) => SOURCE_COLORS[i % SOURCE_COLORS.length]}
                getRight={(s) => (
                  <>
                    <p className="text-[12px] font-bold text-[#1c1410]">{s.total}</p>
                    <p className="text-[10px] text-[#9a8a7a]">{s.conv_pct}% conv</p>
                  </>
                )}
                avatar={(s) => s.source}
              />
            </Card>
          </div>

          {/* Stage Funnel + Staff Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card title="Stage Funnel" sub="Drop-off & idle time per stage" className="lg:col-span-3">
              <StageFunnel stages={data.stages} />
            </Card>
            <Card title="Staff Leaderboard" sub="Ranked by leads assigned" className="lg:col-span-2">
              <HBarList
                items={data.staff.filter((s) => s.assigned > 0)}
                getLabel={(s) => s.name}
                getWidth={(s) => Math.round((s.assigned / maxStaff) * 100)}
                getColor={() => '#ea580c'}
                getRight={(s) => (
                  <>
                    <p className="text-[12px] font-bold text-[#1c1410]">{s.assigned} leads</p>
                    <p className="text-[10px] text-[#9a8a7a]">{s.won} won · {s.conv_pct}%</p>
                  </>
                )}
                avatar={(s) => s.name}
              />
            </Card>
          </div>

          {/* Stale + Overdue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Idle Leads" sub="No activity in 7+ days">
              <StaleList stale={data.stale} />
            </Card>
            <Card title="Overdue Follow-ups" sub="All current overdue tasks">
              <OverdueList items={data.followups.overdue_list} />
            </Card>
          </div>

          {/* Follow-up summary */}
          <Card title="Follow-up Summary" sub="Period-scoped follow-up activity">
            <FollowupSummary fu={data.followups} />
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Manager Report ────────────────────────────────────────────────────────────
function ManagerReport() {
  const [pipelines, setPipelines]   = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [period, setPeriod]         = useState('this_month');
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');
  const [data, setData]             = useState<PipelineData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [plLoading, setPlLoading]   = useState(true);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/api/reports/pipelines')
      .then((rows) => { setPipelines(rows); if (rows.length) setPipelineId(rows[0].id); })
      .catch(() => toast.error('Failed to load pipelines'))
      .finally(() => setPlLoading(false));
  }, []);

  useEffect(() => {
    if (!pipelineId) return;
    if (period === 'custom' && (!from || !to)) return;
    setLoading(true); setData(null);
    const params = new URLSearchParams({ pipeline_id: pipelineId, range: period });
    if (period === 'custom') { params.set('from', from); params.set('to', to); }
    api.get<PipelineData>(`/api/reports/pipeline-analytics?${params}`)
      .then(setData).catch(() => toast.error('Failed to load analytics')).finally(() => setLoading(false));
  }, [pipelineId, period, from, to]);

  const activeStaff = data?.staff.filter((s) => s.assigned > 0)
    .sort((a, b) => b.conv_pct - a.conv_pct) ?? [];
  const maxConvPct  = activeStaff.length ? Math.max(...activeStaff.map((s) => s.conv_pct), 1) : 1;
  const maxSource   = data ? Math.max(...data.sources.map((s) => s.total), 1) : 1;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-bold text-[#1c1410]">Team Analytics</h1>
          <p className="text-[12px] text-[#9a8a7a] mt-0.5">Your team's pipeline and performance metrics</p>
        </div>
        {!plLoading && pipelines.length > 0 && (
          <PipelineDropdown pipelines={pipelines} selected={pipelineId} onChange={setPipelineId} />
        )}
      </div>

      <PeriodFilter period={period} onChange={setPeriod} from={from} to={to} onFrom={setFrom} onTo={setTo} />

      {(plLoading || loading) && <Spinner />}

      {data && !loading && (
        <div className="flex flex-col gap-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Team Leads"      value={data.kpi.total_leads}          sub={`${data.kpi.active} active`}              icon={Users}        accent />
            <KpiCard label="Won"             value={data.kpi.won}                  sub={`${data.kpi.conv_pct}% conversion`}       icon={CheckCircle2} />
            <KpiCard label="Team Conv. Rate" value={`${data.kpi.conv_pct}%`}       sub="Leads converted to won stage"             icon={Target} />
            <KpiCard label="Overdue Tasks"   value={data.followups.overdue ?? 0}   sub="Follow-ups past due date"                 icon={CalendarClock} />
          </div>

          {/* Trend + Staff Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card title="Team Monthly Trend" sub="New leads vs won over time" className="lg:col-span-3">
              <TrendChart data={data.win_loss} />
            </Card>
            <Card title="Staff Performance" sub="Ranked by conversion rate" className="lg:col-span-2">
              <HBarList
                items={activeStaff}
                getLabel={(s) => s.name}
                getWidth={(s) => Math.round((s.conv_pct / maxConvPct) * 100)}
                getColor={() => '#ea580c'}
                getRight={(s) => (
                  <>
                    <p className="text-[12px] font-bold text-[#1c1410]">{s.conv_pct}%</p>
                    <p className="text-[10px] text-[#9a8a7a]">{s.won}/{s.assigned} won</p>
                  </>
                )}
                avatar={(s) => s.name}
              />
            </Card>
          </div>

          {/* Stage Funnel + Overdue */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card title="Stage Funnel" sub="Where team leads are and drop-off rates" className="lg:col-span-3">
              <StageFunnel stages={data.stages} />
            </Card>
            <Card title="Overdue Follow-ups" sub="Team tasks past due date" className="lg:col-span-2">
              <OverdueList items={data.followups.overdue_list} />
            </Card>
          </div>

          {/* Sources + Follow-up summary */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card title="Lead Sources" sub="Where team leads are coming from" className="lg:col-span-2">
              <HBarList
                items={data.sources}
                getLabel={(s) => s.source}
                getWidth={(s) => Math.round((s.total / maxSource) * 100)}
                getColor={(_, i) => SOURCE_COLORS[i % SOURCE_COLORS.length]}
                getRight={(s) => (
                  <>
                    <p className="text-[12px] font-bold text-[#1c1410]">{s.total}</p>
                    <p className="text-[10px] text-[#9a8a7a]">{s.conv_pct}% conv</p>
                  </>
                )}
                avatar={(s) => s.source}
              />
            </Card>
            <Card title="Follow-up Summary" sub="Period-scoped task breakdown" className="lg:col-span-3">
              <FollowupSummary fu={data.followups} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff Report ──────────────────────────────────────────────────────────────
function StaffReport() {
  const [period, setPeriod]   = useState('all_time');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [data, setData]       = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (period === 'custom' && (!from || !to)) return;
    setLoading(true); setData(null);
    const params = new URLSearchParams({ range: period });
    if (period === 'custom') { params.set('from', from); params.set('to', to); }
    api.get<StaffData>(`/api/reports/staff-analytics?${params}`)
      .then(setData).catch(() => toast.error('Failed to load your analytics')).finally(() => setLoading(false));
  }, [period, from, to]);

  const maxSource = data ? Math.max(...(data.sources?.map((s) => s.total) ?? [1]), 1) : 1;
  const maxStage  = data ? Math.max(...(data.stages?.map((s) => s.lead_count) ?? [1]), 1) : 1;
  const activeStages = data?.stages.filter((s) => s.lead_count > 0) ?? [];

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-[18px] font-bold text-[#1c1410]">My Performance</h1>
        <p className="text-[12px] text-[#9a8a7a] mt-0.5">Your personal lead analytics</p>
      </div>

      <PeriodFilter period={period} onChange={setPeriod} from={from} to={to} onFrom={setFrom} onTo={setTo} />

      {loading && <Spinner />}

      {data && !loading && (
        <div className="flex flex-col gap-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="My Leads"      value={data.kpi.total_leads}              sub={`${data.kpi.active} active`}               icon={TrendingUp}    accent />
            <KpiCard label="My Won"        value={data.kpi.won}                      sub={`${data.kpi.conv_pct}% conversion`}         icon={CheckCircle2} />
            <KpiCard label="Conv. Rate"    value={`${data.kpi.conv_pct}%`}           sub={`Avg ${data.kpi.avg_days_to_close}d to win`} icon={Target} />
            <KpiCard label="My Overdue"    value={data.followups.overdue ?? 0}       sub="Follow-ups past due date"                   icon={CalendarClock} />
          </div>

          {/* Breakdown bar */}
          <LeadBreakdown total={data.kpi.total_leads} won={data.kpi.won} active={data.kpi.active} />

          {/* Trend + Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card title="My Monthly Trend" sub="My leads assigned vs won" className="lg:col-span-3">
              <TrendChart data={data.win_loss} />
            </Card>
            <Card title="My Lead Sources" sub="Where my leads come from" className="lg:col-span-2">
              <HBarList
                items={data.sources}
                getLabel={(s) => s.source}
                getWidth={(s) => Math.round((s.total / maxSource) * 100)}
                getColor={(_, i) => SOURCE_COLORS[i % SOURCE_COLORS.length]}
                getRight={(s) => (
                  <>
                    <p className="text-[12px] font-bold text-[#1c1410]">{s.total}</p>
                    <p className="text-[10px] text-[#9a8a7a]">{s.conv_pct}% conv</p>
                  </>
                )}
                avatar={(s) => s.source}
              />
            </Card>
          </div>

          {/* Stage distribution + Overdue */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card title="My Stage Distribution" sub="Where my leads currently are" className="lg:col-span-3">
              {activeStages.length === 0 ? (
                <EmptyState text="No leads in any stage" />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {activeStages.map((stage, i) => {
                    const barW = Math.max(Math.round((stage.lead_count / maxStage) * 100), 3);
                    const color = stage.is_won ? '#10b981' : STAGE_COLORS[i % STAGE_COLORS.length];
                    return (
                      <div key={stage.stage_name} className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-[#4a3a2a] w-[90px] shrink-0 truncate">{stage.stage_name}</span>
                        <div className="flex-1 bg-[#f4efe9] rounded-full h-7 overflow-hidden">
                          <div className="h-full rounded-full flex items-center justify-end pr-2.5 transition-all duration-500"
                            style={{ width: `${barW}%`, background: color }}>
                            {barW > 14 && <span className="text-[11px] font-bold text-white">{stage.lead_count}</span>}
                          </div>
                        </div>
                        {barW <= 14 && <span className="text-[12px] font-bold text-[#1c1410] w-5 text-right">{stage.lead_count}</span>}
                        {stage.is_won && <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">Won ✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card title="My Overdue Follow-ups" sub="Tasks past due date" className="lg:col-span-2">
              <OverdueList items={data.overdue_list.map((o) => ({ ...o, staff_name: o.title }))} />
            </Card>
          </div>

          {/* Follow-up summary */}
          <Card title="My Follow-up Summary" sub="Period-scoped task activity">
            <FollowupSummary fu={data.followups} />
          </Card>
        </div>
      )}

      {data && !loading && data.kpi.total_leads === 0 && (
        <div className="text-center py-10 text-[13px] text-[#9a8a7a]">No leads assigned to you in this period.</div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const level = useUserLevel();
  if (level === 'staff')   return <StaffReport />;
  if (level === 'manager') return <ManagerReport />;
  return <OwnerReport />;
}
