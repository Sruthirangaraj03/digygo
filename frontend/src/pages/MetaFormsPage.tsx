import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Facebook, RefreshCw, Plus, Eye, Trash2, Check, ExternalLink } from 'lucide-react';
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
    setTimeout(() => { setSyncing(false); toast.success('Forms synced from Meta'); }, 1500);
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

  const activeForms = forms.filter((f) => f.status === 'active').length;
  const totalLeads = forms.reduce((s, f) => s + f.leadsCount, 0);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-headline font-bold text-[#1c1410] text-[16px]">Meta Forms</h2>
          <p className="text-[12px] text-[#7a6b5c] mt-0.5">
            {activeForms} active · {forms.length} total · {totalLeads.toLocaleString()} leads captured
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
          <Button size="sm" onClick={() => toast.info('Opens Meta Business Manager to create a new form')}>
            <Plus className="w-3.5 h-3.5" /> Connect Form
          </Button>
        </div>
      </div>

      {/* Connected Pages — compact strip */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-semibold text-[#1c1410]">Connected Pages</p>
          <button
            onClick={() => toast.info('Redirects to Meta Business Manager')}
            className="flex items-center gap-1 text-[11px] text-[#7a6b5c] hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Manage in Meta
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOCK_PAGES.map((page) => (
            <div
              key={page.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/5 bg-[#faf8f6] hover:bg-blue-50 hover:border-blue-100 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Facebook className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-[12px] font-semibold text-[#1c1410]">{page.name}</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px] font-semibold px-1.5 py-0">
                <Check className="w-2.5 h-2.5 mr-0.5" />Live
              </Badge>
            </div>
          ))}
          <button
            onClick={() => toast.info('Connect another Facebook/Instagram page')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-black/15 text-[12px] text-[#7a6b5c] hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Page
          </button>
        </div>
      </div>

      {/* Lead Forms */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 gap-3">
          <p className="text-[13px] font-bold text-[#1c1410]">
            Lead Forms
            <span className="ml-2 text-[11px] font-normal text-[#7a6b5c]">{filtered.length} shown</span>
          </p>
          <div className="flex gap-1 overflow-x-auto">
            {[{ id: 'all', label: 'All Pages' }, ...MOCK_PAGES.map((p) => ({ id: p.id, label: p.name }))].map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPage(p.id)}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors',
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
                {['Form Name', 'Page', 'Leads', 'Last Sync', 'Active', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((form) => (
                <tr key={form.id} className="border-b border-black/5 last:border-0 hover:bg-[#faf8f6] transition-colors">
                  <td className="px-5 py-3.5 text-[13px] font-semibold text-[#1c1410]">{form.name}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                        <Facebook className="w-3 h-3 text-blue-600" />
                      </div>
                      <span className="text-[12px] text-[#5c5245]">{form.pageName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-[14px] text-[#1c1410]">{form.leadsCount.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[12px] text-[#7a6b5c]">{form.lastSync}</td>
                  <td className="px-5 py-3.5">
                    <Switch checked={form.status === 'active'} onCheckedChange={() => toggleForm(form.id)} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1">
                      <button
                        onClick={() => toast.info(`Viewing leads for "${form.name}"`)}
                        className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors"
                        title="View leads"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteForm(form.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#7a6b5c] hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-[13px] text-[#7a6b5c]">
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
