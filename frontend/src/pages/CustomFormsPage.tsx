import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, X, Copy, Link, Code2, Pencil, Copy as CloneIcon,
  FileText, Users, BarChart2, ArrowLeft, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CustomForm {
  id: string;
  name: string;
  pipeline: string;
  stage: string;
  leads: number;
  embedCode: string;
  shareLink: string;
}

const defaultForms: CustomForm[] = [
  {
    id: 'form-1', name: 'Contact Us',
    pipeline: 'Sales Pipeline', stage: 'New Lead', leads: 412,
    embedCode: '<script src="https://digygocrm.com/embed/contact-us.js"></script>',
    shareLink: 'https://digygocrm.com/f/contact-us',
  },
  {
    id: 'form-2', name: 'Demo Request',
    pipeline: 'Marketing Pipeline', stage: 'Interest', leads: 289,
    embedCode: '<script src="https://digygocrm.com/embed/demo-request.js"></script>',
    shareLink: 'https://digygocrm.com/f/demo-request',
  },
  {
    id: 'form-3', name: 'Newsletter Signup',
    pipeline: 'NA', stage: 'NA', leads: 539,
    embedCode: '<script src="https://digygocrm.com/embed/newsletter.js"></script>',
    shareLink: 'https://digygocrm.com/f/newsletter',
  },
];

export default function CustomFormsPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState(defaultForms);
  const [embedFormId, setEmbedFormId] = useState<string | null>(null);
  const [shareLinkFormId, setShareLinkFormId] = useState<string | null>(null);

  const embedForm = forms.find((f) => f.id === embedFormId);
  const shareLinkForm = forms.find((f) => f.id === shareLinkFormId);
  const totalLeads = forms.reduce((s, f) => s + f.leads, 0);

  const handleDelete = (id: string) => {
    const form = forms.find((f) => f.id === id);
    setForms(forms.filter((f) => f.id !== id));
    toast.success(`"${form?.name}" deleted`);
  };

  const handleClone = (form: CustomForm) => {
    const newForm: CustomForm = {
      ...form,
      id: `form-${Date.now()}`,
      name: `${form.name} (Copy)`,
      leads: 0,
    };
    setForms([...forms, newForm]);
    toast.success(`"${form.name}" cloned`);
  };

  const statCards = [
    { label: 'Total Forms', value: forms.length, icon: FileText, color: 'text-primary' },
    { label: 'Total Leads', value: totalLeads.toLocaleString(), icon: Users, color: 'text-emerald-500' },
    { label: 'Avg. Leads / Form', value: forms.length ? Math.round(totalLeads / forms.length).toLocaleString() : '0', icon: BarChart2, color: 'text-primary' },
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
        <Button onClick={() => navigate('/lead-generation/custom-forms/new')} className="shrink-0">
          <Plus className="w-4 h-4" /> Create Form
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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

      {/* Forms Table */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
          <div>
            <h3 className="font-headline font-bold text-[#1c1410]">All Forms</h3>
            <p className="text-[12px] text-[#7a6b5c] mt-0.5">{forms.length} forms · {totalLeads.toLocaleString()} total leads</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/lead-generation/custom-forms/new')}>
            <Plus className="w-3.5 h-3.5" /> New Form
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-black/5 bg-[#faf8f6]">
                <th className="w-8 pl-4 pr-2 py-3" />
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-2 py-3 w-7">#</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Form Name</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Pipeline</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Stage</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Leads</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Options</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form, idx) => (
                <tr
                  key={form.id}
                  onClick={() => navigate(`/lead-generation/custom-forms/${form.id}`)}
                  className="border-b border-black/5 last:border-0 hover:bg-[#faf8f6] transition-colors cursor-pointer group"
                >
                  {/* Drag handle */}
                  <td className="pl-4 pr-2 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <GripVertical className="w-4 h-4 text-[#d4c4b4] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                  </td>

                  {/* # */}
                  <td className="px-2 py-3.5 text-[12px] font-medium text-[#b09e8d]">{idx + 1}</td>

                  {/* Form Name */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="text-[13px] font-semibold text-[#1c1410] group-hover:text-primary transition-colors">
                      {form.name}
                    </span>
                  </td>

                  {/* Pipeline */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {form.pipeline === 'NA' ? (
                      <span className="text-[12px] text-[#c4b09e] italic">—</span>
                    ) : (
                      <span className="text-[13px] text-[#5c5245] font-medium">{form.pipeline}</span>
                    )}
                  </td>

                  {/* Stage */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {form.stage === 'NA' ? (
                      <span className="text-[12px] text-[#c4b09e] italic">—</span>
                    ) : (
                      <span className="text-[13px] font-medium text-[#5c5245]">{form.stage}</span>
                    )}
                  </td>

                  {/* Leads */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#b09e8d]" />
                      <span className="text-[14px] font-bold text-[#1c1410]">{form.leads.toLocaleString()}</span>
                    </div>
                  </td>

                  {/* Options — all on one row, icon+text for key actions, icon-only for Edit/Delete */}
                  <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShareLinkFormId(form.id)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors"
                        title="Share link">
                        <Link className="w-3 h-3" /> Copy Link
                      </button>
                      <button onClick={() => setEmbedFormId(form.id)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 transition-colors"
                        title="Embed code">
                        <Code2 className="w-3 h-3" /> Embed
                      </button>
                      <button onClick={() => navigate(`/lead-generation/custom-forms/${form.id}`)}
                        className="p-1.5 rounded-lg text-[#7a6b5c] border border-black/8 hover:bg-[#f5ede3] hover:text-primary transition-colors"
                        title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleClone(form)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors"
                        style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}
                        title="Clone">
                        <CloneIcon className="w-3 h-3" /> Clone
                      </button>
                      <button onClick={() => handleDelete(form.id)}
                        className="p-1.5 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors"
                        title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-[13px] text-[#7a6b5c]">
                    No forms yet. Create your first form.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Share Link Modal */}
      {shareLinkForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl border border-black/5 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <div>
                <h3 className="font-headline font-bold text-[#1c1410]">Share "{shareLinkForm.name}"</h3>
                <p className="text-[11px] text-[#7a6b5c] mt-0.5">Public link to this form</p>
              </div>
              <button onClick={() => setShareLinkFormId(null)}
                className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <Link className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-[12px] text-amber-700 font-medium flex-1 break-all">{shareLinkForm.shareLink}</p>
              </div>
              <p className="text-[12px] text-[#7a6b5c]">
                This is the public URL where visitors can fill out your form. Share it via email, WhatsApp, or social media.
              </p>
              <p className="text-[11px] text-[#b09e8d] bg-[#faf8f6] rounded-xl px-3 py-2.5 border border-black/5">
                Note: This link is active only after your form is published and your domain is configured.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-black/5">
              <Button variant="outline" onClick={() => setShareLinkFormId(null)}>Close</Button>
              <Button onClick={() => { navigator.clipboard.writeText(shareLinkForm.shareLink); toast.success('Link copied to clipboard'); }}>
                <Copy className="w-4 h-4" /> Copy Link
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Embed Code Modal */}
      {embedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl border border-black/5 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <div>
                <h3 className="font-headline font-bold text-[#1c1410]">Embed "{embedForm.name}"</h3>
                <p className="text-[11px] text-[#7a6b5c] mt-0.5">Copy and paste this code into your website</p>
              </div>
              <button
                onClick={() => setEmbedFormId(null)}
                className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[13px] text-[#7a6b5c]">
                Paste this snippet just before the closing{' '}
                <code className="font-mono text-xs bg-[#faf8f6] px-1.5 py-0.5 rounded-md text-[#1c1410]">&lt;/body&gt;</code>{' '}
                tag on your page.
              </p>
              <div className="relative">
                <pre className="bg-[#faf8f6] rounded-xl p-4 text-xs font-mono text-[#1c1410] overflow-x-auto border border-black/5">
                  {embedForm.embedCode}
                </pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(embedForm.embedCode); toast.success('Embed code copied'); }}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white border border-black/5 hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-black/5">
              <Button onClick={() => setEmbedFormId(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
