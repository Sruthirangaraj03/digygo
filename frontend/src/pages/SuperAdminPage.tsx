import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, TrendingUp, Plus, Copy, Check, X,
  RefreshCw, Eye, EyeOff, ShieldCheck, Calendar, Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  created_at: string;
  user_count: number;
  lead_count: number;
}

interface CreatedCredentials {
  businessName: string;
  email: string;
  password: string;
}

const PLAN_COLORS: Record<string, string> = {
  starter:    'bg-gray-100 text-gray-600',
  pro:        'bg-blue-50 text-blue-600',
  enterprise: 'bg-purple-50 text-purple-600',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-black/5 text-[#7a6b5c] hover:text-primary transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Create Business Modal ─────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: (creds: CreatedCredentials) => void;
  onRefresh: () => void;
}

function CreateModal({ onClose, onCreated, onRefresh }: CreateModalProps) {
  const [form, setForm] = useState({ businessName: '', adminName: '', email: '', password: '', plan: 'starter' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.adminName || !form.email || !form.password) {
      toast.error('All fields are required'); return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/tenants', form);
      onCreated({ businessName: form.businessName, email: form.email, password: form.password });
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-[13px] text-[#1c1410] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-[#c4b09e] transition-all bg-white';
  const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-[#7a6b5c] mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-black/5 w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5"
          style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-white" />
            <h3 className="font-headline font-bold text-white text-[16px]">Create New Business</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Business Name *</label>
            <input value={form.businessName} onChange={set('businessName')} placeholder="e.g. Acme Corp" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Admin Full Name *</label>
            <input value={form.adminName} onChange={set('adminName')} placeholder="e.g. Ranjith Kumar" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Login Email *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="admin@business.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Password *</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Set a secure password"
                className={cn(inputCls, 'pr-11')}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-[#7a6b5c] hover:text-primary transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Plan</label>
            <select value={form.plan} onChange={set('plan')} className={inputCls}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[11px] text-amber-700 leading-relaxed">
              This creates a fully isolated business account. The admin can log in immediately with these credentials and manage their own CRM — completely separate from other businesses.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#faf8f6] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.28)' }}>
              {loading ? 'Creating…' : 'Create Business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Credentials Card ──────────────────────────────────────────────────────────

function CredentialsCard({ creds, onDismiss }: { creds: CreatedCredentials; onDismiss: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 relative">
      <button onClick={onDismiss} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-emerald-100 text-emerald-500">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
        <p className="font-bold text-emerald-800 text-[14px]">Business Created — <span className="font-normal">{creds.businessName}</span></p>
      </div>
      <p className="text-[12px] text-emerald-700 mb-3">Share these credentials with the business admin:</p>
      <div className="space-y-2">
        {[{ label: 'Login Email', value: creds.email }, { label: 'Password', value: creds.password }].map((row) => (
          <div key={row.label} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-emerald-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{row.label}</p>
              <p className="text-[13px] font-semibold text-[#1c1410] mt-0.5 font-mono">{row.value}</p>
            </div>
            <CopyButton text={row.value} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newCreds, setNewCreds] = useState<CreatedCredentials | null>(null);

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
          <button onClick={() => setShowCreate(true)}
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

      {/* New credentials alert */}
      {newCreds && <CredentialsCard creds={newCreds} onDismiss={() => setNewCreds(null)} />}

      {/* Tenants table */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="px-5 py-3.5 border-b border-black/[0.04] flex items-center justify-between">
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
            <button onClick={() => setShowCreate(true)}
              className="mt-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>
              <Plus className="w-4 h-4 inline mr-1" /> Create Business
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-[13px]">
              <thead>
                <tr className="border-b border-black/5 bg-[#faf8f6]">
                  {['Business', 'Login Email', 'Plan', 'Users', 'Leads', 'Created', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-[#faf8f6] transition-colors">

                    {/* Business name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-semibold text-[#1c1410]">{t.name}</p>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4">
                      <p className="text-[#7a6b5c]">{t.email}</p>
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-4">
                      <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-lg capitalize', PLAN_COLORS[t.plan] ?? 'bg-gray-100 text-gray-600')}>
                        {t.plan}
                      </span>
                    </td>

                    {/* Users */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-[#1c1410]">
                        <Users className="w-3.5 h-3.5 text-[#b09e8d]" />
                        {t.user_count}
                      </div>
                    </td>

                    {/* Leads */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-[#1c1410]">
                        <Layers className="w-3.5 h-3.5 text-[#b09e8d]" />
                        {t.lead_count}
                      </div>
                    </td>

                    {/* Created */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[#7a6b5c]">
                        <Calendar className="w-3.5 h-3.5 text-[#b09e8d]" />
                        {format(new Date(t.created_at), 'dd MMM yyyy')}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <CopyButton text={t.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(creds) => { setNewCreds(creds); toast.success(`${creds.businessName} created!`); }}
          onRefresh={fetchTenants}
        />
      )}
    </div>
  );
}
