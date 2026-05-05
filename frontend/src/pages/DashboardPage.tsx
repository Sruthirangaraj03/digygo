import { useState, useEffect, useMemo } from 'react';
import {
  Users, TrendingUp, AlertTriangle, Clock, Target, Award, Zap, CheckCircle,
  Star, ChevronDown,
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
  best_source:       { source: string; count: number } | null;
  source_breakdown:  Array<{ source: string; count: number }>;
  pipeline_funnels:  Array<{ id: string; name: string; stages: Array<{ stage: string; count: number; is_won: boolean }> }>;
  staff_leaderboard: Array<{ id: string; name: string; assigned_count: number; converted: number; new_in_range: number; conversion_rate_pct: number }>;
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

const RANGE_OPTIONS = [
  { value: '30d',        label: 'Last 30 Days' },
  { value: '90d',        label: 'Last 90 Days' },
  { value: 'this_month', label: 'This Month'   },
  { value: 'all',        label: 'All Time'     },
];

// ── Shared Stat Card ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false, warn = false, onClick }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean; warn?: boolean;
  onClick?: () => void;
}) {
  const clickClass = onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-150' : '';

  if (accent) return (
    <div
      onClick={onClick}
      className={`rounded-2xl px-6 py-5 flex flex-col justify-between text-white ${clickClass}`}
      style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 8px 32px rgba(234,88,12,0.28)' }}
    >
      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-[13px] opacity-80 mb-1">{label}</p>
        <h3 className="font-headline text-[28px] font-bold tracking-tight">{value}</h3>
        {sub && <p className="text-[11px] opacity-70 mt-1">{sub}</p>}
      </div>
      {onClick && <p className="text-[10px] opacity-50 mt-2">Click to view →</p>}
    </div>
  );
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl px-6 py-5 card-shadow border flex flex-col justify-between ${warn ? 'border-amber-200' : 'border-black/5'} ${clickClass}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${warn ? 'bg-amber-50' : 'bg-primary/10'}`}>
        <Icon className={`w-5 h-5 ${warn ? 'text-amber-500' : 'text-primary'}`} />
      </div>
      <div>
        <p className="text-[13px] text-[#7a6b5c] mb-1">{label}</p>
        <h3 className="font-headline text-[28px] font-bold text-[#1c1410] tracking-tight">{value}</h3>
        {sub && <p className="text-[11px] text-[#7a6b5c] mt-1">{sub}</p>}
      </div>
      {onClick && <p className="text-[10px] text-[#b09e8d] mt-2">Click to view →</p>}
    </div>
  );
}

const PIE_COLORS = ['#ea580c', '#f97316', '#c2410c', '#fed7aa', '#7c3aed', '#0ea5e9'];

// ── Pipeline Funnel Card (pipeline-specific) ──────────────────────────────────
function FunnelCard({ funnels, selectedId, setSelectedId }: {
  funnels: Array<{ id: string; name: string; stages: Array<{ stage: string; count: number; is_won: boolean }> }>;
  selectedId: string;
  setSelectedId: (id: string) => void;
}) {
  const activeFunnel = funnels.find((f) => f.id === selectedId) ?? funnels[0] ?? null;
  const hasWon = activeFunnel?.stages.some((s) => s.is_won) ?? false;

  return (
    <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline font-bold text-[#1c1410]">Pipeline Funnel</h3>
        {funnels.length > 1 && (
          <div className="flex items-center gap-1 bg-[#faf8f6] rounded-xl p-1">
            {funnels.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedId(f.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${(activeFunnel?.id === f.id) ? 'bg-white shadow-sm text-[#1c1410]' : 'text-[#8a7c6e] hover:text-[#1c1410]'}`}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {!hasWon && activeFunnel && (
        <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 mb-3">
          No "Won" stage set — <a href="/lead-management/overview" className="font-semibold underline">Pipeline Settings</a> → mark one stage as Won to track conversions.
        </p>
      )}
      {!activeFunnel
        ? <p className="text-[13px] text-[#b09e8d] mt-4">No pipeline data yet.</p>
        : (
          <ResponsiveContainer width="100%" height={Math.max(120, activeFunnel.stages.length * 36)}>
            <BarChart data={activeFunnel.stages} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1c1410', color: '#fff', fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {activeFunnel.stages.map((e, i) => (
                  <Cell key={i} fill={e.is_won ? '#10b981' : '#ea580c'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
    </div>
  );
}

// ── Management Dashboard ──────────────────────────────────────────────────────
function ManagementDashboard({ analytics, lineData, range, setRange }: {
  analytics: Analytics; lineData: any[]; range: string; setRange: (r: string) => void;
}) {
  const navigate = useNavigate();
  const [rangeOpen, setRangeOpen] = useState(false);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');

  const growth = analytics.growth_pct;
  const growthLabel = growth > 0 ? `+${growth}% vs last month` : growth < 0 ? `${growth}% vs last month` : 'Same as last month';

  const pieData = analytics.source_breakdown.map((s, i) => ({
    name: sourceLabel(s.source), value: s.count, color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Range filter */}
      <div className="flex items-center justify-end">
        <div className="relative">
          <button
            onClick={() => setRangeOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-black/10 bg-white text-[13px] font-semibold text-[#1c1410] hover:border-primary/40 transition-colors shadow-sm"
          >
            {RANGE_OPTIONS.find((r) => r.value === range)?.label ?? 'Last 30 Days'}
            <ChevronDown className={`w-4 h-4 text-[#9a8a7a] transition-transform ${rangeOpen ? 'rotate-180' : ''}`} />
          </button>
          {rangeOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setRangeOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-black/10 shadow-xl z-50 py-1 min-w-[160px]">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setRange(opt.value); setRangeOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#faf8f6] transition-colors ${range === opt.value ? 'font-bold text-primary' : 'text-[#1c1410]'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI row — 5 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Leads" value={analytics.total_leads}
          sub={growthLabel} icon={Users} accent
          onClick={() => navigate('/leads')}
        />
        <StatCard
          label={analytics.range_label ?? 'This Period'} value={analytics.range_leads ?? 0}
          sub="New leads in period" icon={TrendingUp}
          onClick={() => navigate('/leads')}
        />
        <StatCard
          label="Converted" value={analytics.converted_leads}
          sub={analytics.pipeline_funnel.some((s) => s.is_won)
            ? `${analytics.conversion_rate}% conversion rate`
            : 'Mark a stage as Won to track'}
          icon={Target}
          onClick={() => navigate('/leads?filter=converted')}
        />
        <StatCard
          label="Stale Leads" value={analytics.stale_leads}
          sub="No activity in 7+ days" icon={AlertTriangle}
          warn={analytics.stale_leads > 0}
          onClick={() => navigate('/leads?filter=stale')}
        />
        <StatCard
          label="Best Source"
          value={analytics.best_source ? sourceLabel(analytics.best_source.source) : 'N/A'}
          sub={analytics.best_source ? `${analytics.best_source.count} leads` : 'No data yet'}
          icon={Star}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-1">Lead Inflow</h3>
          <p className="text-[12px] text-[#7a6b5c] mb-4">{analytics.range_label ?? 'Last 30 Days'}</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7ea" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(lineData.length / 6))} />
              <YAxis tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1c1410', color: '#fff', fontSize: 12 }} />
              <Line type="monotone" dataKey="leads" stroke="#ea580c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-1">Leads by Source</h3>
          <p className="text-[12px] text-[#7a6b5c] mb-4">{analytics.range_label ?? 'Last 30 Days'}</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value">
                  {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-[13px] text-[#b09e8d]">No leads in this period.</div>}
        </div>
      </div>

      {/* Staff leaderboard + pipeline funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-5">Staff Performance</h3>
          {analytics.staff_leaderboard.length === 0
            ? <p className="text-[13px] text-[#b09e8d]">No staff data yet.</p>
            : (
              <>
                <div className="grid grid-cols-[1fr_52px_52px_64px_44px] gap-1 text-[10px] text-[#b09e8d] font-semibold uppercase px-2 mb-2">
                  <span>Staff</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">New</span>
                  <span className="text-right">Won</span>
                  <span className="text-right">Rate</span>
                </div>
                <div className="space-y-0.5">
                  {analytics.staff_leaderboard.slice(0, 7).map((s, i) => (
                    <div key={s.id} className="grid grid-cols-[1fr_52px_52px_64px_44px] gap-1 items-center px-2 py-2 rounded-xl hover:bg-[#faf8f6] transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-[#b09e8d] w-4 font-bold shrink-0">#{i + 1}</span>
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[12px] font-semibold text-[#1c1410] truncate">{s.name}</span>
                      </div>
                      <span className="text-[12px] text-right text-[#7a6b5c]">{s.assigned_count}</span>
                      <span className="text-[12px] text-right text-[#7a6b5c]">{s.new_in_range}</span>
                      <div className="flex items-center justify-end gap-1">
                        <Award className="w-3 h-3 text-emerald-500" />
                        <span className="text-[12px] font-bold text-emerald-600">{s.converted}</span>
                      </div>
                      <span className={`text-[11px] font-bold text-right ${s.conversion_rate_pct >= 50 ? 'text-emerald-600' : s.conversion_rate_pct >= 20 ? 'text-amber-500' : 'text-[#8a7c6e]'}`}>
                        {s.conversion_rate_pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
        </div>
        <FunnelCard funnels={analytics.pipeline_funnels} selectedId={selectedFunnelId} setSelectedId={setSelectedFunnelId} />
      </div>
    </div>
  );
}

// ── Manager pipeline health (cards view) ─────────────────────────────────────
function ManagerPipelineHealth({ funnels }: { funnels: Analytics['pipeline_funnels'] }) {
  const [selectedId, setSelectedId] = useState('');
  const active = funnels.find((f) => f.id === selectedId) ?? funnels[0] ?? null;
  return (
    <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline font-bold text-[#1c1410]">Pipeline Stage Health</h3>
        {funnels.length > 1 && (
          <div className="flex items-center gap-1 bg-[#faf8f6] rounded-xl p-1">
            {funnels.map((f) => (
              <button key={f.id} onClick={() => setSelectedId(f.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${active?.id === f.id ? 'bg-white shadow-sm text-[#1c1410]' : 'text-[#8a7c6e] hover:text-[#1c1410]'}`}>
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {!active
        ? <p className="text-[13px] text-[#b09e8d]">No pipeline data yet.</p>
        : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {active.stages.map((s, i) => (
              <div key={i} className={`rounded-xl px-4 py-3 border ${s.is_won ? 'border-emerald-200 bg-emerald-50' : 'border-black/5 bg-[#faf8f6]'}`}>
                <p className="text-[11px] text-[#7a6b5c] mb-1 truncate">{s.stage}</p>
                <p className={`font-headline text-[22px] font-bold ${s.is_won ? 'text-emerald-600' : 'text-[#1c1410]'}`}>{s.count}</p>
                {s.is_won && <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">Won ✓</p>}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Sales Manager Dashboard ───────────────────────────────────────────────────
function ManagerDashboard({ analytics, lineData }: { analytics: Analytics; lineData: any[] }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Overdue Follow-ups" value={analytics.overdue_followups} sub="Needs immediate action"       icon={Clock}         warn={analytics.overdue_followups > 0} />
        <StatCard label="Stale Leads"         value={analytics.stale_leads}       sub="No activity in 7+ days"      icon={AlertTriangle} warn={analytics.stale_leads > 0} />
        <StatCard label="Converted This Month" value={analytics.converted_leads}  sub={`${analytics.conversion_rate}% rate`} icon={Target} accent />
        <StatCard label="New Leads"           value={analytics.leads_this_month}  sub="This month"                  icon={Zap} />
      </div>

      {/* Staff table + line chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-5">Team Performance</h3>
          {analytics.staff_leaderboard.length === 0
            ? <p className="text-[13px] text-[#b09e8d]">No staff yet.</p>
            : (
              <div className="space-y-1">
                <div className="grid grid-cols-3 text-[11px] text-[#b09e8d] font-semibold uppercase px-2 mb-2">
                  <span>Staff</span><span className="text-center">New</span><span className="text-right">Converted</span>
                </div>
                {analytics.staff_leaderboard.map((s) => (
                  <div key={s.id} className="grid grid-cols-3 items-center px-2 py-2.5 rounded-xl hover:bg-[#faf8f6] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[12px] font-semibold text-[#1c1410] truncate">{s.name}</span>
                    </div>
                    <span className="text-[13px] text-center text-[#7a6b5c]">{s.new_in_range}</span>
                    <span className="text-[13px] text-right font-bold text-emerald-600">{s.converted}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-1">Lead Inflow</h3>
          <p className="text-[12px] text-[#7a6b5c] mb-4">Last 30 days</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7ea" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1c1410', color: '#fff', fontSize: 12 }} />
              <Line type="monotone" dataKey="leads" stroke="#ea580c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline stage health — show all pipelines as tabs */}
      <ManagerPipelineHealth funnels={analytics.pipeline_funnels} />
    </div>
  );
}

// ── Staff Dashboard ───────────────────────────────────────────────────────────
function StaffDashboard({ analytics }: { analytics: Analytics }) {
  const navigate = useNavigate();
  const todayDue = analytics.today_followups.filter((f) => isToday(new Date(f.due_at)));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="Today's Follow-ups" value={todayDue.length}             sub="Due today"             icon={CheckCircle} accent />
        <StatCard label="Overdue"             value={analytics.overdue_followups} sub="Need your attention"   icon={Clock}       warn={analytics.overdue_followups > 0} />
        <StatCard label="My Converted"        value={analytics.converted_leads}   sub="All time"              icon={Target} />
      </div>

      {/* Today's tasks */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline font-bold text-[#1c1410]">Today's Follow-ups</h3>
          <button onClick={() => navigate('/lead-management/followups')} className="text-[12px] text-primary font-semibold hover:opacity-80 transition-opacity">
            View all →
          </button>
        </div>
        {analytics.today_followups.length === 0
          ? <p className="text-[13px] text-[#b09e8d]">No follow-ups due today. 🎉</p>
          : (
            <div className="space-y-2">
              {analytics.today_followups.map((f) => {
                const isOverdue = isPast(new Date(f.due_at)) && !isToday(new Date(f.due_at));
                return (
                  <div
                    key={f.id}
                    onClick={() => navigate(`/leads?lead=${f.lead_id}`)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#faf8f6] cursor-pointer transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1c1410] truncate">{f.lead_name}</p>
                      <p className="text-[11px] text-[#8a7c6e] truncate">{f.title}{f.description ? ` · ${f.description}` : ''}</p>
                    </div>
                    <span className={`text-[11px] shrink-0 font-medium ${isOverdue ? 'text-red-500' : 'text-[#8a7c6e]'}`}>
                      {formatDistanceToNow(new Date(f.due_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* My stats */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
        <h3 className="font-headline font-bold text-[#1c1410] mb-5">My Numbers</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-[#faf8f6] px-4 py-3">
            <p className="text-[11px] text-[#7a6b5c] mb-1">Total Leads</p>
            <p className="font-headline text-[22px] font-bold text-[#1c1410]">{analytics.total_leads}</p>
          </div>
          <div className="rounded-xl bg-[#faf8f6] px-4 py-3">
            <p className="text-[11px] text-[#7a6b5c] mb-1">This Month</p>
            <p className="font-headline text-[22px] font-bold text-[#1c1410]">{analytics.leads_this_month}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-[11px] text-emerald-600 mb-1">Converted</p>
            <p className="font-headline text-[22px] font-bold text-emerald-700">{analytics.converted_leads}</p>
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

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [range,     setRange]     = useState('30d');

  useEffect(() => {
    setLoading(true);
    api.get<Analytics>(`/api/dashboard/analytics?range=${range}`)
      .then((r) => setAnalytics(r))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [range]);

  const lineData = useMemo(() => {
    const today = startOfDay(new Date());

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
    if (range === 'this_month') {
      const dim = getDaysInMonth(today);
      return Array.from({ length: dim }, (_, i) => {
        const day    = new Date(today.getFullYear(), today.getMonth(), i + 1);
        const dayStr = format(day, 'yyyy-MM-dd');
        const count  = leads.filter((l) => format(startOfDay(new Date(l.createdAt)), 'yyyy-MM-dd') === dayStr).length;
        return { day: String(i + 1), leads: count };
      });
    }
    if (range === 'all') {
      return Array.from({ length: 12 }, (_, i) => {
        const month    = startOfMonth(subMonths(today, 11 - i));
        const monthStr = format(month, 'yyyy-MM');
        const count    = leads.filter((l) => format(new Date(l.createdAt), 'yyyy-MM') === monthStr).length;
        return { day: format(month, 'MMM'), leads: count };
      });
    }
    // 30d (default)
    return Array.from({ length: 30 }, (_, i) => {
      const day    = subDays(today, 29 - i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const count  = leads.filter((l) => format(startOfDay(new Date(l.createdAt)), 'yyyy-MM-dd') === dayStr).length;
      return { day: format(day, 'd'), leads: count };
    });
  }, [leads, range]);

  const dashboardRole = analytics?.role ?? (role === 'owner' || role === 'super_admin' ? role : 'staff');
  const isManager     = dashboardRole === 'manager';

  const roleLabel = isPrivileged ? 'Management' : isManager ? 'Sales Manager' : 'My Dashboard';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="section-label mb-1">{roleLabel}</p>
        <h2 className="font-headline text-[29px] font-extrabold tracking-tight text-[#1c1410]">Dashboard</h2>
        <p className="text-[#7a6b5c] mt-1 text-[13px]">
          {isPrivileged ? 'Business health at a glance.' : isManager ? 'Team activity and pipeline health.' : "Here's what needs your attention today."}
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl px-6 py-5 card-shadow border border-black/5 h-36 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && analytics && (
        <>
          {isPrivileged && <ManagementDashboard analytics={analytics} lineData={lineData} range={range} setRange={setRange} />}
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
