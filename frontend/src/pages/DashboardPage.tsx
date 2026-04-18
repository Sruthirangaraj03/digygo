import { useMemo } from 'react';
import { Users, Layers, MessageCircle, Calendar, TrendingUp, ArrowUpRight } from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const lineData = Array.from({ length: 30 }, (_, i) => ({ day: `${i + 1}`, leads: Math.floor(Math.random() * 40) + 60 }));

export default function DashboardPage() {
  const { leads, calendarEvents, staff } = useCrmStore();

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => { counts[l.source] = (counts[l.source] ?? 0) + 1; });
    const colors = ['#ea580c', '#f97316', '#c2410c', '#fed7aa', '#7c3aed'];
    return Object.entries(counts).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [leads]);

  const statCards = [
    { label: 'Total Leads', value: leads.length.toLocaleString(), change: 'in your pipeline', icon: Users, color: 'text-primary' },
    { label: 'Active Staff', value: staff.filter((s) => s.status === 'active').length.toString(), change: 'team members', icon: Layers, color: 'text-purple-500' },
    { label: 'Conversations', value: '0', change: 'coming soon', icon: MessageCircle, color: 'text-success' },
    { label: 'Appointments', value: calendarEvents.length.toString(), change: 'scheduled', icon: Calendar, color: 'text-warning' },
  ];

  const upcomingFollowups = leads.slice(0, 5).map((l) => ({
    name: `${l.firstName} ${l.lastName}`,
    dueTime: formatDistanceToNow(new Date(l.lastActivity), { addSuffix: true }),
    agent: staff.find((s) => s.id === l.assignedTo)?.avatar || '??',
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="section-label mb-1">Overview</p>
        <h2 className="font-headline text-[29px] font-extrabold tracking-tight text-[#1c1410]">Dashboard</h2>
        <p className="text-[#7a6b5c] mt-1 text-[13px]">Here's what's happening with your leads today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((s, idx) => {
          const isHighlight = idx === statCards.length - 1;
          return isHighlight ? (
            <div
              key={s.label}
              className="rounded-2xl px-6 py-5 flex flex-col justify-between text-white hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 8px 32px rgba(234,88,12,0.28)' }}
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[13px] opacity-80 mb-1">{s.label}</p>
                <h3 className="font-headline text-[28px] font-bold tracking-tight">{s.value}</h3>
                <p className="text-[11px] opacity-70 mt-1 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> {s.change}
                </p>
              </div>
            </div>
          ) : (
            <div
              key={s.label}
              className="bg-white rounded-2xl px-6 py-5 card-shadow border border-black/5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-[13px] text-[#7a6b5c] mb-1">{s.label}</p>
                <h3 className="font-headline text-[28px] font-bold text-[#1c1410] tracking-tight">{s.value}</h3>
                <p className="text-[11px] text-[#7a6b5c] mt-1 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" /> {s.change}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-1">Lead Inflow</h3>
          <p className="text-[12px] text-[#7a6b5c] mb-4">Last 30 days</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7ea" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8a7c6e' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', background: '#1c1410', color: '#fff', fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}
              />
              <Line type="monotone" dataKey="leads" stroke="#ea580c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-1">Leads by Source</h3>
          <p className="text-[12px] text-[#7a6b5c] mb-4">Current distribution</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value">
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-5">Recent Leads</h3>
          <div className="space-y-3">
            {leads.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {l.firstName[0]}{l.lastName[0]}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[#1c1410]">{l.firstName} {l.lastName}</p>
                  <p className="text-[11px] text-[#8a7c6e] mt-0.5">{l.source} · {l.stage}</p>
                </div>
              </div>
            ))}
            {leads.length === 0 && <p className="text-[13px] text-[#b09e8d]">No leads yet.</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
          <h3 className="font-headline font-bold text-[#1c1410] mb-5">Upcoming Follow-ups</h3>
          <div className="space-y-2">
            {upcomingFollowups.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#faf8f6] transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {f.agent}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1c1410] truncate">{f.name}</p>
                  <p className="text-[11px] text-[#8a7c6e] mt-0.5">Due {f.dueTime}</p>
                </div>
                <TrendingUp className="w-4 h-4 text-[#b09e8d] shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
