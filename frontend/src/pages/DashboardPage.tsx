import { useState, useEffect, useMemo } from 'react';
import {
  Users, TrendingUp, AlertTriangle, Clock, Target, Award, Zap, CheckCircle, Star,
  PhoneOff, UserX,
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar, ComposedChart, LabelList,
} from 'recharts';
import {
  formatDistanceToNow, format, subDays, startOfDay, isToday, isPast,
  addDays, getDaysInMonth, subMonths, startOfMonth,
} from 'date-fns';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Analytics {
  total_leads:          number;
  leads_this_month:     number;
  leads_last_month:     number;
  growth_pct:           number;
  range_leads:          number;
  range:                string;
  range_label:          string;
  converted_leads:      number;
  conversion_rate:      number;
  stale_leads:          number;
  overdue_followups:    number;
  leads_not_contacted:  number;
  best_source:          { source: string; count: number } | null;
  source_breakdown:     Array<{ source: string; count: number }>;
  source_conversion:    Array<{ source: string; total: number; won: number; pct_of_total: number; conv_pct: number }>;
  pipeline_funnels:     Array<{ id: string; name: string; stages: Array<{ stage: string; count: number; is_won: boolean }> }>;
  staff_leaderboard:    Array<{ id: string; name: string; assigned_count: number; converted: number; new_in_range: number; conversion_rate_pct: number }>;
  staff_accountability: Array<{ id: string; name: string; assigned: number; contacted: number; won: number; contacted_pct: number; conv_pct: number }>;
  today_followups:      Array<{ id: string; lead_name: string; due_at: string; title: string; description: string; lead_id: string }>;
  stale_leads_list:     Array<{ id: string; name: string; source: string; stage: string; assigned_name: string; updated_at: string; days_stale: number }>;
  untouched_leads:      Array<{ id: string; name: string; source: string; stage: string; assigned_name: string; created_at: string; hours_waiting: number }>;
  role:                 string;
}

function sourceLabel(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  if (raw === 'meta_form')                       return 'Meta Forms';
  if (raw === 'whatsapp' || raw === 'WhatsApp')  return 'WhatsApp';
  if (raw === 'calendar_booking')                return 'Calendar Booking';
  if (raw.startsWith('calendar:'))               return raw.slice(9);
  if (raw.startsWith('form:'))                   return raw.slice(5);
  return raw;
}

const FILTER_PRESETS = [
  { value: 'yesterday',    label: 'Yesterday'    },
  { value: 'today',        label: 'Today'        },
  { value: 'this_week',    label: 'This Week'    },
  { value: 'this_month',   label: 'This Month'   },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'custom',       label: 'Custom'       },
];

// ── Compact horizontal Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false, warn = false, danger = false, onClick }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean; warn?: boolean; danger?: boolean;
  onClick?: () => void;
}) {
  const clickClass = onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-150' : '';

  if (accent) return (
    <div
      onClick={onClick}
      className={`rounded-xl px-4 py-3 flex items-center gap-3 text-white ${clickClass}`}
      style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 20px rgba(234,88,12,0.25)' }}
    >
      <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] opacity-75 truncate">{label}</p>
        <h3 className="font-headline text-[22px] font-bold leading-tight tracking-tight">{value}</h3>
        {sub && <p className="text-[10px] opacity-65 truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (danger) return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl px-4 py-3 flex items-center gap-3 card-shadow border border-red-200 ${clickClass}`}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-50">
        <Icon className="w-4 h-4 text-red-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-red-400 truncate">{label}</p>
        <h3 className="font-headline text-[22px] font-bold text-red-600 leading-tight tracking-tight">{value}</h3>
        {sub && <p className="text-[10px] text-red-400 truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl px-4 py-3 flex items-center gap-3 card-shadow border ${warn ? 'border-amber-200' : 'border-black/5'} ${clickClass}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${warn ? 'bg-amber-50' : 'bg-primary/10'}`}>
        <Icon className={`w-4 h-4 ${warn ? 'text-amber-500' : 'text-primary'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[#7a6b5c] truncate">{label}</p>
        <h3 className="font-headline text-[22px] font-bold text-[#1c1410] leading-tight tracking-tight">{value}</h3>
        {sub && <p className="text-[10px] text-[#9a8a7a] truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const PIE_COLORS = ['#ea580c', '#3b82f6', '#10b981', '#7c3aed', '#f59e0b', '#ec4899', '#0ea5e9', '#14b8a6'];

// ── Date Filter Bar ───────────────────────────────────────────────────────────
function DateFilterBar({ range, setRange, customFrom, setCustomFrom, customTo, setCustomTo }: {
  range: string; setRange: (r: string) => void;
  customFrom: string; setCustomFrom: (v: string) => void;
  customTo: string;   setCustomTo:   (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTER_PRESETS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors border ${
            range === opt.value
              ? 'bg-primary text-white border-primary shadow-sm'
              : 'bg-white text-[#1c1410] border-black/10 hover:border-primary/40'
          }`}
        >
          {opt.label}
        </button>
      ))}
      {range === 'custom' && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="text-[12px] border border-black/10 rounded-lg px-2 py-1.5 outline-none focus:border-primary/40 bg-white cursor-pointer"
          />
          <span className="text-[11px] text-[#7a6b5c] font-medium">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className="text-[12px] border border-black/10 rounded-lg px-2 py-1.5 outline-none focus:border-primary/40 bg-white cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}

// ── Pipeline Funnel Card ──────────────────────────────────────────────────────
function FunnelCard({ funnels, selectedId, setSelectedId }: {
  funnels: Array<{ id: string; name: string; stages: Array<{ stage: string; count: number; is_won: boolean }> }>;
  selectedId: string;
  setSelectedId: (id: string) => void;
}) {
  const list = funnels ?? [];
  const activeFunnel = list.find((f) => f.id === selectedId) ?? list[0] ?? null;
  const hasWon = (activeFunnel?.stages ?? []).some((s) => s.is_won);

  return (
    <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Pipeline Funnel</h3>
        {list.length > 1 && (
          <select
            value={activeFunnel?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="text-[12px] font-semibold text-[#1c1410] border border-black/10 rounded-lg px-2 py-1 bg-white outline-none focus:border-primary/40 cursor-pointer"
          >
            {list.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>
      {!hasWon && activeFunnel && (
        <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 mb-2">
          No "Won" stage — <a href="/lead-management/overview" className="font-semibold underline">set one</a> to track conversions.
        </p>
      )}
      {!activeFunnel
        ? <p className="text-[13px] text-[#b09e8d] mt-2">No pipeline data yet.</p>
        : (
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={Math.max(100, activeFunnel.stages.length * 32)}>
              <BarChart data={activeFunnel.stages} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: '#8a7c6e' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', background: '#1c1410', color: '#fff', fontSize: 11 }} />
                <Bar dataKey="count" radius={[0, 5, 5, 0]}>
                  {activeFunnel.stages.map((e, i) => (
                    <Cell key={i} fill={e.is_won ? '#10b981' : '#ea580c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
    </div>
  );
}

// ── Today's Follow-ups mini widget ────────────────────────────────────────────
function FollowupsWidget({ followups }: { followups: Analytics['today_followups'] }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Today's Follow-ups</h3>
        <button
          onClick={() => navigate('/lead-management/followups')}
          className="text-[11px] text-primary font-semibold hover:opacity-70 transition-opacity"
        >
          View all →
        </button>
      </div>
      {followups.length === 0
        ? <p className="text-[12px] text-[#b09e8d] mt-2">No follow-ups due today.</p>
        : (
          <div className="space-y-1 overflow-y-auto flex-1" style={{ maxHeight: 260 }}>
            {followups.map((f) => {
              const overdue = isPast(new Date(f.due_at)) && !isToday(new Date(f.due_at));
              return (
                <div
                  key={f.id}
                  onClick={() => navigate(`/leads?lead=${f.lead_id}`)}
                  className="flex items-start gap-2 px-2.5 py-2 rounded-xl hover:bg-[#faf8f6] cursor-pointer transition-colors"
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${overdue ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#1c1410] truncate">{f.lead_name}</p>
                    <p className="text-[10px] text-[#8a7c6e] truncate">{f.title}</p>
                  </div>
                  <span className={`text-[10px] shrink-0 font-medium whitespace-nowrap ${overdue ? 'text-red-500' : 'text-[#8a7c6e]'}`}>
                    {formatDistanceToNow(new Date(f.due_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ── Pipeline funnel with drop-off indicators ──────────────────────────────────
function PipelineFunnelVisual({ funnels }: { funnels: Analytics['pipeline_funnels'] }) {
  const [selectedId, setSelectedId] = useState('');
  const list = funnels ?? [];
  const pipeline = list.find((f) => f.id === selectedId) ?? list[0] ?? null;
  if (!pipeline) return <p className="text-[12px] text-[#b09e8d]">No pipeline data.</p>;

  const first = pipeline.stages[0]?.count ?? 1;

  return (
    <div>
      {list.length > 1 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                pipeline.id === p.id ? 'bg-primary text-white' : 'bg-[#faf8f6] text-[#7a6b5c] hover:bg-primary/10'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        {pipeline.stages.map((stage, i) => {
          const barPct  = first === 0 ? 0 : Math.max((stage.count / first) * 100, stage.count > 0 ? 4 : 0);
          const ofFirst = first === 0 ? 0 : Math.round((stage.count / first) * 100);
          const prev    = pipeline.stages[i - 1];
          const dropped = prev ? prev.count - stage.count : 0;
          const dropPct = prev && prev.count > 0 ? Math.round((dropped / prev.count) * 100) : 0;
          return (
            <div key={i}>
              {i > 0 && (
                <div className="ml-[84px] py-0.5">
                  {dropped > 0
                    ? <span className="text-[9px] font-semibold text-red-400">↓ {dropped} left ({dropPct}% drop-off)</span>
                    : <span className="text-[9px] text-[#c0b0a0]">↓</span>}
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#7a6b5c] font-medium w-20 shrink-0 text-right truncate">{stage.stage}</span>
                <div className="flex-1 h-7 bg-[#f0ece8] rounded-lg overflow-hidden">
                  <div
                    className={`h-full rounded-lg flex items-center justify-end pr-2 ${stage.is_won ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${barPct}%`, minWidth: stage.count > 0 ? '2rem' : '0' }}
                  >
                    {stage.count > 0 && <span className="text-white text-[11px] font-bold">{stage.count}</span>}
                  </div>
                </div>
                <span className="text-[10px] text-[#9a8a7a] w-8 shrink-0 text-right">{ofFirst}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Management Dashboard (Owner view) ─────────────────────────────────────────
function ManagementDashboard({ analytics, lineData }: {
  analytics: Analytics; lineData: any[];
}) {
  const navigate = useNavigate();

  const growth    = analytics.growth_pct;
  const growthSub = growth > 0 ? `↑ +${growth}% vs last month` : growth < 0 ? `↓ ${growth}% vs last month` : 'Same as last month';
  const hasWon    = (analytics.pipeline_funnels ?? []).flatMap((p) => p.stages ?? []).some((s) => s.is_won);

  // Source conversion data for charts
  const srcData = (analytics.source_conversion ?? []).slice(0, 8).map((s) => ({
    name:     sourceLabel(s.source).slice(0, 11),
    fullName: sourceLabel(s.source),
    total:    s.total,
    conv:     s.conv_pct,
    pct:      s.pct_of_total,
  }));
  const grandTotal = (analytics.source_conversion ?? []).reduce((sum, s) => sum + s.total, 0);

  // Stale leads list & untouched
  const staleList    = analytics.stale_leads_list    ?? [];
  const untouchedList = analytics.untouched_leads    ?? [];
  const accountability = analytics.staff_accountability ?? [];

  return (
    <div className="space-y-5">

      {/* ── 1. KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="New Leads" value={analytics.range_leads ?? 0}
          sub={`${analytics.range_label} · ${growthSub}`} icon={Users} accent
          onClick={() => navigate('/leads')}
        />
        <StatCard
          label="Not Yet Contacted" value={analytics.leads_not_contacted ?? 0}
          sub={analytics.leads_not_contacted > 0 ? 'Act now — revenue leaking' : 'All leads contacted ✓'}
          icon={PhoneOff}
          danger={(analytics.leads_not_contacted ?? 0) > 0}
          onClick={() => navigate('/leads')}
        />
        <StatCard
          label="Overdue Follow-ups" value={analytics.overdue_followups}
          sub={analytics.overdue_followups > 0 ? 'Needs immediate action' : 'All caught up ✓'}
          icon={Clock}
          danger={analytics.overdue_followups > 0}
          onClick={() => navigate('/lead-management/followups')}
        />
        <StatCard
          label="Deals Won" value={analytics.converted_leads}
          sub={hasWon ? `${analytics.conversion_rate}% conversion rate` : 'Set a Won stage to track'}
          icon={Target}
          onClick={() => navigate('/leads?filter=converted')}
        />
        <StatCard
          label="Best Source"
          value={analytics.best_source ? sourceLabel(analytics.best_source.source) : 'N/A'}
          sub={analytics.best_source ? `${analytics.best_source.count} leads this period` : 'No data yet'}
          icon={Star}
        />
      </div>

      {/* ── 2. Lead Inflow chart (full width) ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Lead Inflow</h3>
            <p className="text-[11px] text-[#7a6b5c]">{analytics.range_label}</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#7a6b5c]">
            <span><span className="font-bold text-[#1c1410] text-[14px]">{analytics.range_leads ?? 0}</span> new leads</span>
            <span><span className="font-bold text-[#1c1410]">{analytics.total_leads}</span> total all time</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8a7c6e' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(lineData.length / 6))} />
            <YAxis tick={{ fontSize: 10, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip contentStyle={{ borderRadius: 10, border: 'none', background: '#1c1410', color: '#fff', fontSize: 11 }} />
            <Line type="monotone" dataKey="leads" stroke="#ea580c" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── 3. Pipeline Funnel + Stale Leads ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Pipeline Funnel</h3>
              <p className="text-[11px] text-[#7a6b5c]">Where leads are — and where they drop</p>
            </div>
          </div>
          <PipelineFunnelVisual funnels={analytics.pipeline_funnels} />
        </div>

        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Stale Leads</h3>
              <p className="text-[11px] text-[#7a6b5c]">No activity in 7+ days — <span className="font-bold text-red-500">{analytics.stale_leads} total</span></p>
            </div>
            <button onClick={() => navigate('/leads?filter=stale')} className="text-[11px] text-primary font-semibold hover:opacity-70">View all →</button>
          </div>
          {staleList.length === 0
            ? <p className="text-[12px] text-[#b09e8d] mt-2">No stale leads — great work!</p>
            : (
              <div className="space-y-1">
                {staleList.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => navigate(`/leads?lead=${lead.id}`)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#faf8f6] cursor-pointer transition-colors"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#1c1410] truncate">{lead.name}</p>
                      <p className="text-[10px] text-[#9a8a7a] truncate">{lead.stage ?? '—'} · {lead.assigned_name ?? 'Unassigned'}</p>
                    </div>
                    <span className="text-[10px] font-bold text-red-500 shrink-0 bg-red-50 px-1.5 py-0.5 rounded-md">{lead.days_stale}d stale</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* ── 4. Source Intelligence ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut with rich legend — every number talks */}
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <div className="mb-3">
            <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Lead Source Breakdown</h3>
            <p className="text-[11px] text-[#7a6b5c]">{grandTotal} leads · {analytics.range_label}</p>
          </div>
          {srcData.length === 0
            ? <p className="text-[12px] text-[#b09e8d]">No leads in this period.</p>
            : (
              <div className="flex flex-col gap-3">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={srcData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="total" paddingAngle={2}>
                      {srcData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: 'none', background: '#1c1410', color: '#fff', fontSize: 11 }}
                      formatter={(v: number, _: string, p: any) => [`${v} leads (${p.payload.pct}%)`, p.payload.fullName]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Rich legend — numbers talk */}
                <div className="space-y-1.5">
                  {(analytics.source_conversion ?? []).slice(0, 6).map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-[11px] font-semibold text-[#1c1410] truncate">{sourceLabel(s.source)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[11px] font-bold text-[#1c1410]">{s.total}</span>
                        <span className="text-[10px] text-[#9a8a7a]">({s.pct_of_total}%)</span>
                        {s.conv_pct > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">{s.conv_pct}% conv</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Source vs Conversion Rate — combo bar + line */}
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <div className="mb-3">
            <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Volume vs Conversion Rate</h3>
            <p className="text-[11px] text-[#7a6b5c]">Bars = lead count · Line = conversion %</p>
          </div>
          {srcData.length === 0
            ? <p className="text-[12px] text-[#b09e8d]">No leads in this period.</p>
            : (
              <ResponsiveContainer width="100%" height={210}>
                <ComposedChart data={srcData} margin={{ top: 18, right: 36, bottom: 4, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#8a7c6e' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#10b981' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" width={30} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 'none', background: '#1c1410', color: '#fff', fontSize: 11 }}
                    formatter={(val: any, name: string, p: any) =>
                      name === 'conv'
                        ? [`${val}%`, 'Conversion Rate']
                        : [`${val} leads (${p.payload.pct}% of total)`, 'Volume']
                    }
                    labelFormatter={(_: any, p: any) => p?.[0]?.payload?.fullName ?? _}
                  />
                  <Bar yAxisId="left" dataKey="total" fill="#ea580c" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="total" position="top" style={{ fontSize: 10, fill: '#1c1410', fontWeight: 700 }} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="conv" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* ── 5. Staff Accountability ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Staff Accountability</h3>
            <p className="text-[11px] text-[#7a6b5c]">All-time · Contacted = lead has at least one follow-up scheduled</p>
          </div>
        </div>
        {accountability.length === 0
          ? <p className="text-[12px] text-[#b09e8d]">No staff yet.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] text-[#b09e8d] font-semibold uppercase border-b border-black/5">
                    <th className="text-left py-2 px-2">Staff</th>
                    <th className="text-right py-2 px-2">Assigned</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap">Contacted</th>
                    <th className="text-right py-2 px-2">Won</th>
                    <th className="text-right py-2 px-2 whitespace-nowrap">Conv %</th>
                    <th className="py-2 px-2 w-28">Contact Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {accountability.map((s, i) => {
                    const contactColor = s.contacted_pct >= 70 ? 'text-emerald-600' : s.contacted_pct >= 40 ? 'text-amber-500' : 'text-red-500';
                    const contactBg    = s.contacted_pct >= 70 ? '#10b981' : s.contacted_pct >= 40 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={s.id} className="border-b border-black/[0.03] hover:bg-[#faf8f6] transition-colors">
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#c0b0a0] w-4 font-bold">#{i + 1}</span>
                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                              {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-[#1c1410] truncate">{s.name}</span>
                          </div>
                        </td>
                        <td className="text-right px-2 font-bold text-[#1c1410]">{s.assigned}</td>
                        <td className={`text-right px-2 font-bold ${contactColor}`}>
                          {s.contacted}/{s.assigned}
                          <span className="text-[10px] ml-1 font-normal">({s.contacted_pct}%)</span>
                        </td>
                        <td className="text-right px-2 font-bold text-emerald-600">{s.won}</td>
                        <td className={`text-right px-2 font-bold ${s.conv_pct >= 50 ? 'text-emerald-600' : s.conv_pct >= 20 ? 'text-amber-500' : 'text-[#9a8a7a]'}`}>
                          {s.conv_pct}%
                        </td>
                        <td className="px-2">
                          <div className="h-1.5 bg-[#f0ece8] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${s.contacted_pct}%`, background: contactBg }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* ── 6. Today's Action ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Follow-ups today */}
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Follow-ups Due Today</h3>
              <p className="text-[11px] text-[#7a6b5c]"><span className="font-bold text-[#1c1410]">{analytics.today_followups.length}</span> due · <span className="font-bold text-red-500">{analytics.overdue_followups}</span> overdue</p>
            </div>
            <button onClick={() => navigate('/lead-management/followups')} className="text-[11px] text-primary font-semibold hover:opacity-70">View all →</button>
          </div>
          {analytics.today_followups.length === 0
            ? <p className="text-[12px] text-[#b09e8d]">No follow-ups due today.</p>
            : (
              <div className="space-y-1">
                {analytics.today_followups.map((f) => {
                  const overdue = isPast(new Date(f.due_at)) && !isToday(new Date(f.due_at));
                  return (
                    <div
                      key={f.id}
                      onClick={() => navigate(`/leads?lead=${f.lead_id}`)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#faf8f6] cursor-pointer transition-colors"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${overdue ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#1c1410] truncate">{f.lead_name}</p>
                        <p className="text-[10px] text-[#9a8a7a] truncate">{f.title}</p>
                      </div>
                      <span className={`text-[10px] shrink-0 font-medium whitespace-nowrap ${overdue ? 'text-red-500' : 'text-[#8a7c6e]'}`}>
                        {formatDistanceToNow(new Date(f.due_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Untouched leads */}
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Untouched Leads</h3>
              <p className="text-[11px] text-[#7a6b5c]">Assigned but zero contact — oldest first</p>
            </div>
            <button onClick={() => navigate('/leads')} className="text-[11px] text-primary font-semibold hover:opacity-70">View all →</button>
          </div>
          {untouchedList.length === 0
            ? <p className="text-[12px] text-[#b09e8d]">No untouched leads — all being worked!</p>
            : (
              <div className="space-y-1">
                {untouchedList.map((lead) => {
                  const days = Math.floor((lead.hours_waiting ?? 0) / 24);
                  const hrs  = (lead.hours_waiting ?? 0) % 24;
                  const waitLabel = days > 0 ? `${days}d ${hrs}h waiting` : `${hrs}h waiting`;
                  return (
                    <div
                      key={lead.id}
                      onClick={() => navigate(`/leads?lead=${lead.id}`)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#faf8f6] cursor-pointer transition-colors"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#1c1410] truncate">{lead.name}</p>
                        <p className="text-[10px] text-[#9a8a7a] truncate">{sourceLabel(lead.source)} · {lead.assigned_name ?? 'Unassigned'}</p>
                      </div>
                      <span className="text-[10px] font-bold text-amber-600 shrink-0 bg-amber-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">{waitLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

// ── Manager pipeline health (cards view) ─────────────────────────────────────
function ManagerPipelineHealth({ funnels }: { funnels: Analytics['pipeline_funnels'] }) {
  const [selectedId, setSelectedId] = useState('');
  const list2 = funnels ?? [];
  const active = list2.find((f) => f.id === selectedId) ?? list2[0] ?? null;
  return (
    <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Pipeline Stage Health</h3>
        {list2.length > 1 && (
          <select
            value={active?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="text-[12px] font-semibold text-[#1c1410] border border-black/10 rounded-lg px-2 py-1 bg-white outline-none focus:border-primary/40 cursor-pointer"
          >
            {list2.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>
      {!active
        ? <p className="text-[12px] text-[#b09e8d]">No pipeline data yet.</p>
        : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {active.stages.map((s, i) => (
              <div key={i} className={`rounded-xl px-3 py-2.5 border ${s.is_won ? 'border-emerald-200 bg-emerald-50' : 'border-black/5 bg-[#faf8f6]'}`}>
                <p className="text-[10px] text-[#7a6b5c] mb-0.5 truncate">{s.stage}</p>
                <p className={`font-headline text-[20px] font-bold ${s.is_won ? 'text-emerald-600' : 'text-[#1c1410]'}`}>{s.count}</p>
                {s.is_won && <p className="text-[9px] text-emerald-500 font-semibold">Won ✓</p>}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Sales Manager Dashboard ───────────────────────────────────────────────────
function ManagerDashboard({ analytics, lineData }: { analytics: Analytics; lineData: any[] }) {
  const rangeLabel = analytics.range_label ?? 'This Period';
  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Overdue Follow-ups" value={analytics.overdue_followups} sub="Needs immediate action"       icon={Clock}         warn={analytics.overdue_followups > 0} />
        <StatCard label="Stale Leads"         value={analytics.stale_leads}       sub="No activity in 7+ days"      icon={AlertTriangle} warn={analytics.stale_leads > 0} />
        <StatCard label="Converted"           value={analytics.converted_leads}   sub={`${analytics.conversion_rate}% conversion rate`} icon={Target} accent />
        <StatCard label="New Leads"           value={analytics.range_leads ?? 0}  sub={rangeLabel}                  icon={Zap} />
      </div>

      {/* Staff table + line chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <h3 className="font-headline font-bold text-[#1c1410] text-[14px] mb-3">Team Performance</h3>
          {analytics.staff_leaderboard.length === 0
            ? <p className="text-[12px] text-[#b09e8d]">No staff yet.</p>
            : (
              <div className="space-y-0.5">
                <div className="grid grid-cols-[1fr_44px_44px_54px_40px] gap-1 text-[10px] text-[#b09e8d] font-semibold uppercase px-1.5 mb-1.5">
                  <span>Staff</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">New</span>
                  <span className="text-right">Won</span>
                  <span className="text-right">Rate</span>
                </div>
                {analytics.staff_leaderboard.map((s) => (
                  <div key={s.id} className="grid grid-cols-[1fr_44px_44px_54px_40px] gap-1 items-center px-1.5 py-1.5 rounded-lg hover:bg-[#faf8f6] transition-colors">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                        {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[12px] font-semibold text-[#1c1410] truncate">{s.name}</span>
                    </div>
                    <span className="text-[11px] text-right text-[#7a6b5c]">{s.assigned_count}</span>
                    <span className="text-[11px] text-right text-[#7a6b5c]">{s.new_in_range}</span>
                    <div className="flex items-center justify-end gap-1">
                      <Award className="w-2.5 h-2.5 text-emerald-500" />
                      <span className="text-[11px] font-bold text-emerald-600">{s.converted}</span>
                    </div>
                    <span className={`text-[10px] font-bold text-right ${s.conversion_rate_pct >= 50 ? 'text-emerald-600' : s.conversion_rate_pct >= 20 ? 'text-amber-500' : 'text-[#9a8a7a]'}`}>
                      {s.conversion_rate_pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <h3 className="font-headline font-bold text-[#1c1410] text-[14px] mb-0.5">Lead Inflow</h3>
          <p className="text-[11px] text-[#7a6b5c] mb-3">{rangeLabel}</p>
          <ResponsiveContainer width="100%" height={185}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8a7c6e' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(lineData.length / 6))} />
              <YAxis tick={{ fontSize: 10, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', background: '#1c1410', color: '#fff', fontSize: 11 }} />
              <Line type="monotone" dataKey="leads" stroke="#ea580c" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ManagerPipelineHealth funnels={analytics.pipeline_funnels} />
    </div>
  );
}

// ── Staff Dashboard ───────────────────────────────────────────────────────────
function StaffDashboard({ analytics }: { analytics: Analytics }) {
  const navigate = useNavigate();
  const todayDue = analytics.today_followups.filter((f) => isToday(new Date(f.due_at)));

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Today's Follow-ups" value={todayDue.length}             sub="Due today"             icon={CheckCircle} accent   onClick={() => navigate('/lead-management/followups')} />
        <StatCard label="Overdue"             value={analytics.overdue_followups} sub="Need your attention"   icon={Clock}       warn={analytics.overdue_followups > 0} onClick={() => navigate('/lead-management/followups')} />
        <StatCard label="Stale Leads"         value={analytics.stale_leads}       sub="No activity in 7+ days" icon={AlertTriangle} warn={analytics.stale_leads > 0}   onClick={() => navigate('/leads?filter=stale')} />
        <StatCard label="My Converted"        value={analytics.converted_leads}   sub="All time"              icon={Target}                                             onClick={() => navigate('/leads?filter=converted')} />
      </div>

      {/* Today's tasks + my stats side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Today's Follow-ups</h3>
            <button onClick={() => navigate('/lead-management/followups')} className="text-[11px] text-primary font-semibold hover:opacity-80 transition-opacity">
              View all →
            </button>
          </div>
          {analytics.today_followups.length === 0
            ? <p className="text-[12px] text-[#b09e8d]">No follow-ups due today. 🎉</p>
            : (
              <div className="space-y-1">
                {analytics.today_followups.map((f) => {
                  const isOverdue = isPast(new Date(f.due_at)) && !isToday(new Date(f.due_at));
                  return (
                    <div
                      key={f.id}
                      onClick={() => navigate(`/leads?lead=${f.lead_id}`)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#faf8f6] cursor-pointer transition-colors"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#1c1410] truncate">{f.lead_name}</p>
                        <p className="text-[10px] text-[#8a7c6e] truncate">{f.title}{f.description ? ` · ${f.description}` : ''}</p>
                      </div>
                      <span className={`text-[10px] shrink-0 font-medium ${isOverdue ? 'text-red-500' : 'text-[#8a7c6e]'}`}>
                        {formatDistanceToNow(new Date(f.due_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
          <h3 className="font-headline font-bold text-[#1c1410] text-[14px] mb-3">My Numbers</h3>
          <div className="grid grid-cols-1 gap-2.5">
            <div className="rounded-xl bg-[#faf8f6] px-4 py-3">
              <p className="text-[11px] text-[#7a6b5c] mb-0.5">Total Leads</p>
              <p className="font-headline text-[22px] font-bold text-[#1c1410]">{analytics.total_leads}</p>
            </div>
            <div className="rounded-xl bg-[#faf8f6] px-4 py-3">
              <p className="text-[11px] text-[#7a6b5c] mb-0.5">{analytics.range_label ?? 'This Period'}</p>
              <p className="font-headline text-[22px] font-bold text-[#1c1410]">{analytics.range_leads ?? 0}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <p className="text-[11px] text-emerald-600 mb-0.5">Converted</p>
              <p className="font-headline text-[22px] font-bold text-emerald-700">{analytics.converted_leads}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const { leads } = useCrmStore();
  const { role, isPrivileged } = useAuth();

  const [analytics,   setAnalytics]   = useState<Analytics | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [range,       setRange]       = useState('this_week');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');

  const apiUrl = useMemo(() => {
    if (range === 'custom' && customFrom && customTo) {
      return `/api/dashboard/analytics?range=custom&from=${customFrom}&to=${customTo}`;
    }
    return `/api/dashboard/analytics?range=${range}`;
  }, [range, customFrom, customTo]);

  useEffect(() => {
    if (range === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    api.get<Analytics>(apiUrl)
      .then((r) => setAnalytics(r))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const lineData = useMemo(() => {
    const today = startOfDay(new Date());

    if (range === 'today') {
      return Array.from({ length: 24 }, (_, h) => {
        const count = leads.filter((l) => {
          const d = new Date(l.createdAt);
          return isToday(d) && d.getHours() === h;
        }).length;
        return { day: `${h}:00`, leads: count };
      });
    }

    if (range === 'yesterday') {
      const yesterday = subDays(today, 1);
      return Array.from({ length: 24 }, (_, h) => {
        const count = leads.filter((l) => {
          const d = new Date(l.createdAt);
          return format(d, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd') && d.getHours() === h;
        }).length;
        return { day: `${h}:00`, leads: count };
      });
    }

    if (range === 'this_week') {
      const now = new Date();
      const dow  = now.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const weekStart = startOfDay(addDays(today, diff));
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i);
        const dayStr = format(d, 'yyyy-MM-dd');
        const count = d > now ? 0 : leads.filter((l) => format(startOfDay(new Date(l.createdAt)), 'yyyy-MM-dd') === dayStr).length;
        return { day: format(d, 'EEE'), leads: count };
      });
    }

    if (range === 'this_month') {
      const dim = getDaysInMonth(today);
      return Array.from({ length: dim }, (_, i) => {
        const day    = new Date(today.getFullYear(), today.getMonth(), i + 1);
        const dayStr = format(day, 'yyyy-MM-dd');
        const count  = leads.filter((l) => format(startOfDay(new Date(l.createdAt)), 'yyyy-MM-dd') === dayStr).length;
        return { day: String(i + 1), leads: count };
      });
    }

    if (range === 'custom' && customFrom && customTo) {
      const fromDate  = startOfDay(new Date(customFrom));
      const toDate    = startOfDay(new Date(customTo));
      const diffDays  = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
      const numPoints = Math.min(diffDays, 60);
      return Array.from({ length: numPoints }, (_, i) => {
        const d      = addDays(fromDate, i);
        const dayStr = format(d, 'yyyy-MM-dd');
        const count  = leads.filter((l) => format(startOfDay(new Date(l.createdAt)), 'yyyy-MM-dd') === dayStr).length;
        return { day: diffDays > 20 ? format(d, 'MMM d') : format(d, 'M/d'), leads: count };
      });
    }

    // this_quarter — weekly buckets
    if (range === 'this_quarter') {
      const quarter      = Math.floor(today.getMonth() / 3);
      const quarterStart = startOfDay(new Date(today.getFullYear(), quarter * 3, 1));
      const daysSince    = Math.ceil((today.getTime() - quarterStart.getTime()) / 86400000);
      const numWeeks     = Math.max(1, Math.ceil(daysSince / 7));
      return Array.from({ length: numWeeks }, (_, i) => {
        const weekStart = addDays(quarterStart, i * 7);
        const weekEnd   = addDays(weekStart, 6);
        const count     = leads.filter((l) => {
          const d = startOfDay(new Date(l.createdAt));
          return d >= weekStart && d <= (weekEnd > today ? today : weekEnd);
        }).length;
        return { day: format(weekStart, 'MMM d'), leads: count };
      });
    }

    // 90d — weekly buckets
    if (range === '90d') {
      return Array.from({ length: 13 }, (_, i) => {
        const weekStart = subDays(today, (12 - i) * 7);
        const weekEnd   = addDays(weekStart, 6);
        const count = leads.filter((l) => {
          const d = startOfDay(new Date(l.createdAt));
          return d >= weekStart && d <= weekEnd;
        }).length;
        return { day: format(weekStart, 'MMM d'), leads: count };
      });
    }

    // all — monthly buckets
    if (range === 'all') {
      return Array.from({ length: 12 }, (_, i) => {
        const month    = startOfMonth(subMonths(today, 11 - i));
        const monthStr = format(month, 'yyyy-MM');
        const count    = leads.filter((l) => format(new Date(l.createdAt), 'yyyy-MM') === monthStr).length;
        return { day: format(month, 'MMM'), leads: count };
      });
    }

    // default — last 30d daily
    return Array.from({ length: 30 }, (_, i) => {
      const day    = subDays(today, 29 - i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const count  = leads.filter((l) => format(startOfDay(new Date(l.createdAt)), 'yyyy-MM-dd') === dayStr).length;
      return { day: format(day, 'd'), leads: count };
    });
  }, [leads, range, customFrom, customTo]);

  const dashboardRole = analytics?.role ?? (role === 'owner' || role === 'super_admin' ? role : 'staff');
  const isManager     = dashboardRole === 'manager';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-headline text-[22px] font-extrabold tracking-tight text-[#1c1410] shrink-0">Dashboard</h2>
        <DateFilterBar
          range={range} setRange={setRange}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo}     setCustomTo={setCustomTo}
        />
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl px-4 py-3 card-shadow border border-black/5 h-16 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && analytics && (
        <>
          {isPrivileged && <ManagementDashboard analytics={analytics} lineData={lineData} />}
          {!isPrivileged && isManager && <ManagerDashboard analytics={analytics} lineData={lineData} />}
          {!isPrivileged && !isManager && <StaffDashboard analytics={analytics} />}
        </>
      )}

      {!loading && !analytics && (
        <div className="text-center py-20 text-[#b09e8d] text-[14px]">Could not load dashboard data.</div>
      )}
    </div>
  );
}
