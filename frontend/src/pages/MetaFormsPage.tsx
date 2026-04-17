import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Facebook, RefreshCw, Plus, Eye, Trash2, Check, ExternalLink, FileText, Activity, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MetaForm {
  id: string;
  name: string;
  pageId: string;
  pageName: string;
  formId: string;
  leadsCount: number;
  status: 'active' | 'inactive';
  lastSync: string;
}

const MOCK_PAGES = [
  { id: 'page-1', name: 'Saral Bakery', status: 'connected', category: 'Food & Beverage' },
  { id: 'page-2', name: 'TechWave Solutions', status: 'connected', category: 'Technology' },
  { id: 'page-3', name: 'GreenLeaf Organics', status: 'connected', category: 'Retail' },
];

const MOCK_FORMS: MetaForm[] = [
  { id: 'mf1', name: 'Demo Request Form', pageId: 'page-1', pageName: 'Saral Bakery', formId: 'fb-form-001', leadsCount: 342, status: 'active', lastSync: '2 min ago' },
  { id: 'mf2', name: 'Contact Us Form', pageId: 'page-1', pageName: 'Saral Bakery', formId: 'fb-form-002', leadsCount: 198, status: 'active', lastSync: '15 min ago' },
  { id: 'mf3', name: 'Product Inquiry', pageId: 'page-2', pageName: 'TechWave Solutions', formId: 'fb-form-003', leadsCount: 87, status: 'inactive', lastSync: '1 hr ago' },
  { id: 'mf4', name: 'Free Trial Signup', pageId: 'page-2', pageName: 'TechWave Solutions', formId: 'fb-form-004', leadsCount: 256, status: 'active', lastSync: '5 min ago' },
  { id: 'mf5', name: 'Newsletter Signup', pageId: 'page-3', pageName: 'GreenLeaf Organics', formId: 'fb-form-005', leadsCount: 124, status: 'active', lastSync: '30 min ago' },
  { id: 'mf6', name: 'Bulk Order Request', pageId: 'page-3', pageName: 'GreenLeaf Organics', formId: 'fb-form-006', leadsCount: 45, status: 'inactive', lastSync: '2 hr ago' },
  { id: 'mf7', name: 'Consultation Request', pageId: 'page-3', pageName: 'GreenLeaf Organics', formId: 'fb-form-007', leadsCount: 188, status: 'active', lastSync: '10 min ago' },
];

export default function MetaFormsPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState(MOCK_FORMS);
  const [syncing, setSyncing] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string>('all');

  const filtered = useMemo(() =>
    selectedPage === 'all' ? forms : forms.filter((f) => f.pageId === selectedPage),
    [forms, selectedPage]
  );

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success('Forms synced from Meta');
    }, 1500);
  };

  const toggleForm = (id: string) => {
    setForms(forms.map((f) => f.id === id ? { ...f, status: f.status === 'active' ? 'inactive' : 'active' } : f));
    const form = forms.find((f) => f.id === id);
    toast.success(`${form?.name} ${form?.status === 'active' ? 'paused' : 'activated'}`);
  };

  const deleteForm = (id: string) => {
    const form = forms.find((f) => f.id === id);
    setForms(forms.filter((f) => f.id !== id));
    toast.success(`"${form?.name}" removed`);
  };

  const totalLeads = forms.reduce((s, f) => s + f.leadsCount, 0);
  const activeForms = forms.filter((f) => f.status === 'active').length;

  const statCards = [
    { label: 'Pages Connected', value: MOCK_PAGES.length, icon: Facebook, color: 'text-primary' },
    { label: 'Total Forms', value: forms.length, icon: FileText, color: 'text-primary' },
    { label: 'Active Forms', value: activeForms, icon: Activity, color: 'text-emerald-500' },
    { label: 'Total Leads', value: totalLeads.toLocaleString(), icon: Users, color: 'text-primary' },
  ];

  return (
    <div className="space-y-8">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/lead-generation')}
            className="p-2 rounded-xl hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-[#1c1410] transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
          <Button onClick={() => toast.info('Opens Meta Business Manager to create a new form')}>
            <Plus className="w-4 h-4" /> Connect Form
          </Button>
        </div>
      </div>

      {/* Stat Cards — same style as Dashboard */}
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
              </div>
            </div>
          ) : (
            <div
              key={s.label}
              className="bg-white rounded-2xl px-6 py-5 card-shadow border border-black/5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <s.icon className={cn('w-5 h-5', s.color)} />
              </div>
              <div>
                <p className="text-[13px] text-[#7a6b5c] mb-1">{s.label}</p>
                <h3 className="font-headline text-[28px] font-bold text-[#1c1410] tracking-tight">{s.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connected Pages */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-headline font-bold text-[#1c1410]">Connected Pages</h3>
            <p className="text-[12px] text-[#7a6b5c] mt-0.5">{MOCK_PAGES.length} pages linked to your account</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.info('Redirects to Meta Business Manager')}>
            <ExternalLink className="w-3 h-3" /> Manage in Meta
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MOCK_PAGES.map((page) => (
            <div key={page.id} className="flex items-center gap-4 p-4 rounded-xl border border-black/5 hover:bg-[#faf8f6] transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Facebook className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1c1410] truncate">{page.name}</p>
                <p className="text-[11px] text-[#7a6b5c] mt-0.5">{page.category}</p>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px] font-semibold shrink-0">
                <Check className="w-3 h-3 mr-1" />Live
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Forms Table */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 gap-3">
          <div>
            <h3 className="font-headline font-bold text-[#1c1410]">Lead Forms</h3>
            <p className="text-[12px] text-[#7a6b5c] mt-0.5">{filtered.length} forms{selectedPage !== 'all' ? ' for this page' : ' total'}</p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {[{ id: 'all', label: 'All' }, ...MOCK_PAGES.map((p) => ({ id: p.id, label: p.name }))].map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPage(p.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                  selectedPage === p.id
                    ? 'bg-primary text-white'
                    : 'text-[#7a6b5c] hover:bg-[#f5ede3] hover:text-primary'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/5 bg-[#faf8f6]">
                {['Form Name', 'Page', 'Form ID', 'Leads', 'Last Sync', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-6 py-3.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((form) => (
                <tr key={form.id} className="border-b border-black/5 last:border-0 hover:bg-[#faf8f6] transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-[#1c1410]">{form.name}</td>
                  <td className="px-6 py-4 text-[13px] text-[#7a6b5c]">{form.pageName}</td>
                  <td className="px-6 py-4 text-[11px] text-[#7a6b5c] font-mono">{form.formId}</td>
                  <td className="px-6 py-4">
                    <span className="font-headline text-[15px] font-bold text-[#1c1410]">{form.leadsCount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[#7a6b5c]">{form.lastSync}</td>
                  <td className="px-6 py-4">
                    <Switch checked={form.status === 'active'} onCheckedChange={() => toggleForm(form.id)} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => toast.info(`Viewing leads for "${form.name}"`)}
                        className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteForm(form.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#7a6b5c] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-[13px] text-[#7a6b5c]">
                    No forms for this page
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
