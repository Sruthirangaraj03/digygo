import { useState, useEffect } from 'react';
import {
  RefreshCw, Check, ArrowLeft, ShieldCheck, ChevronRight,
  Globe, Phone, MapPin, Building2, Briefcase, Clock, DollarSign, CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useCompanyStore } from '@/store/companyStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';

const TIMEZONES = ['Asia/Kolkata (IST +5:30)', 'Asia/Dubai (GST +4:00)', 'Europe/London (GMT +0:00)', 'America/New_York (EST -5:00)', 'America/Los_Angeles (PST -8:00)'];
const CURRENCIES = ['INR — Indian Rupee (₹)', 'USD — US Dollar ($)', 'EUR — Euro (€)', 'GBP — British Pound (£)', 'AED — UAE Dirham (د.إ)'];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-[#7a6b5c] mb-1.5';
const selectCls = 'w-full bg-[#f5f0eb] border border-black/8 rounded-xl px-4 py-2.5 text-[13px] text-[#1c1410] outline-none focus:ring-2 focus:ring-primary/20 transition-shadow appearance-none cursor-pointer';

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>
        <span className="inline-flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-[#9e8e7e]" />
          {label}
        </span>
      </label>
      {children}
    </div>
  );
}

export default function CompanyDetailsPage() {
  const navigate = useNavigate();
  const { setCompanyName } = useCompanyStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [plan, setPlan] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [form, setForm] = useState({
    name: '', legalName: '', website: '', phone: '',
    address: '', timezone: TIMEZONES[0], currency: CURRENCIES[0],
    dateFormat: DATE_FORMATS[0], industry: '',
  });

  useEffect(() => {
    api.get<any>('/api/settings').then((s) => {
      if (!s) return;
      setOwnerName(s.owner_name ?? '');
      setOwnerEmail(s.owner_email ?? '');
      setPlan(s.plan ?? '');
      if (s.tenant_created_at) {
        setMemberSince(new Date(s.tenant_created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));
      }
      setForm({
        name:       s.workspace_name               ?? '',
        legalName:  s.legal_name                   ?? '',
        website:    s.website                      ?? '',
        phone:      s.tenant_phone ?? s.phone      ?? '',
        address:    s.tenant_address ?? s.address  ?? '',
        timezone:   s.timezone                     ?? TIMEZONES[0],
        currency:   s.currency                     ?? CURRENCIES[0],
        dateFormat: s.date_format                  ?? DATE_FORMATS[0],
        industry:   s.industry                     ?? '',
      });
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Workspace name is required'); return; }
    setSaving(true);
    try {
      await api.put('/api/settings', {
        workspace_name: form.name.trim(),
        legal_name:     form.legalName,
        website:        form.website,
        phone:          form.phone,
        address:        form.address,
        timezone:       form.timezone,
        currency:       form.currency,
        date_format:    form.dateFormat,
        industry:       form.industry,
      });
      setCompanyName(form.name.trim());
      toast.success('Company details saved');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const initials = form.name.trim()
    ? form.name.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-[#9e8e7e] text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 pb-10">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-[#1c1410] transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <h2 className="font-headline font-bold text-[17px] text-[#1c1410]">Company Details</h2>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving
            ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
            : <><Check className="w-3.5 h-3.5 mr-1.5" /> Save Changes</>}
        </Button>
      </div>

      {/* Identity card */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 60%, #f97316 100%)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-[22px] font-bold shrink-0 select-none">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline font-bold text-[18px] leading-tight truncate">
              {form.name || 'Your Company'}
            </h3>
            {ownerName && (
              <p className="text-white/80 text-[13px] mt-0.5 truncate">{ownerName}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {plan && (
                <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize">
                  {plan} Plan
                </span>
              )}
              {memberSince && (
                <span className="text-white/60 text-[11px]">Member since {memberSince}</span>
              )}
            </div>
          </div>
        </div>
        {ownerEmail && (
          <div className="mt-4 pt-4 border-t border-white/20 text-[12px] text-white/70">
            Owner: <span className="text-white font-medium">{ownerEmail}</span>
          </div>
        )}
      </div>

      {/* Business Information */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5">
          <h3 className="font-headline font-semibold text-[14px] text-[#1c1410]">Business Information</h3>
          <p className="text-[11px] text-[#9e8e7e] mt-0.5">Your company profile and contact details</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Workspace Name *" icon={Building2}>
            <Input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Your Company Name"
              className="text-[13px]"
            />
          </Field>
          <Field label="Legal Name" icon={Briefcase}>
            <Input
              value={form.legalName}
              onChange={(e) => update('legalName', e.target.value)}
              placeholder="Legal entity name"
              className="text-[13px]"
            />
          </Field>
          <Field label="Website" icon={Globe}>
            <Input
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="https://yourcompany.com"
              type="url"
              className="text-[13px]"
            />
          </Field>
          <Field label="Industry" icon={Briefcase}>
            <Input
              value={form.industry}
              onChange={(e) => update('industry', e.target.value)}
              placeholder="e.g. Technology, Retail"
              className="text-[13px]"
            />
          </Field>
          <Field label="Phone" icon={Phone}>
            <Input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+91 98765 43210"
              type="tel"
              className="text-[13px]"
            />
          </Field>
          <Field label="Business Address" icon={MapPin}>
            <Input
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Street, City, State, PIN"
              className="text-[13px]"
            />
          </Field>
        </div>
      </div>

      {/* Localization */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5">
          <h3 className="font-headline font-semibold text-[14px] text-[#1c1410]">Localization</h3>
          <p className="text-[11px] text-[#9e8e7e] mt-0.5">Regional settings for dates, currency and time</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Timezone" icon={Clock}>
            <select
              className={selectCls}
              value={form.timezone}
              onChange={(e) => update('timezone', e.target.value)}
            >
              {TIMEZONES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Currency" icon={DollarSign}>
            <select
              className={selectCls}
              value={form.currency}
              onChange={(e) => update('currency', e.target.value)}
            >
              {CURRENCIES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Date Format" icon={CalendarDays}>
            <select
              className={selectCls}
              value={form.dateFormat}
              onChange={(e) => update('dateFormat', e.target.value)}
            >
              {DATE_FORMATS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Super Admin panel link */}
      {isSuperAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className="w-full bg-white rounded-2xl border border-black/5 card-shadow p-4 flex items-center gap-3 hover:bg-[#faf8f6] transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#1c1410]">Business Accounts</p>
            <p className="text-[11px] text-[#9e8e7e]">Manage all CRM accounts under DigyGo</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#c4b09e] group-hover:text-primary transition-colors shrink-0" />
        </button>
      )}

    </div>
  );
}
