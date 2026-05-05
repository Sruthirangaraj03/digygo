import { useState, useEffect, useMemo } from 'react';
import {
  Users, TrendingUp, AlertTriangle, Clock, Target, Award, Zap, CheckCircle, Star,
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import {
  formatDistanceToNow, format, subDays, startOfDay, isToday, isPast,
  addDays, getDaysInMonth, subMonths, startOfMonth,
} from 'date-fns';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Analytics {
  total_leads:       number;
  leads_this_month:  number;
  leads_last_month:  number;
  growth_pct:        number;
  range_leads:       number;
  range:             string;
  range_label:       string;
  converted_leads:   number;
  conversion_rate:   number;
  stale_leads:       number;
  overdue_followups: number;
  leads_today:       number;
  won_today:         number;
  best_source:       { source: string; count: number } | null;
  source_breakdown:  Array<{ source: string; count: number }>;
  pipeline_funnels:  Array<{ id: string; name: string; stages: Array<{ stage: string; count: number; is_won: boolean }> }>;
  staff_leaderboard: Array<{ id: string; name: string; assigned_count: number; converted: number; new_in_range: number; new_today: number; conversion_rate_pct: number }>;
  today_followups:   Array<{ id: string; lead_name: string; due_at: string; title: string; description: string; lead_id: string }>;
  role:              string;
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
  { value: 'today',      label: 'Today'      },
  { value: 'yesterday',  label: 'Yesterday'  },
  { value: 'this_week',  label: 'This Week'  },
  { value: 'this_month', label: 'This Month' },
  { value: 'all',        label: 'All Time'   },
  { value: 'custom',     label: 'Custom'     },
];

// ── Compact horizontal Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false, warn = false, onClick }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean; warn?: boolean;
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

// ── Pipeline Funnel Card (single, with dropdown) ──────────────────────────────
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

const STAGE_COLORS = ['#ea580c', '#f97316', '#fbbf24', '#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#38bdf8'];

// ── All Pipelines Health — CEO view, all pipelines at once ────────────────────
function AllPipelinesHealth({ funnels }: {
  funnels: Array<{ id: string; name: string; stages: Array<{ stage: string; count: number; is_won: boolean }> }>;
}) {
  const list = funnels ?? [];
  if (list.length === 0) return (
    <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
      <h3 className="font-headline font-bold text-[#1c1410] text-[14px] mb-2">Pipeline Health</h3>
      <p className="text-[12px] text-[#b09e8d]">No pipelines yet.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Pipeline Health</h3>
        <span className="text-[11px] text-[#7a6b5c]">{list.length} pipeline{list.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {list.map((pipeline) => {
          const total   = pipeline.stages.reduce((s, st) => s + st.count, 0);
          const wonSt   = pipeline.stages.find((s) => s.is_won);
          const wonCnt  = wonSt?.count ?? 0;
          const convPct = total === 0 ? 0 : Math.round((wonCnt / total) * 100);

          return (
            <div key={pipeline.id} className="rounded-xl border border-black/5 bg-[#faf8f6] px-4 py-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[13px] font-bold text-[#1c1410] truncate">{pipeline.name}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[11px] text-[#7a6b5c] font-medium">{total} leads</span>
                  {wonSt && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      {convPct}% won
                    </span>
                  )}
                </div>
              </div>

              {/* Stacked progress bar */}
              {total > 0 ? (
                <div className="flex h-3 rounded-full overflow-hidden gap-px mb-2.5">
                  {pipeline.stages.map((st, i) => {
                    const pct = (st.count / total) * 100;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={i}
                        title={`${st.stage}: ${st.count}`}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: st.is_won ? '#10b981' : STAGE_COLORS[i % STAGE_COLORS.length],
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="h-3 rounded-full bg-[#e8e0d8] mb-2.5" />
              )}

              {/* Stage legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {pipeline.stages.map((st, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-[#7a6b5c]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: st.is_won ? '#10b981' : STAGE_COLORS[i % STAGE_COLORS.length] }}
                    />
                    {st.stage}
                    <span className="font-bold text-[#1c1410]">{st.count}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
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

// ── Management Dashboard (CEO view) ──────────────────────────────────────────
function ManagementDashboard({ analytics, lineData }: {
  analytics: Analytics; lineData: any[];
}) {
  const navigate = useNavigate();

  const growth = analytics.growth_pct;
  const growthLabel = growth > 0 ? `+${growth}% vs last month` : growth < 0 ? `${growth}% vs last month` : 'Same as last month';

  const pieData = analytics.source_breakdown.map((s, i) => ({
    name: sourceLabel(s.source), value: s.count, color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const hasWon = (analytics.pipeline_funnels ?? []).flatMap((p) => p.stages ?? []).some((s) => s.is_won);
  const todayDueCount = analytics.today_followups.length;

  return (
    <div className="space-y-4">

      {/* ── Today's Pulse strip — always today, independent of period filter ── */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #ea580c 100%)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <p className="text-white/80 text-[11px] font-semibold uppercase tracking-widest">Today's Activity</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Leads', value: analytics.leads_today, sub: 'Created today', onClick: () => navigate('/leads') },
            { label: 'Won Today', value: analytics.won_today, sub: hasWon ? 'Closed deals' : 'Set a Won stage', onClick: () => navigate('/leads?filter=converted') },
            { label: 'Due Today', value: todayDueCount, sub: 'Follow-ups pending', onClick: () => navigate('/lead-management/followups') },
            { label: 'Overdue', value: analytics.overdue_followups, sub: 'Needs attention', onClick: () => navigate('/lead-management/followups') },
          ].map(({ label, value, sub, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="text-left bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3"
            >
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-white font-headline text-[28px] font-extrabold leading-none">{value}</p>
              <p className="text-white/60 text-[10px] mt-0.5">{sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Period KPI row — 5 compact cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Leads" value={analytics.total_leads}
          sub={growthLabel} icon={Users} accent
          onClick={() => navigate('/leads')}
        />
        <StatCard
          label={`New — ${analytics.range_label ?? 'This Period'}`} value={analytics.range_leads ?? 0}
          sub="Leads in selected period" icon={TrendingUp}
          onClick={() => navigate('/leads')}
        />
        <StatCard
          label="All-Time Converted" value={analytics.converted_leads}
          sub={hasWon ? `${analytics.conversion_rate}% rate` : 'Mark a stage as Won'}
          icon={Target}
          onClick={() => navigate('/leads?filter=converted')}
        />
        <StatCard
          label="Stale Leads" value={analytics.stale_leads}
          sub="No activity 7+ days" icon={AlertTriangle}
          warn={analytics.stale_leads > 0}
          onClick={() => navigate('/leads?filter=stale')}
        />
        <StatCard
          label="Best Source"
          value={analytics.best_source ? sourceLabel(analytics.best_source.source) : 'N/A'}
          sub={analytics.best_source ? `${analytics.best_source.count} leads this period` : 'No data yet'}
          icon={Star}
        />
      </div>

      {/* ── Charts row — Lead Inflow + Source donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Lead Inflow</h3>
              <p className="text-[11px] text-[#7a6b5c]">{analytics.range_label ?? 'This Period'}</p>
            </div>
            <span className="text-[11px] text-[#7a6b5c]">
              <span className="font-bold text-[#1c1410]">{analytics.range_leads ?? 0}</span> leads
            </span>
          </div>
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
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5 lg:col-span-2">
          <div className="mb-3">
            <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Leads by Source</h3>
            <p className="text-[11px] text-[#7a6b5c]">{analytics.range_label ?? 'This Period'}</p>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={185}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={45} outerRadius={72} dataKey="value">
                  {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[185px] flex items-center justify-center text-[12px] text-[#b09e8d]">No leads in this period.</div>
          )}
        </div>
      </div>

      {/* ── All Pipelines Health ── */}
      <AllPipelinesHealth funnels={analytics.pipeline_funnels} />

      {/* ── Staff Performance ── */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Staff Performance</h3>
          <span className="text-[11px] text-[#7a6b5c]">{analytics.range_label ?? 'This Period'} · All time conversion</span>
        </div>
        {analytics.staff_leaderboard.length === 0
          ? <p className="text-[12px] text-[#b09e8d]">No staff yet.</p>
          : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-0.5">
              {analytics.staff_leaderboard.slice(0, 10).map((s, i) => (
                <div key={s.id} className="px-2 py-2.5 rounded-xl hover:bg-[#faf8f6] transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-[#c0b0a0] w-4 font-bold shrink-0">#{i + 1}</span>
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                        {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[12px] font-semibold text-[#1c1410] truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 ml-2">
                      <span className="text-[10px] text-[#7a6b5c]" title="Today">
                        <span className="font-bold text-[#1c1410]">{s.new_today}</span> today
                      </span>
                      <span className="text-[10px] text-[#7a6b5c]">
                        <span className="font-bold text-[#1c1410]">{s.new_in_range}</span> this period
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600">
                        {s.converted} won
                      </span>
                      <span
                        className={`text-[11px] font-extrabold w-8 text-right ${
                          s.conversion_rate_pct >= 50 ? 'text-emerald-600' :
                          s.conversion_rate_pct >= 20 ? 'text-amber-500' : 'text-[#9a8a7a]'
                        }`}
                      >
                        {s.conversion_rate_pct}%
                      </span>
                    </div>
                  </div>
                  {/* Visual conversion rate bar */}
                  <div className="ml-11 h-1.5 bg-[#f0ece8] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${s.conversion_rate_pct}%`,
                        background: s.conversion_rate_pct >= 50 ? '#10b981' :
                                    s.conversion_rate_pct >= 20 ? '#f59e0b' : '#ea580c',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
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
  const [range,       setRange]       = useState('this_month');
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
