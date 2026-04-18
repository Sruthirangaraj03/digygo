import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Facebook, RefreshCw, Plus, Eye, Trash2, Check, ExternalLink,
  X, User, Mail, Phone, Calendar, Search, ArrowRight,
} from 'lucide-react';
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

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  submittedAt: string;
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

const MOCK_CONTACTS: Record<string, Contact[]> = {
  mf1: [
    { id: 'c1', name: 'Aarav Sharma', email: 'aarav@example.com', phone: '+91 98765 43210', submittedAt: 'Today, 9:12 AM' },
    { id: 'c2', name: 'Priya Nair', email: 'priya.nair@gmail.com', phone: '+91 87654 32109', submittedAt: 'Today, 8:45 AM' },
    { id: 'c3', name: 'Rahul Mehta', email: 'rahulmehta@outlook.com', phone: '+91 76543 21098', submittedAt: 'Yesterday, 6:30 PM' },
    { id: 'c4', name: 'Sunita Reddy', email: 'sunita.r@yahoo.com', phone: '+91 65432 10987', submittedAt: 'Yesterday, 3:15 PM' },
    { id: 'c5', name: 'Kiran Patel', email: 'kiran.patel@work.com', phone: '+91 54321 09876', submittedAt: 'Apr 16, 11:00 AM' },
    { id: 'c6', name: 'Divya Krishnan', email: 'divya.k@gmail.com', phone: '+91 43210 98765', submittedAt: 'Apr 15, 4:20 PM' },
  ],
  mf2: [
    { id: 'c7', name: 'Sanjay Gupta', email: 'sanjay@company.in', phone: '+91 99887 76655', submittedAt: 'Today, 10:00 AM' },
    { id: 'c8', name: 'Meena Iyer', email: 'meena.iyer@gmail.com', phone: '+91 88776 65544', submittedAt: 'Today, 7:30 AM' },
    { id: 'c9', name: 'Vikram Singh', email: 'vikrams@hotmail.com', phone: '+91 77665 54433', submittedAt: 'Apr 17, 2:00 PM' },
  ],
  mf3: [
    { id: 'c10', name: 'Ananya Das', email: 'ananya.das@techco.io', phone: '+91 66554 43322', submittedAt: 'Apr 16, 9:45 AM' },
    { id: 'c11', name: 'Rohan Joshi', email: 'rohanj@startup.com', phone: '+91 55443 32211', submittedAt: 'Apr 15, 1:30 PM' },
  ],
  mf4: [
    { id: 'c12', name: 'Deepa Menon', email: 'deepa.m@gmail.com', phone: '+91 44332 21100', submittedAt: 'Today, 11:15 AM' },
    { id: 'c13', name: 'Arun Kumar', email: 'arun.k@biz.in', phone: '+91 33221 10099', submittedAt: 'Yesterday, 5:00 PM' },
    { id: 'c14', name: 'Shreya Pillai', email: 'shreya.p@corp.com', phone: '+91 22110 09988', submittedAt: 'Apr 16, 12:30 PM' },
    { id: 'c15', name: 'Nikhil Verma', email: 'nikhil.v@web.dev', phone: '+91 11009 98877', submittedAt: 'Apr 15, 3:45 PM' },
  ],
  mf5: [
    { id: 'c16', name: 'Lakshmi Rao', email: 'lakshmi.rao@mail.com', phone: '+91 99001 12233', submittedAt: 'Apr 17, 8:00 AM' },
    { id: 'c17', name: 'Suresh Babu', email: 'suresh.b@organics.in', phone: '+91 88990 01122', submittedAt: 'Apr 16, 10:20 AM' },
  ],
  mf6: [
    { id: 'c18', name: 'Kavitha Nambiar', email: 'kavitha@greenleaf.in', phone: '+91 77889 90011', submittedAt: 'Apr 14, 2:15 PM' },
  ],
  mf7: [
    { id: 'c19', name: 'Mohan Raj', email: 'mohan.raj@corp.co', phone: '+91 66778 89900', submittedAt: 'Today, 9:50 AM' },
    { id: 'c20', name: 'Nithya Subramaniam', email: 'nithya.s@mail.in', phone: '+91 55667 78899', submittedAt: 'Yesterday, 4:10 PM' },
    { id: 'c21', name: 'Balaji Venkat', email: 'balaji.v@agency.com', phone: '+91 44556 67788', submittedAt: 'Apr 16, 11:30 AM' },
  ],
};

export default function MetaFormsPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState(MOCK_FORMS);
  const [syncing, setSyncing] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string>('all');
  const [openForm, setOpenForm] = useState<MetaForm | null>(null);
  const [contactSearch, setContactSearch] = useState('');

  const filtered = useMemo(() =>
    selectedPage === 'all' ? forms : forms.filter((f) => f.pageId === selectedPage),
    [forms, selectedPage]
  );

  const contacts = useMemo(() => {
    const all = openForm ? (MOCK_CONTACTS[openForm.id] ?? []) : [];
    if (!contactSearch.trim()) return all;
    const q = contactSearch.toLowerCase();
    return all.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }, [openForm, contactSearch]);

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
    if (openForm?.id === id) setOpenForm(null);
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

      {/* Connected Pages */}
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

      {/* Lead Forms table */}
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
                  selectedPage === p.id ? 'bg-primary text-white' : 'text-[#7a6b5c] hover:bg-[#f5ede3] hover:text-primary'
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
                <tr
                  key={form.id}
                  onClick={() => { setOpenForm(form); setContactSearch(''); }}
                  className={cn(
                    'border-b border-black/5 last:border-0 transition-colors cursor-pointer group',
                    openForm?.id === form.id ? 'bg-primary/5' : 'hover:bg-[#faf8f6]'
                  )}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[#1c1410] group-hover:text-primary transition-colors">
                        {form.name}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#c4b09e] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[10px] text-[#b09e8d] mt-0.5">Click to view contacts</p>
                  </td>
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
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <Switch checked={form.status === 'active'} onCheckedChange={() => toggleForm(form.id)} />
                  </td>
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setOpenForm(form); setContactSearch(''); }}
                        className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors"
                        title="View contacts"
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

      {/* Contacts slide-in panel */}
      {openForm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpenForm(null)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">

            {/* Panel header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-black/5">
              <div>
                <h3 className="font-headline font-bold text-[#1c1410] text-[15px]">{openForm.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center">
                    <Facebook className="w-2.5 h-2.5 text-blue-600" />
                  </div>
                  <span className="text-[11px] text-[#7a6b5c]">{openForm.pageName}</span>
                  <span className="text-[11px] text-[#b09e8d]">·</span>
                  <span className="text-[11px] font-semibold text-[#1c1410]">{openForm.leadsCount.toLocaleString()} contacts</span>
                </div>
              </div>
              <button
                onClick={() => setOpenForm(null)}
                className="p-1.5 rounded-xl hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-[#1c1410] transition-colors mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-black/5">
              <div className="flex items-center gap-2 bg-[#faf8f6] border border-black/8 rounded-xl px-3 py-2">
                <Search className="w-3.5 h-3.5 text-[#b09e8d] shrink-0" />
                <input
                  type="text"
                  placeholder="Search by name, email or phone…"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[12px] text-[#1c1410] placeholder-[#b09e8d] outline-none"
                />
                {contactSearch && (
                  <button onClick={() => setContactSearch('')} className="text-[#b09e8d] hover:text-primary transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto">
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                  <div className="w-12 h-12 bg-[#f5ede3] rounded-2xl flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#1c1410]">No contacts found</p>
                  <p className="text-[12px] text-[#7a6b5c]">
                    {contactSearch ? 'Try a different search term.' : 'No one has submitted this form yet.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-black/5">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-start gap-3 px-5 py-4 hover:bg-[#faf8f6] transition-colors cursor-pointer group"
                      onClick={() => toast.info(`Opening lead profile for ${contact.name}`)}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[13px] font-bold text-primary">
                          {contact.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1c1410] group-hover:text-primary transition-colors truncate">
                          {contact.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-[#b09e8d] shrink-0" />
                          <span className="text-[11px] text-[#7a6b5c] truncate">{contact.email}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-[#b09e8d] shrink-0" />
                          <span className="text-[11px] text-[#7a6b5c]">{contact.phone}</span>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-[#b09e8d]">
                          <Calendar className="w-3 h-3" />
                          <span className="whitespace-nowrap">{contact.submittedAt}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="px-5 py-4 border-t border-black/5 flex items-center justify-between">
              <span className="text-[11px] text-[#7a6b5c]">
                Showing {contacts.length} of {MOCK_CONTACTS[openForm.id]?.length ?? 0} contacts
              </span>
              <Button size="sm" variant="outline" onClick={() => toast.info('Export contacts as CSV')}>
                Export CSV
              </Button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
