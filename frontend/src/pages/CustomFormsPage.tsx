import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, X, Copy, Link, Code2, Pencil,
  FileText, Users,
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
    const newForm: CustomForm = { ...form, id: `form-${Date.now()}`, name: `${form.name} (Copy)`, leads: 0 };
    setForms([...forms, newForm]);
    toast.success(`"${form.name}" cloned`);
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-headline font-bold text-[#1c1410] text-[16px]">Custom Forms</h2>
          <p className="text-[12px] text-[#7a6b5c] mt-0.5">
            {forms.length} forms · {totalLeads.toLocaleString()} leads captured
          </p>
        </div>
        <Button onClick={() => navigate('/lead-generation/custom-forms/new')}>
          <Plus className="w-4 h-4" /> Create Form
        </Button>
      </div>

      {/* Empty state */}
      {forms.length === 0 && (
        <div className="bg-white rounded-2xl border border-black/5 card-shadow px-8 py-16 text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-headline font-bold text-[#1c1410] text-[15px] mb-1">No forms yet</h3>
          <p className="text-[13px] text-[#7a6b5c] mb-5 max-w-xs mx-auto">
            Create your first form and start capturing leads from your website or landing pages.
          </p>
          <Button onClick={() => navigate('/lead-generation/custom-forms/new')}>
            <Plus className="w-4 h-4" /> Create your first form
          </Button>
        </div>
      )}

      {/* Form cards grid */}
      {forms.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <div
              key={form.id}
              className="group bg-white rounded-2xl border border-black/5 card-shadow flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              {/* Card body — clickable to edit */}
              <div
                className="flex-1 p-5 cursor-pointer"
                onClick={() => navigate(`/lead-generation/custom-forms/${form.id}`)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-[#1c1410] text-[14px] truncate group-hover:text-primary transition-colors">
                        {form.name}
                      </h4>
                      <p className="text-[11px] text-[#7a6b5c] mt-0.5 truncate">
                        {form.pipeline !== 'NA' ? `${form.pipeline} → ${form.stage}` : 'No pipeline'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#faf8f6] border border-black/5 rounded-lg px-2 py-1 shrink-0">
                    <Users className="w-3 h-3 text-[#7a6b5c]" />
                    <span className="text-[12px] font-bold text-[#1c1410]">{form.leads.toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#7a6b5c] leading-relaxed line-clamp-2">
                  {form.shareLink}
                </p>
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-1 px-4 py-3 border-t border-black/5">
                <button
                  onClick={(e) => { e.stopPropagation(); setShareLinkFormId(form.id); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <Link className="w-3 h-3" /> Copy Link
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEmbedFormId(form.id); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 transition-colors"
                >
                  <Code2 className="w-3 h-3" /> Embed
                </button>
                <div className="flex-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleClone(form); }}
                  className="p-1.5 rounded-lg text-[#7a6b5c] border border-black/8 hover:bg-[#f5ede3] hover:text-primary transition-colors"
                  title="Clone"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/lead-generation/custom-forms/${form.id}`); }}
                  className="p-1.5 rounded-lg text-[#7a6b5c] border border-black/8 hover:bg-[#f5ede3] hover:text-primary transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(form.id); }}
                  className="p-1.5 rounded-lg text-[#7a6b5c] border border-black/8 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* "New form" card */}
          <button
            onClick={() => navigate('/lead-generation/custom-forms/new')}
            className="group bg-white rounded-2xl border-2 border-dashed border-black/10 p-5 flex flex-col items-center justify-center gap-2 text-center hover:border-primary hover:bg-primary/5 transition-all duration-200 min-h-[140px]"
          >
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[13px] font-semibold text-[#7a6b5c] group-hover:text-primary transition-colors">
              New Form
            </span>
          </button>
        </div>
      )}

      {/* Share Link Modal */}
      {shareLinkForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl border border-black/5 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <div>
                <h3 className="font-headline font-bold text-[#1c1410]">Share "{shareLinkForm.name}"</h3>
                <p className="text-[11px] text-[#7a6b5c] mt-0.5">Public link to this form</p>
              </div>
              <button onClick={() => setShareLinkFormId(null)} className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <Link className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-[12px] text-amber-700 font-medium flex-1 break-all">{shareLinkForm.shareLink}</p>
              </div>
              <p className="text-[12px] text-[#7a6b5c]">
                Share this link via email, WhatsApp, or social media. Anyone with the link can fill out the form.
              </p>
              <p className="text-[11px] text-[#b09e8d] bg-[#faf8f6] rounded-xl px-3 py-2.5 border border-black/5">
                Active only after your form is published and domain is configured.
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
                <p className="text-[11px] text-[#7a6b5c] mt-0.5">Copy and paste into your website</p>
              </div>
              <button onClick={() => setEmbedFormId(null)} className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors">
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
