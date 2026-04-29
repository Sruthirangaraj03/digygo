import { useState, useEffect, useMemo } from 'react';
import { Users, Layers, MessageCircle, Calendar, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { api } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatDistanceToNow, format, subDays, startOfDay } from 'date-fns';

interface DashboardStats {
  total_leads?:    number;
  active_staff?:   number;
  conversations?:  number;
  appointments?:   number;
}

interface DashboardVisible {
  total_leads:    boolean;
  active_staff:   boolean;
  conversations:  boolean;
  appointments:   boolean;
}

export default function DashboardPage() {
  const { leads, staff } = useCrmStore();

  const [stats,   setStats]   = useState<DashboardStats>({});
  const [visible, setVisible] = useState<DashboardVisible>({
    total_leads: true, active_staff: true, conversations: true, appointments: true,
  });

  useEffect(() => {
    api.get<{ stats: DashboardStats; visible: DashboardVisible }>('/api/dashboard/stats')
      .then((r) => { setStats(r.stats); setVisible(r.visible); })
      .catch(() => {});
  }, []);

  const newThisMonth = useMemo(() => {
    const now = new Date();
    return leads.filter((l) => {
      const d = new Date(l.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [leads]);

  const lineData = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 30 }, (_, i) => {
      const day    = subDays(today, 29 - i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const count  = leads.filter((l) => format(new Date(l.createdAt), 'yyyy-MM-dd') === dayStr).length;
      return { day: format(day, 'd'), leads: count };
    });
  }, [leads]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => { counts[l.source] = (counts[l.source] ?? 0) + 1; });
    const colors = ['#ea580c', '#f97316', '#c2410c', '#fed7aa', '#7c3aed', '#0ea5e9'];
    return Object.entries(counts).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [leads]);

  // Defined inside component so they can reference reactive values (newThisMonth)
  const statDefs = [
    { key: 'total_leads'   as const, label: 'Total Leads',   change: `${newThisMonth} added this month`, icon: Users,         color: 'text-primary'    },
    { key: 'active_staff'  as const, label: 'Active Staff',  change: 'team members',                     icon: Layers,        color: 'text-purple-500' },
    { key: 'conversations' as const, label: 'Conversations', change: 'open chats',                       icon: MessageCircle, color: 'text-success'    },
    { key: 'appointments'  as const, label: 'Appointments',  change: 'scheduled',                        icon: Calendar,      color: 'text-warning'    },
  ];

  const visibleCards = statDefs.filter((d) => visible[d.key]);

  const recentLeads       = leads.slice(0, 5);
  const upcomingFollowups = leads.slice(0, 5).map((l) => ({
    id:      l.id,
    name:    `${l.firstName} ${l.lastName}`,
    dueTime: formatDistanceToNow(new Date(l.lastActivity), { addSuffix: true }),
    agent:   staff.find((s) => s.id === l.assignedTo)?.avatar || l.assignedName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '??',
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="section-label mb-1">Overview</p>
        <h2 className="font-headline text-[29px] font-extrabold tracking-tight text-[#1c1410]">Dashboard</h2>
        <p className="text-[#7a6b5c] mt-1 text-[13px]">Here's what's happening with your leads today.</p>
      </div>

      {/* Stat cards — only cards the user has permission to see */}
      {visibleCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {visibleCards.map((def, idx) => {
            const isHighlight = idx === visibleCards.length - 1;
            const value = stats[def.key] !== undefined ? String(stats[def.key]) : '—';
            return isHighlight ? (
              <div key={def.key} className="rounded-2xl px-6 py-5 flex flex-col justify-between text-white hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 8px 32px rgba(234,88,12,0.28)' }}>
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  <def.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[13px] opacity-80 mb-1">{def.label}</p>
                  <h3 className="font-headline text-[28px] font-bold tracking-tight">{value}</h3>
                  <p className="text-[11px] opacity-70 mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> {def.change}</p>
                </div>
              </div>
            ) : (
              <div key={def.key} className="bg-white rounded-2xl px-6 py-5 card-shadow border border-black/5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <def.icon className={`w-5 h-5 ${def.color}`} />
                </div>
                <div>
                  <p className="text-[13px] text-[#7a6b5c] mb-1">{def.label}</p>
                  <h3 className="font-headline text-[28px] font-bold text-[#1c1410] tracking-tight">{value}</h3>
                  <p className="text-[11px] text-[#7a6b5c] mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-500" /> {def.change}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-1">Lead Inflow</h3>
          <p className="text-[12px] text-[#7a6b5c] mb-4">Last 30 days</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7ea" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1c1410', color: '#fff', fontSize: 12 }} labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
              <Line type="monotone" dataKey="leads" stroke="#ea580c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-1">Leads by Source</h3>
          <p className="text-[12px] text-[#7a6b5c] mb-4">Current distribution</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value">
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-[13px] text-[#b09e8d]">No leads yet.</div>
          )}
        </div>
      </div>

      {/* Activity + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-5">Recent Leads</h3>
          <div className="space-y-3">
            {recentLeads.map((l) => (
              <div key={l.id} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {l.firstName[0]}{l.lastName?.[0] ?? ''}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[#1c1410]">{l.firstName} {l.lastName}</p>
                  <p className="text-[11px] text-[#8a7c6e] mt-0.5">{l.source} · {l.stage}</p>
                </div>
                <span className="text-[10px] text-[#b09e8d] shrink-0">{formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}</span>
              </div>
            ))}
            {recentLeads.length === 0 && <p className="text-[13px] text-[#b09e8d]">No leads yet.</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-5">Upcoming Follow-ups</h3>
          <div className="space-y-2">
            {upcomingFollowups.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#faf8f6] transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {f.agent}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1c1410] truncate">{f.name}</p>
                  <p className="text-[11px] text-[#8a7c6e] mt-0.5">Last activity {f.dueTime}</p>
                </div>
                <TrendingUp className="w-4 h-4 text-[#b09e8d] shrink-0" />
              </div>
            ))}
            {upcomingFollowups.length === 0 && <p className="text-[13px] text-[#b09e8d]">No recent activity.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
