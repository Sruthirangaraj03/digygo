import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Copy, Layout, X, Check, Globe, Eye, BarChart2, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  template: string;
  views: number;
  leads: number;
  status: 'published' | 'draft';
  createdAt: string;
}

const TEMPLATES = ['Product Launch', 'Lead Capture', 'Webinar Registration', 'Free Trial', 'Contact Us'];

const defaultPages: LandingPage[] = [
  { id: 'lp-1', title: 'Free Demo Booking', slug: 'free-demo-booking', template: 'Lead Capture', views: 1243, leads: 89, status: 'published', createdAt: '2025-02-10' },
  { id: 'lp-2', title: 'Enterprise Webinar', slug: 'enterprise-webinar-q1', template: 'Webinar Registration', views: 892, leads: 54, status: 'published', createdAt: '2025-03-01' },
  { id: 'lp-3', title: 'Summer Sale Campaign', slug: 'summer-sale-2025', template: 'Product Launch', views: 321, leads: 22, status: 'draft', createdAt: '2025-04-05' },
];

// ── Modal ──────────────────────────────────────────────────────────────────────

function PageModal({ initial, onClose, onSave }: {
  initial?: LandingPage | null;
  onClose: () => void;
  onSave: (data: Pick<LandingPage, 'title' | 'slug' | 'template' | 'status'>) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [template, setTemplate] = useState(initial?.template ?? TEMPLATES[0]);
  const [status, setStatus] = useState<LandingPage['status']>(initial?.status ?? 'draft');

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleSave = () => {
    if (!title.trim()) { toast.error('Page title is required'); return; }
    onSave({ title: title.trim(), slug, template, status });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl border border-black/5 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
          <h3 className="font-headline font-bold text-[#1c1410]">{initial ? 'Edit Page' : 'Create Landing Page'}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-2">Page Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Free Demo Booking" />
            {title && (
              <p className="text-[11px] text-[#7a6b5c] mt-1.5 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span className="font-mono">digygocrm.com/p/{slug}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-2">Template</label>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all text-left',
                    template === t
                      ? 'border-primary/30 bg-primary/5 text-primary'
                      : 'border-black/5 text-[#7a6b5c] hover:border-primary/20 hover:bg-[#f5ede3] hover:text-primary'
                  )}
                >
                  <Layout className="w-4 h-4 shrink-0" />
                  {t}
                  {template === t && <Check className="w-4 h-4 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-black/5">
            <div>
              <p className="text-[13px] font-semibold text-[#1c1410]">Publish Immediately</p>
              <p className="text-[11px] text-[#7a6b5c] mt-0.5">Make page live after saving</p>
            </div>
            <Switch checked={status === 'published'} onCheckedChange={(v) => setStatus(v ? 'published' : 'draft')} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-black/5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            <Check className="w-4 h-4" /> {initial ? 'Save Changes' : 'Create Page'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LandingPagesPage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState(defaultPages);
  const [showModal, setShowModal] = useState(false);
  const [editPage, setEditPage] = useState<LandingPage | null>(null);

  const handleCreate = (data: Pick<LandingPage, 'title' | 'slug' | 'template' | 'status'>) => {
    setPages([...pages, { ...data, id: `lp-${Date.now()}`, views: 0, leads: 0, createdAt: new Date().toISOString().split('T')[0] }]);
    setShowModal(false);
    toast.success(`"${data.title}" created`);
  };

  const handleEdit = (data: Pick<LandingPage, 'title' | 'slug' | 'template' | 'status'>) => {
    if (!editPage) return;
    setPages(pages.map((p) => p.id === editPage.id ? { ...p, ...data } : p));
    setEditPage(null);
    toast.success('Page updated');
  };

  const toggleStatus = (id: string) => {
    const page = pages.find((p) => p.id === id)!;
    setPages(pages.map((p) => p.id === id ? { ...p, status: p.status === 'published' ? 'draft' : 'published' } : p));
    toast.success(`"${page.title}" ${page.status === 'published' ? 'unpublished' : 'published'}`);
  };

  const deletePage = (id: string) => {
    const page = pages.find((p) => p.id === id);
    setPages(pages.filter((p) => p.id !== id));
    toast.success(`"${page?.title}" deleted`);
  };

  const totalViews = pages.reduce((s, p) => s + p.views, 0);
  const totalLeads = pages.reduce((s, p) => s + p.leads, 0);
  const published = pages.filter((p) => p.status === 'published').length;

  const statCards = [
    { label: 'Total Pages', value: pages.length, icon: Layout, color: 'text-primary' },
    { label: 'Published', value: published, icon: Globe, color: 'text-emerald-500' },
    { label: 'Total Views', value: totalViews.toLocaleString(), icon: Eye, color: 'text-primary' },
    { label: 'Leads Generated', value: totalLeads.toLocaleString(), icon: Users, color: 'text-primary' },
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
        <Button onClick={() => setShowModal(true)} className="shrink-0">
          <Plus className="w-4 h-4" /> New Page
        </Button>
      </div>

      {/* Stat Cards — same pattern as Dashboard */}
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

      {/* Page Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pages.map((page) => {
          const convRate = page.views > 0 ? ((page.leads / page.views) * 100).toFixed(1) : '0';
          return (
            <div
              key={page.id}
              className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              {/* Preview banner */}
              <div
                className="h-24 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(194,65,12,0.08) 0%, rgba(249,115,22,0.12) 100%)' }}
              >
                <Layout className="w-10 h-10 text-primary/30" />
              </div>

              <div className="p-6 space-y-4">
                {/* Title + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-headline font-bold text-[#1c1410]">{page.title}</h3>
                    <p className="text-[11px] text-[#7a6b5c] font-mono truncate mt-0.5">digygocrm.com/p/{page.slug}</p>
                  </div>
                  <Badge className={cn(
                    'border-0 text-[10px] font-semibold shrink-0',
                    page.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f5ede3] text-[#7a6b5c]'
                  )}>
                    {page.status === 'published' ? 'Published' : 'Draft'}
                  </Badge>
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#faf8f6] rounded-xl p-3 text-center">
                    <p className="font-headline text-[18px] font-bold text-[#1c1410] leading-none">{page.views.toLocaleString()}</p>
                    <p className="text-[10px] text-[#7a6b5c] mt-1">Views</p>
                  </div>
                  <div className="bg-[#faf8f6] rounded-xl p-3 text-center">
                    <p className="font-headline text-[18px] font-bold text-primary leading-none">{page.leads}</p>
                    <p className="text-[10px] text-[#7a6b5c] mt-1">Leads</p>
                  </div>
                  <div className="bg-[#faf8f6] rounded-xl p-3 text-center">
                    <p className="font-headline text-[18px] font-bold text-emerald-600 leading-none">{convRate}%</p>
                    <p className="text-[10px] text-[#7a6b5c] mt-1">Conv.</p>
                  </div>
                </div>

                <p className="text-[11px] text-[#7a6b5c]">Template: <span className="font-medium text-[#1c1410]">{page.template}</span></p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Switch checked={page.status === 'published'} onCheckedChange={() => toggleStatus(page.id)} />
                    <span className="text-[11px] text-[#7a6b5c]">Live</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { navigator.clipboard.writeText(`https://digygocrm.com/p/${page.slug}`); toast.success('URL copied'); }}
                      className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditPage(page)}
                      className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deletePage(page.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#7a6b5c] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && <PageModal onClose={() => setShowModal(false)} onSave={handleCreate} />}
      {editPage && <PageModal initial={editPage} onClose={() => setEditPage(null)} onSave={handleEdit} />}
    </div>
  );
}
