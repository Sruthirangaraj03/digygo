import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, TrendingUp, Plus, RefreshCw,
  ShieldCheck, Calendar, Layers, ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  created_at: string;
  user_count: number;
  lead_count: number;
}

const PLAN_COLORS: Record<string, string> = {
  starter:    'bg-gray-100 text-gray-600',
  pro:        'bg-blue-50 text-blue-600',
  enterprise: 'bg-purple-50 text-purple-600',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Tenant[]>('/api/auth/tenants');
      setTenants(data);
    } catch {
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const totalUsers = tenants.reduce((a, t) => a + Number(t.user_count), 0);
  const totalLeads = tenants.reduce((a, t) => a + Number(t.lead_count), 0);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Super Admin</p>
          </div>
          <h2 className="font-headline font-bold text-[#1c1410] text-[22px]">Business Accounts</h2>
          <p className="text-[13px] text-[#7a6b5c] mt-1">Create and manage businesses using your CRM.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={fetchTenants} disabled={loading}
            className="p-2.5 rounded-xl border border-black/10 bg-white text-[#7a6b5c] hover:text-primary hover:border-primary/30 transition-all"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button onClick={() => navigate('/admin/create')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-bold transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.28)' }}>
            <Plus className="w-4 h-4" /> Create Business
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Businesses', value: tenants.length, icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
          { label: 'Total Leads', value: totalLeads, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl px-5 py-4 border border-black/5 flex items-center gap-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
              <s.icon className={cn('w-5 h-5', s.color)} />
            </div>
            <div>
              <p className="text-[12px] text-[#7a6b5c]">{s.label}</p>
              <p className="font-headline text-[26px] font-bold text-[#1c1410] leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tenants table */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="px-5 py-3.5 border-b border-black/[0.04]">
          <p className="text-[12px] text-[#7a6b5c]">
            <span className="font-semibold text-[#1c1410]">{tenants.length}</span> business{tenants.length !== 1 ? 'es' : ''}
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-[#c4b09e] animate-spin" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#f5ede3] flex items-center justify-center">
              <Building2 className="w-7 h-7 text-[#c4b09e]" />
            </div>
            <p className="text-[14px] font-semibold text-[#1c1410]">No businesses yet</p>
            <p className="text-[12px] text-[#7a6b5c]">Create your first business account to get started.</p>
            <button onClick={() => navigate('/admin/create')}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>
              <Plus className="w-4 h-4" /> Create Business
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-[13px]">
              <thead>
                <tr className="border-b border-black/5 bg-[#faf8f6]">
                  {['Business', 'Admin Email', 'Plan', 'Users', 'Leads', 'Created', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-[#faf8f6] transition-colors group cursor-pointer">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-semibold text-[#1c1410]">{t.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#7a6b5c]">{t.email}</td>
                    <td className="px-5 py-4">
                      <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-lg capitalize', PLAN_COLORS[t.plan] ?? 'bg-gray-100 text-gray-600')}>
                        {PLAN_LABELS[t.plan] ?? t.plan}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-[#1c1410]">
                        <Users className="w-3.5 h-3.5 text-[#b09e8d]" /> {t.user_count}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-[#1c1410]">
                        <Layers className="w-3.5 h-3.5 text-[#b09e8d]" /> {t.lead_count}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[#7a6b5c]">
                        <Calendar className="w-3.5 h-3.5 text-[#b09e8d]" />
                        {format(new Date(t.created_at), 'dd MMM yyyy')}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <ChevronRight className="w-4 h-4 text-[#c4b09e] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
