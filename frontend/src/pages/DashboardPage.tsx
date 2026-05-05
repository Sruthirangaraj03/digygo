import { useState, useEffect, useMemo } from 'react';
import {
  Users, Layers, MessageCircle, Calendar, TrendingUp, ArrowUpRight,
  AlertTriangle, Clock, Target, Award, Zap, CheckCircle,
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import { formatDistanceToNow, format, subDays, startOfDay, isToday, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Analytics {
  total_leads:       number;
  leads_this_month:  number;
  leads_last_month:  number;
  growth_pct:        number;
  converted_leads:   number;
  conversion_rate:   number;
  stale_leads:       number;
  overdue_followups: number;
  source_breakdown:  Array<{ source: string; count: number }>;
  pipeline_funnel:   Array<{ stage: string; count: number; is_won: boolean }>;
  staff_leaderboard: Array<{ id: string; name: string; converted: number; new_this_month: number }>;
  today_followups:   Array<{ id: string; lead_name: string; due_at: string; type: string; note: string; lead_id: string }>;
  role:              string;
}

// ── Shared Stat Card ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false, warn = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean; warn?: boolean;
}) {
  if (accent) return (
    <div className="rounded-2xl px-6 py-5 flex flex-col justify-between text-white"
      style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 8px 32px rgba(234,88,12,0.28)' }}>
      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-[13px] opacity-80 mb-1">{label}</p>
        <h3 className="font-headline text-[28px] font-bold tracking-tight">{value}</h3>
        {sub && <p className="text-[11px] opacity-70 mt-1">{sub}</p>}
      </div>
    </div>
  );
  return (
    <div className={`bg-white rounded-2xl px-6 py-5 card-shadow border flex flex-col justify-between ${warn ? 'border-amber-200' : 'border-black/5'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${warn ? 'bg-amber-50' : 'bg-primary/10'}`}>
        <Icon className={`w-5 h-5 ${warn ? 'text-amber-500' : 'text-primary'}`} />
      </div>
      <div>
        <p className="text-[13px] text-[#7a6b5c] mb-1">{label}</p>
        <h3 className="font-headline text-[28px] font-bold text-[#1c1410] tracking-tight">{value}</h3>
        {sub && <p className="text-[11px] text-[#7a6b5c] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const PIE_COLORS = ['#ea580c', '#f97316', '#c2410c', '#fed7aa', '#7c3aed', '#0ea5e9'];

// ── Management Dashboard ──────────────────────────────────────────────────────
function ManagementDashboard({ analytics, lineData }: { analytics: Analytics; lineData: any[] }) {
  const growth = analytics.growth_pct;
  const growthLabel = growth > 0 ? `+${growth}% vs last month` : growth < 0 ? `${growth}% vs last month` : 'Same as last month';

  const pieData = analytics.source_breakdown.map((s, i) => ({
    name: s.source || 'Unknown', value: s.count, color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Leads"      value={analytics.total_leads}      sub={growthLabel}                                               icon={Users}        accent />
        <StatCard label="Converted"        value={analytics.converted_leads}  sub={`${analytics.conversion_rate}% conversion rate`}           icon={Target} />
        <StatCard label="Leads This Month" value={analytics.leads_this_month} sub={`${analytics.leads_last_month} last month`}                icon={TrendingUp} />
        <StatCard label="Stale Leads"      value={analytics.stale_leads}      sub="No activity in 7+ days"                                    icon={AlertTriangle} warn={analytics.stale_leads > 0} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-1">Leads by Source</h3>
          <p className="text-[12px] text-[#7a6b5c] mb-4">Current distribution</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value">
                  {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-[13px] text-[#b09e8d]">No leads yet.</div>}
        </div>
      </div>

      {/* Staff leaderboard + pipeline funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-5">Staff Performance</h3>
          {analytics.staff_leaderboard.length === 0
            ? <p className="text-[13px] text-[#b09e8d]">No staff data yet.</p>
            : (
              <div className="space-y-3">
                {analytics.staff_leaderboard.slice(0, 6).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-[12px] text-[#b09e8d] w-5 shrink-0 font-bold">#{i + 1}</span>
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                      {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1c1410] truncate">{s.name}</p>
                      <p className="text-[11px] text-[#8a7c6e]">{s.new_this_month} new this month</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Award className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[13px] font-bold text-emerald-600">{s.converted}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-5">Pipeline Funnel</h3>
          {analytics.pipeline_funnel.length === 0
            ? <p className="text-[13px] text-[#b09e8d]">No pipeline data yet.</p>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.pipeline_funnel} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1c1410', color: '#fff', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {analytics.pipeline_funnel.map((e, i) => (
                      <Cell key={i} fill={e.is_won ? '#10b981' : '#ea580c'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>
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
                    <span className="text-[13px] text-center text-[#7a6b5c]">{s.new_this_month}</span>
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

      {/* Pipeline funnel */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
        <h3 className="font-headline font-bold text-[#1c1410] mb-5">Pipeline Stage Health</h3>
        {analytics.pipeline_funnel.length === 0
          ? <p className="text-[13px] text-[#b09e8d]">No pipeline data yet.</p>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {analytics.pipeline_funnel.map((s, i) => (
                <div key={i} className={`rounded-xl px-4 py-3 border ${s.is_won ? 'border-emerald-200 bg-emerald-50' : 'border-black/5 bg-[#faf8f6]'}`}>
                  <p className="text-[11px] text-[#7a6b5c] mb-1 truncate">{s.stage}</p>
                  <p className={`font-headline text-[22px] font-bold ${s.is_won ? 'text-emerald-600' : 'text-[#1c1410]'}`}>{s.count}</p>
                  {s.is_won && <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">Won ✓</p>}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ── Staff Dashboard ───────────────────────────────────────────────────────────
function StaffDashboard({ analytics }: { analytics: Analytics }) {
  const navigate = useNavigate();
  const overdue  = analytics.today_followups.filter((f) => isPast(new Date(f.due_at)) && !isToday(new Date(f.due_at)));
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
                      <p className="text-[11px] text-[#8a7c6e] truncate">{f.type} {f.note ? `· ${f.note}` : ''}</p>
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
  const { role }  = useAuthStore((s) => s.user ?? { role: 'staff' });

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    api.get<Analytics>('/api/dashboard/analytics')
      .then((r) => setAnalytics(r))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const lineData = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 30 }, (_, i) => {
      const day    = subDays(today, 29 - i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const count  = leads.filter((l) => format(new Date(l.createdAt), 'yyyy-MM-dd') === dayStr).length;
      return { day: format(day, 'd'), leads: count };
    });
  }, [leads]);

  const dashboardRole = analytics?.role ?? (role === 'owner' || role === 'super_admin' ? role : 'staff');
  const isPrivileged  = role === 'owner' || role === 'super_admin';
  const isManager     = dashboardRole === 'manager';

  const roleLabel = isPrivileged ? 'Management' : isManager ? 'Sales Manager' : 'My Dashboard';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="section-label mb-1">{roleLabel}</p>
        <h2 className="font-headline text-[29px] font-extrabold tracking-tight text-[#1c1410]">Dashboard</h2>
        <p className="text-[#7a6b5c] mt-1 text-[13px]">
          {isPrivileged ? "Business health at a glance." : isManager ? "Team activity and pipeline health." : "Here's what needs your attention today."}
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl px-6 py-5 card-shadow border border-black/5 h-36 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && analytics && (
        <>
          {(isPrivileged) && <ManagementDashboard analytics={analytics} lineData={lineData} />}
          {(!isPrivileged && isManager) && <ManagerDashboard analytics={analytics} lineData={lineData} />}
          {(!isPrivileged && !isManager) && <StaffDashboard analytics={analytics} />}
        </>
      )}

      {!loading && !analytics && (
        <div className="text-center py-20 text-[#b09e8d] text-[14px]">Could not load dashboard data.</div>
      )}
    </div>
  );
}
