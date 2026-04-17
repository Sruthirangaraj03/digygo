import { useState } from 'react';
import { Building2, Upload, RefreshCw, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const TIMEZONES = ['Asia/Kolkata (IST +5:30)', 'Asia/Dubai (GST +4:00)', 'Europe/London (GMT +0:00)', 'America/New_York (EST -5:00)', 'America/Los_Angeles (PST -8:00)'];
const CURRENCIES = ['INR — Indian Rupee (₹)', 'USD — US Dollar ($)', 'EUR — Euro (€)', 'GBP — British Pound (£)', 'AED — UAE Dirham (د.إ)'];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const selectCls = "w-full bg-muted border-none rounded-xl px-4 py-3 text-sm text-[#1c1410] outline-none focus:ring-2 focus:ring-primary/20 transition-shadow appearance-none";
const labelCls = "block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-1.5 ml-1";

export default function CompanyDetailsPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: 'NexCRM Demo Workspace',
    legalName: 'NexCRM Technologies Pvt. Ltd.',
    website: 'https://digygocrm.com',
    phone: '+91 98765 43210',
    email: 'admin@digygocrm.com',
    address: '42, Tech Park, Whitefield, Bengaluru – 560066',
    timezone: TIMEZONES[0],
    currency: CURRENCIES[0],
    dateFormat: DATE_FORMATS[0],
    industry: 'Technology',
  });

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    setTimeout(() => { setSaving(false); toast.success('Company details saved'); }, 1000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-[#1c1410] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
        <h3 className="font-headline font-bold text-[#1c1410] mb-4">Workspace Identity</h3>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-9 h-9 text-primary/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1c1410] mb-1">Company Logo</p>
            <p className="text-[12px] text-[#7a6b5c] mb-3">PNG or JPG, max 2MB. Recommended: 256×256px</p>
            <Button variant="outline" size="sm" onClick={() => toast.info('File picker would open here')}>
              <Upload className="w-4 h-4 mr-1" /> Upload Logo
            </Button>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6 space-y-4">
        <h3 className="font-headline font-bold text-[#1c1410] mb-2">Basic Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Workspace Name *</label>
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Your Company Name" />
          </div>
          <div>
            <label className={labelCls}>Legal Name</label>
            <Input value={form.legalName} onChange={(e) => update('legalName', e.target.value)} placeholder="Legal entity name" />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <Input value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://yourcompany.com" type="url" />
          </div>
          <div>
            <label className={labelCls}>Industry</label>
            <Input value={form.industry} onChange={(e) => update('industry', e.target.value)} placeholder="e.g. Technology, Retail" />
          </div>
          <div>
            <label className={labelCls}>Support Phone</label>
            <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98765 43210" type="tel" />
          </div>
          <div>
            <label className={labelCls}>Support Email</label>
            <Input value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="admin@company.com" type="email" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Business Address</label>
            <Input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street, City, State, PIN" />
          </div>
        </div>
      </div>

      {/* Localization */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6 space-y-4">
        <h3 className="font-headline font-bold text-[#1c1410] mb-2">Localization</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Timezone', key: 'timezone', options: TIMEZONES },
            { label: 'Currency', key: 'currency', options: CURRENCIES },
            { label: 'Date Format', key: 'dateFormat', options: DATE_FORMATS },
          ].map(({ label, key, options }) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <select
                className={selectCls}
                value={form[key as keyof typeof form]}
                onChange={(e) => update(key, e.target.value)}
              >
                {options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving
            ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
            : <><Check className="w-4 h-4 mr-1" /> Save Changes</>}
        </Button>
        <Button variant="outline" onClick={() => navigate('/settings')}>Cancel</Button>
      </div>
    </div>
  );
}
