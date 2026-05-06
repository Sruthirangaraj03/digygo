import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  ChevronDown, TrendingUp, CheckCircle2, Target, Clock,
  Users, RefreshCw, AlertTriangle, CalendarClock, BarChart2,
} from 'lucide-react';
import { useUserLevel } from '@/hooks/useUserLevel';

// ── Constants ─────────────────────────────────────────────────────────────────
const STAGE_COLORS  = ['#6366f1','#3b82f6','#06b6d4','#8b5cf6','#f59e0b','#ea580c','#f43f5e','#84cc16'];
const SOURCE_COLORS = ['#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#ea580c','#8b5cf6','#f43f5e'];

const RANGES = [
  { id: 'all_time',   label: 'All Time' },
  { id: 'this_month', label: 'This Month' },
  { id: 'this_week',  label: 'This Week' },
  { id: 'today',      label: 'Today' },
  { id: 'custom',     label: 'Custom' },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-72 text-[#9e8e7e] gap-2">
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span className="text-[13px]">Loading analytics…</span>
    </div>
  );
}

function KpiCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}>
        <Icon className="w-[18px] h-[18px]" style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9e8e7e] leading-none">{label}</p>
        <p className="text-[26px] font-bold text-[#1c1410] leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-[#9e8e7e] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Panel({
  title, accent = '#ea580c', children,
}: {
  title: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden flex flex-col">
      <div className="h-[3px] shrink-0" style={{ background: accent }} />
      <div className="px-5 py-3 border-b border-black/5 shrink-0">
        <h3 className="text-[13px] font-bold text-[#1c1410]">{title}</h3>
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

// ── Pipeline Dropdown ─────────────────────────────────────────────────────────
function PipelineDropdown({
  pipelines, selected, onChange,
}: {
  pipelines: { id: string; name: string }[];
  selected: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = pipelines.find(p => p.id === selected)?.name ?? 'Select Pipeline';

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#1c1410] hover:border-primary/40 transition-colors min-w-[180px] shadow-sm"
      >
        <span className="flex-1 text-left truncate">{name}</span>
        <ChevronDown className={`w-4 h-4 text-[#9e8e7e] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 min-w-[200px] bg-white border border-black/8 rounded-xl shadow-xl z-50 py-1.5 max-h-72 overflow-y-auto">
          {pipelines.map(pl => (
            <button
              key={pl.id}
              onClick={() => { onChange(pl.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                pl.id === selected
                  ? 'bg-primary/8 text-primary font-semibold'
                  : 'text-[#1c1410] hover:bg-[#faf8f6] font-medium'
              }`}
            >
              {pl.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stage Funnel ──────────────────────────────────────────────────────────────
function StageFunnel({ stages }: { stages: any[] }) {
  if (!stages.length) return <p className="text-[13px] text-center text-[#9e8e7e] py-8">No stage data.</p>;
  const maxCount = Math.max(...stages.map(s => s.lead_count), 1);

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const prev = stages[i - 1];
        const dropPct = prev && prev.lead_count > 0
          ? Math.round((1 - stage.lead_count / prev.lead_count) * 100)
          : null;
        const barW = Math.max(Math.round(stage.lead_count / maxCount * 100), 2);
        const color = stage.is_won ? '#10b981' : STAGE_COLORS[i % STAGE_COLORS.length];
        const idle  = stage.avg_days ?? 0;
        const [idleBg, idleText] = idle > 7
          ? ['#fef2f2', '#ef4444']
          : idle > 2
            ? ['#fefce8', '#ca8a04']
            : ['#f0fdf4', '#16a34a'];

        return (
          <div key={stage.stage_name}>
            {dropPct !== null && (
              <div className="flex items-center gap-1.5 my-1 pl-1">
                <div className="w-px h-3 bg-[#e5d5c5]" />
                <span className="text-[10px] text-[#b0a090] font-medium">{dropPct}% drop-off</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-[#4a3a2a] w-[88px] shrink-0 truncate">
                {stage.stage_name}
              </span>
              <div className="flex-1 bg-[#f4efe9] rounded-full h-7 overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2.5 transition-all duration-500"
                  style={{ width: `${barW}%`, background: color }}
                >
                  {barW > 12 && (
                    <span className="text-[11px] font-bold text-white">{stage.lead_count}</span>
                  )}
                </div>
              </div>
              {barW <= 12 && (
                <span className="text-[12px] font-bold text-[#1c1410] w-5 text-right">{stage.lead_count}</span>
              )}
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0"
                style={{ background: idleBg, color: idleText }}
              >
                {stage.is_won ? 'Won ✓' : `${idle}d idle`}
              </span>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-[#c0b0a0] mt-3 pt-2 border-t border-black/[0.04]">
        Idle = avg days since last activity for leads currently in this stage
      </p>
    </div>
  );
}

// ── Source Breakdown ──────────────────────────────────────────────────────────
function SourceBreakdown({ sources }: { sources: any[] }) {
  if (!sources.length) return <p className="text-[13px] text-center text-[#9e8e7e] py-8">No source data.</p>;
  const maxTotal = Math.max(...sources.map(s => s.total), 1);

  return (
    <div className="space-y-3.5">
      {sources.slice(0, 7).map((s, i) => {
        const barW = Math.round(s.total / maxTotal * 100);
        const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
        return (
          <div key={s.source}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[12px] font-semibold text-[#1c1410] truncate max-w-[110px]">{s.source}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-[#9e8e7e]">{s.total}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${color}18`, color }}
                >
                  {s.conv_pct}%
                </span>
              </div>
            </div>
            <div className="bg-[#f4efe9] rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barW}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Staff Leaderboard ─────────────────────────────────────────────────────────
function StaffLeaderboard({ staff }: { staff: any[] }) {
  const active = staff.filter(s => s.assigned > 0);
  if (!active.length) return <p className="text-[13px] text-center text-[#9e8e7e] py-8">No staff data.</p>;
  const maxAssigned = Math.max(...active.map(s => s.assigned), 1);

  return (
    <div className="space-y-3.5">
      {active.slice(0, 8).map(s => {
        const assignedW = Math.round(s.assigned / maxAssigned * 100);
        const wonW      = s.assigned > 0 ? Math.round(s.won / maxAssigned * 100) : 0;
        return (
          <div key={s.id}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-[#1c1410] truncate max-w-[120px]">{s.name}</span>
              <div className="flex items-center gap-2 text-[11px] shrink-0">
                <span className="text-[#9e8e7e]">{s.assigned} leads</span>
                <span className="font-bold text-[#10b981]">{s.won} won</span>
                <span className="bg-[#fde8d5] text-[#ea580c] font-bold px-1.5 py-0.5 rounded-md">
                  {s.conv_pct}%
                </span>
              </div>
            </div>
            <div className="bg-[#f4efe9] rounded-full h-5 overflow-hidden relative">
              <div
                className="h-full rounded-full absolute left-0 transition-all duration-500"
                style={{ width: `${assignedW}%`, background: '#e2e8f0' }}
              />
              <div
                className="h-full rounded-full absolute left-0 transition-all duration-500"
                style={{ width: `${wonW}%`, background: '#10b981' }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-[#c0b0a0] mt-1 pt-2 border-t border-black/[0.04]">
        Green = won · Grey = total assigned
      </p>
    </div>
  );
}

// ── Win Trend Chart ───────────────────────────────────────────────────────────
function WinTrendChart({ winLoss }: { winLoss: any[] }) {
  if (!winLoss.length) return <p className="text-[13px] text-center text-[#9e8e7e] py-8">No trend data.</p>;

  return (
    <ResponsiveContainer width="100%" height={210}>
      <ComposedChart data={winLoss} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9e8e7e' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9e8e7e' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: '12px', border: '1px solid #f0ebe5', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          labelStyle={{ fontWeight: 700, marginBottom: '4px' }}
        />
        <Area
          type="monotone" dataKey="new_leads" name="New Leads"
          stroke="#6366f1" strokeWidth={2}
          fill="url(#areaGrad)" dot={false} activeDot={{ r: 4 }}
        />
        <Line
          type="monotone" dataKey="won" name="Won"
          stroke="#10b981" strokeWidth={2.5}
          dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Idle Leads ────────────────────────────────────────────────────────────────
function IdleLeads({ stale }: { stale: any }) {
  const count = stale?.stale_count ?? 0;
  if (!count) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <CheckCircle2 className="w-9 h-9 text-[#10b981]" />
        <p className="text-[13px] font-semibold text-[#10b981]">All leads are active</p>
        <p className="text-[11px] text-[#9e8e7e]">No leads stuck for 7+ days</p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-[#9e8e7e] mb-3">
        {count} leads not updated in 7+ days · Max {stale.max_days}d stuck
      </p>
      {stale.list?.map((l: any) => (
        <div key={l.id} className="flex items-center justify-between p-3 bg-[#fef2f2] rounded-xl border border-[#fee2e2]">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1c1410] truncate">{l.name}</p>
            <p className="text-[11px] text-[#9e8e7e] mt-0.5">{l.stage_name ?? '—'} · {l.assigned_name ?? 'Unassigned'}</p>
          </div>
          <span className="text-[12px] font-bold text-[#ef4444] shrink-0 ml-3 bg-white px-2.5 py-1 rounded-lg border border-[#fecaca]">
            {l.days_stale}d
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Overdue Follow-ups ────────────────────────────────────────────────────────
function OverdueFollowups({ followups }: { followups: any }) {
  const list    = followups?.overdue_list ?? [];
  const overdue = followups?.overdue ?? 0;
  if (!overdue) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <CheckCircle2 className="w-9 h-9 text-[#10b981]" />
        <p className="text-[13px] font-semibold text-[#10b981]">No overdue follow-ups</p>
        <p className="text-[11px] text-[#9e8e7e]">Team is on top of all follow-ups</p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 bg-[#f4efe9] rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#f59e0b] transition-all"
            style={{ width: `${Math.round(overdue / (followups.total || 1) * 100)}%` }}
          />
        </div>
        <span className="text-[11px] text-[#9e8e7e] shrink-0">{overdue} of {followups.total ?? 0} overdue</span>
      </div>
      {list.slice(0, 6).map((o: any, i: number) => (
        <div key={i} className="flex items-center justify-between p-3 bg-[#fefce8] rounded-xl border border-[#fef08a]">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1c1410] truncate">{o.lead_name}</p>
            <p className="text-[11px] text-[#9e8e7e] mt-0.5">{o.staff_name ?? 'Unassigned'}</p>
          </div>
          <span className="text-[12px] font-bold text-[#ca8a04] shrink-0 ml-3 bg-white px-2.5 py-1 rounded-lg border border-[#fde047]">
            {o.overdue_days}d late
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Conversion Bar ────────────────────────────────────────────────────────────
function ConversionBar({ kpi }: { kpi: any }) {
  const total = kpi.total_leads ?? 0;
  const won   = kpi.won ?? 0;
  const active = kpi.active ?? 0;
  const lost  = Math.max(total - won - active, 0);

  if (!total) return null;

  const wonPct    = Math.round(won / total * 100);
  const activePct = Math.round(active / total * 100);
  const lostPct   = Math.max(100 - wonPct - activePct, 0);

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-[#1c1410]">Lead Breakdown</h3>
        <span className="text-[12px] text-[#9e8e7e]">{total} total leads</span>
      </div>
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {wonPct > 0    && <div style={{ width: `${wonPct}%`,    background: '#10b981' }} className="transition-all duration-700" />}
        {activePct > 0 && <div style={{ width: `${activePct}%`, background: '#6366f1' }} className="transition-all duration-700" />}
        {lostPct > 0   && <div style={{ width: `${lostPct}%`,  background: '#f4efe9' }} className="transition-all duration-700" />}
      </div>
      <div className="flex items-center gap-4 mt-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span className="text-[11px] text-[#9e8e7e]">Won {wonPct}% ({won})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
          <span className="text-[11px] text-[#9e8e7e]">Active {activePct}% ({active})</span>
        </div>
        {lost > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#e5d5c5]" />
            <span className="text-[11px] text-[#9e8e7e]">Other {lostPct}% ({lost})</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Staff Personal Report ──────────────────────────────────────────────────────
function StaffReport() {
  const [range, setRange]       = useState('all_time');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (range === 'custom' && (!fromDate || !toDate)) return;
    setLoading(true);
    setData(null);
    const params = new URLSearchParams({ range });
    if (range === 'custom') { params.set('from', fromDate); params.set('to', toDate); }
    api.get<any>(`/api/reports/staff-analytics?${params}`)
      .then(setData)
      .catch(() => toast.error('Failed to load your analytics'))
      .finally(() => setLoading(false));
  }, [range, fromDate, toDate]);

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-headline font-bold text-[17px] text-[#1c1410]">My Performance</h2>
          <p className="text-[12px] text-[#9e8e7e] mt-0.5">Your personal lead analytics</p>
        </div>
        <div className="flex gap-0.5 bg-white border border-black/8 rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                range === r.id ? 'bg-primary text-white shadow-sm' : 'text-[#7a6b5c] hover:bg-[#f5ede3]'
              }`}>{r.label}</button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-black/10 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <span className="text-[13px] text-[#9e8e7e] font-medium">to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-black/10 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      )}

      {loading && <Spinner />}

      {data && !loading && (
        <div className="space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="My Leads"        value={data.kpi.total_leads ?? 0}             color="#6366f1" icon={TrendingUp} />
            <KpiCard label="Won"             value={data.kpi.won ?? 0}                      color="#10b981" icon={CheckCircle2} />
            <KpiCard label="Conv. Rate"      value={`${data.kpi.conv_pct ?? 0}%`}           color="#ea580c" icon={Target} />
            <KpiCard label="Avg Days to Win" value={`${data.kpi.avg_days_to_close ?? 0}d`} color="#3b82f6" icon={Clock}
              sub="from creation to won" />
            <KpiCard label="Active"          value={data.kpi.active ?? 0}                   color="#f59e0b" icon={Users}
              sub="not yet in a won stage" />
          </div>

          {/* Lead Breakdown bar */}
          {(data.kpi.total_leads ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-black/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-[#1c1410]">My Lead Breakdown</h3>
                <span className="text-[12px] text-[#9e8e7e]">{data.kpi.total_leads} total</span>
              </div>
              {(() => {
                const total = data.kpi.total_leads ?? 0;
                const won   = data.kpi.won ?? 0;
                const active = data.kpi.active ?? 0;
                const wonPct    = Math.round(won / total * 100);
                const activePct = Math.round(active / total * 100);
                const lostPct   = Math.max(100 - wonPct - activePct, 0);
                return (
                  <>
                    <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                      {wonPct > 0    && <div style={{ width: `${wonPct}%`,    background: '#10b981' }} className="transition-all duration-700" />}
                      {activePct > 0 && <div style={{ width: `${activePct}%`, background: '#6366f1' }} className="transition-all duration-700" />}
                      {lostPct > 0   && <div style={{ width: `${lostPct}%`,   background: '#f4efe9' }} className="transition-all duration-700" />}
                    </div>
                    <div className="flex items-center gap-4 mt-2.5">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#10b981]" /><span className="text-[11px] text-[#9e8e7e]">Won {wonPct}% ({won})</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#6366f1]" /><span className="text-[11px] text-[#9e8e7e]">Active {activePct}% ({active})</span></div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Stages + Sources */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-3">
              <Panel title="My Leads by Stage" accent="#6366f1">
                {data.stages.length === 0
                  ? <p className="text-[13px] text-center text-[#9e8e7e] py-8">No leads yet.</p>
                  : (
                    <div className="space-y-2">
                      {data.stages.filter((s: any) => s.lead_count > 0).map((s: any, i: number) => {
                        const max = Math.max(...data.stages.map((x: any) => x.lead_count), 1);
                        const barW = Math.max(Math.round(s.lead_count / max * 100), 2);
                        const color = s.is_won ? '#10b981' : STAGE_COLORS[i % STAGE_COLORS.length];
                        return (
                          <div key={s.stage_name} className="flex items-center gap-3">
                            <span className="text-[11px] font-semibold text-[#4a3a2a] w-[88px] shrink-0 truncate">{s.stage_name}</span>
                            <div className="flex-1 bg-[#f4efe9] rounded-full h-7 overflow-hidden">
                              <div className="h-full rounded-full flex items-center justify-end pr-2.5 transition-all duration-500"
                                style={{ width: `${barW}%`, background: color }}>
                                {barW > 12 && <span className="text-[11px] font-bold text-white">{s.lead_count}</span>}
                              </div>
                            </div>
                            {barW <= 12 && <span className="text-[12px] font-bold text-[#1c1410] w-5 text-right">{s.lead_count}</span>}
                            {s.is_won && <span className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 bg-emerald-50 text-emerald-600">Won ✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )
                }
              </Panel>
            </div>
            <div className="md:col-span-2">
              <Panel title="My Lead Sources" accent="#3b82f6">
                <SourceBreakdown sources={data.sources} />
              </Panel>
            </div>
          </div>

          {/* Trend + Overdue */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="My Leads vs Won — Monthly" accent="#10b981">
              <WinTrendChart winLoss={data.win_loss} />
            </Panel>
            <Panel accent="#f59e0b" title="My Overdue Follow-ups">
              {data.overdue_list.length === 0
                ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <CheckCircle2 className="w-9 h-9 text-[#10b981]" />
                    <p className="text-[13px] font-semibold text-[#10b981]">No overdue follow-ups</p>
                    <p className="text-[11px] text-[#9e8e7e]">You're on top of everything!</p>
                  </div>
                )
                : (
                  <div className="space-y-2.5">
                    {data.overdue_list.map((o: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[#fefce8] rounded-xl border border-[#fef08a]">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#1c1410] truncate">{o.lead_name}</p>
                          <p className="text-[11px] text-[#9e8e7e] mt-0.5">{o.title}</p>
                        </div>
                        <span className="text-[12px] font-bold text-[#ca8a04] shrink-0 ml-3 bg-white px-2.5 py-1 rounded-lg border border-[#fde047]">
                          {o.overdue_days}d late
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
            </Panel>
          </div>

          {/* Follow-up summary */}
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <h3 className="text-[13px] font-bold text-[#1c1410] mb-3">My Follow-up Summary</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total',     value: data.followups.total ?? 0,     color: '#6366f1' },
                { label: 'Completed', value: data.followups.completed ?? 0, color: '#10b981' },
                { label: 'Pending',   value: data.followups.pending ?? 0,   color: '#f59e0b' },
                { label: 'Overdue',   value: data.followups.overdue ?? 0,   color: '#ef4444' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-3 rounded-xl" style={{ background: `${color}0f` }}>
                  <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
                  <p className="text-[11px] text-[#9e8e7e] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data && !loading && (data.kpi.total_leads ?? 0) === 0 && (
        <div className="text-center py-20 text-[#9e8e7e] text-[14px]">No leads assigned to you in this period.</div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const level = useUserLevel();

  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [range, setRange]           = useState('all_time');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [plLoading, setPlLoading]   = useState(true);

  useEffect(() => {
    if (level === 'staff') { setPlLoading(false); return; }
    api.get<{ id: string; name: string }[]>('/api/reports/pipelines')
      .then(rows => {
        setPipelines(rows);
        if (rows.length > 0) setPipelineId(rows[0].id);
      })
      .catch(() => toast.error('Failed to load pipelines'))
      .finally(() => setPlLoading(false));
  }, [hasAccess]);

  useEffect(() => {
    if (!pipelineId) return;
    if (range === 'custom' && (!fromDate || !toDate)) return;
    setLoading(true);
    setData(null);
    const params = new URLSearchParams({ pipeline_id: pipelineId, range });
    if (range === 'custom') { params.set('from', fromDate); params.set('to', toDate); }
    api.get<any>(`/api/reports/pipeline-analytics?${params}`)
      .then(setData)
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [pipelineId, range, fromDate, toDate]);

  const selectedName = pipelines.find(p => p.id === pipelineId)?.name ?? '';
  const viewLabel    = level === 'owner' ? 'owner view' : 'manager view';

  if (level === 'staff') return <StaffReport />;

  return (
    <div className="space-y-4 pb-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-headline font-bold text-[17px] text-[#1c1410]">Pipeline Analytics</h2>
          <p className="text-[12px] text-[#9e8e7e] mt-0.5">
            {selectedName ? `${selectedName} · ${viewLabel}` : 'Select a pipeline to view analytics'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range pills */}
          <div className="flex gap-0.5 bg-white border border-black/8 rounded-xl p-1">
            {RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                  range === r.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[#7a6b5c] hover:bg-[#f5ede3]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Pipeline dropdown */}
          {!plLoading && pipelines.length > 0 && (
            <PipelineDropdown
              pipelines={pipelines}
              selected={pipelineId}
              onChange={id => { setPipelineId(id); }}
            />
          )}
        </div>
      </div>

      {/* Custom date pickers */}
      {range === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-black/10 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-[13px] text-[#9e8e7e] font-medium">to</span>
          <input
            type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-black/10 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {(plLoading || loading) && <Spinner />}

      {!loading && !plLoading && pipelines.length === 0 && (
        <div className="text-center py-20 text-[#9e8e7e] text-sm">
          No pipelines found. Create a pipeline first.
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">

          {/* ── KPI Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total Leads"      value={data.kpi.total_leads ?? 0}              color="#6366f1" icon={TrendingUp} />
            <KpiCard label="Won"              value={data.kpi.won ?? 0}                       color="#10b981" icon={CheckCircle2} />
            <KpiCard label="Conv. Rate"       value={`${data.kpi.conv_pct ?? 0}%`}            color="#ea580c" icon={Target} />
            <KpiCard label="Avg Days to Win"  value={`${data.kpi.avg_days_to_close ?? 0}d`}  color="#3b82f6" icon={Clock}
              sub="from lead creation to won" />
            <KpiCard label="Active (Open)"    value={data.kpi.active ?? 0}                    color="#f59e0b" icon={Users}
              sub="not yet in a won stage" />
          </div>

          {/* ── Lead Breakdown Bar ── */}
          <ConversionBar kpi={data.kpi} />

          {/* ── Stage Funnel + Source Breakdown ── */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-3">
              <Panel title="Stage Funnel — Drop-off & Idle Time" accent="#6366f1">
                <StageFunnel stages={data.stages} />
              </Panel>
            </div>
            <div className="md:col-span-2">
              <Panel title="Lead Sources" accent="#3b82f6">
                <SourceBreakdown sources={data.sources} />
              </Panel>
            </div>
          </div>

          {/* ── Staff Leaderboard + Win Trend ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="Staff Leaderboard" accent="#ea580c">
              <StaffLeaderboard staff={data.staff} />
            </Panel>
            <Panel title="New Leads vs Won — Monthly Trend" accent="#10b981">
              <WinTrendChart winLoss={data.win_loss} />
            </Panel>
          </div>

          {/* ── Needs Attention ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel accent="#ef4444" title="Idle Leads — No Activity in 7+ Days">
              <IdleLeads stale={data.stale} />
            </Panel>
            <Panel accent="#f59e0b" title="Overdue Follow-ups">
              <OverdueFollowups followups={data.followups} />
            </Panel>
          </div>

        </div>
      )}
    </div>
  );
}
