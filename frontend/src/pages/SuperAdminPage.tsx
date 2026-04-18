import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2, Users, TrendingUp, Plus, Copy, Check, X,
  RefreshCw, ShieldCheck, Calendar, Layers, Phone, Mail,
  MapPin, User, ChevronRight,
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
  adminName: string;
  email: string;
  pin: string;
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

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-black/5 text-[#7a6b5c] hover:text-primary transition-colors text-[12px] font-medium">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}

// ── PIN Input ─────────────────────────────────────────────────────────────────

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs[i - 1].current?.focus();
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const digits = value.split('');
    digits[i] = v.slice(-1);
    const next = digits.join('').slice(0, 4);
    onChange(next);
    if (v && i < 3) refs[i + 1].current?.focus();
  };

  return (
    <div className="flex gap-3">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={refs[i]}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          className="w-12 h-12 rounded-xl border-2 border-black/10 text-center text-[20px] font-bold text-[#1c1410] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all bg-white"
        />
      ))}
    </div>
  );
}

// ── Create Business Panel ─────────────────────────────────────────────────────

interface CreatePanelProps {
  onClose: () => void;
  onCreated: (creds: CreatedCredentials) => void;
  onRefresh: () => void;
}

function CreatePanel({ onClose, onCreated, onRefresh }: CreatePanelProps) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', pin: '', plan: 'starter',
    businessName: '', address: '',
  });
  const [loading, setLoading] = useState(false);

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.email || !form.businessName) {
      toast.error('First name, email and business name are required'); return;
    }
    if (form.pin.length !== 4) {
      toast.error('Login PIN must be exactly 4 digits'); return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/tenants', {
        businessName: form.businessName,
        adminName: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        password: form.pin,
        plan: form.plan,
        address: form.address,
        phone: form.phone,
      });
      onCreated({
        businessName: form.businessName,
        adminName: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        pin: form.pin,
      });
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  const inp = 'w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-[13px] text-[#1c1410] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-[#c4b09e] transition-all bg-white';
  const lbl = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-[#7a6b5c] mb-1.5';

  const initials = `${form.firstName[0] ?? ''}${form.lastName[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#faf8f6] rounded-2xl border border-black/5 shadow-2xl w-full max-w-3xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-white" />
            <h3 className="font-headline font-bold text-white text-[17px]">Create New Business</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/[0.06]">

            {/* ── LEFT: Admin Details ── */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-headline font-bold text-[#1c1410] text-[14px]">Admin Details</p>
                  <p className="text-[11px] text-[#7a6b5c]">Person who will manage this business</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>First Name *</label>
                  <input value={form.firstName} onChange={field('firstName')} placeholder="Ranjith" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Last Name</label>
                  <input value={form.lastName} onChange={field('lastName')} placeholder="Kumar" className={inp} />
                </div>
              </div>

              <div>
                <label className={lbl}>Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
                  <input type="email" value={form.email} onChange={field('email')} placeholder="admin@business.com" className={cn(inp, 'pl-9')} />
                </div>
              </div>

              <div>
                <label className={lbl}>Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
                  <input type="tel" value={form.phone} onChange={field('phone')} placeholder="+91 98765 43210" className={cn(inp, 'pl-9')} />
                </div>
              </div>

              <div>
                <label className={lbl}>Login PIN (4 digits) *</label>
                <PinInput value={form.pin} onChange={(v) => setForm((f) => ({ ...f, pin: v }))} />
                <p className="text-[11px] text-[#b09e8d] mt-2">The admin will use this PIN to log in.</p>
              </div>

              <div>
                <label className={lbl}>Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['starter', 'pro', 'enterprise'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, plan: p }))}
                      className={cn(
                        'py-2.5 rounded-xl text-[12px] font-bold border capitalize transition-all',
                        form.plan === p
                          ? 'border-transparent text-white'
                          : 'border-black/10 bg-white text-[#7a6b5c] hover:bg-[#f5ede3]'
                      )}
                      style={form.plan === p ? { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' } : {}}>
                      {PLAN_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Business Details ── */}
            <div className="p-6 space-y-4 bg-white">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className="font-headline font-bold text-[#1c1410] text-[14px]">Business Details</p>
                  <p className="text-[11px] text-[#7a6b5c]">The company this admin represents</p>
                </div>
              </div>

              <div>
                <label className={lbl}>Business Name *</label>
                <input value={form.businessName} onChange={field('businessName')} placeholder="e.g. Acme Corp" className={inp} />
              </div>

              <div>
                <label className={lbl}>Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 w-3.5 h-3.5 text-[#b09e8d]" />
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="123 MG Road, Chennai, Tamil Nadu 600001"
                    rows={3}
                    className={cn(inp, 'pl-9 resize-none')}
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="mt-4 rounded-2xl border-2 border-dashed border-black/10 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09e8d]">Preview</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-[14px] font-bold text-primary shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="font-bold text-[14px] text-[#1c1410]">
                      {form.businessName || <span className="text-[#c4b09e]">Business name</span>}
                    </p>
                    <p className="text-[12px] text-[#7a6b5c]">
                      {form.firstName || 'Admin'} {form.lastName} · {form.email || 'email@business.com'}
                    </p>
                  </div>
                </div>
                {form.address && (
                  <div className="flex items-start gap-1.5 text-[11px] text-[#7a6b5c]">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-[#b09e8d]" />
                    {form.address}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', PLAN_COLORS[form.plan])}>
                    {PLAN_LABELS[form.plan]}
                  </span>
                  {form.pin.length === 4 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                      PIN set ✓
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-black/[0.06] bg-white flex items-center justify-between gap-3">
            <p className="text-[11px] text-[#b09e8d]">
              A fully isolated CRM account will be created for this business.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#faf8f6] transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-60 transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.28)' }}>
                {loading ? 'Creating…' : (<><Plus className="w-4 h-4" /> Create Business</>)}
              </button>
            </div>
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
      <button onClick={onDismiss} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-emerald-100 text-emerald-600">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-white" />
        </div>
        <p className="font-bold text-emerald-800 text-[14px]">
          Business Created — <span className="font-normal">{creds.businessName}</span>
        </p>
      </div>
      <p className="text-[12px] text-emerald-700 mb-3">Share these credentials with <strong>{creds.adminName}</strong>:</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
          { label: 'Login Email', value: creds.email },
          { label: 'Login PIN', value: creds.pin },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-emerald-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{row.label}</p>
              <p className="text-[13px] font-bold text-[#1c1410] mt-0.5 font-mono tracking-widest">{row.value}</p>
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
            <button onClick={() => setShowCreate(true)}
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
                  <tr key={t.id} className="hover:bg-[#faf8f6] transition-colors group">
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

      {/* Create Modal */}
      {showCreate && (
        <CreatePanel
          onClose={() => setShowCreate(false)}
          onCreated={(creds) => { setNewCreds(creds); toast.success(`${creds.businessName} created!`); }}
          onRefresh={fetchTenants}
        />
      )}
    </div>
  );
}
