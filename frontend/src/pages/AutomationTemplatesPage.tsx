import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Copy, X, Check, Eye, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TemplateTab = 'waba' | 'email' | 'sms';
type WABACategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
type ButtonType = 'QUICK_REPLY' | 'CALL_TO_ACTION';

interface WABAButton { id: string; type: ButtonType; label: string; value: string; }
interface WABATemplate {
  id: string; name: string; category: WABACategory; language: string;
  header?: string; body: string; footer?: string;
  buttons: WABAButton[]; status: 'approved' | 'pending' | 'rejected'; usageCount: number;
}
interface EmailTemplate {
  id: string; name: string; subject: string; body: string; usageCount: number;
}
interface SMSTemplate {
  id: string; name: string; body: string; usageCount: number;
}

const defaultWABA: WABATemplate[] = [
  {
    id: 'wt1', name: 'welcome_lead', category: 'UTILITY', language: 'en',
    header: 'Welcome to NexCRM!',
    body: 'Hi {%first_name%}! 👋 Thanks for reaching out. We\'ve received your inquiry and our team will get back to you shortly.\n\nMeanwhile, feel free to explore our website.',
    footer: 'NexCRM Team',
    buttons: [
      { id: 'b1', type: 'QUICK_REPLY', label: 'Talk to an Agent', value: 'talk_agent' },
      { id: 'b2', type: 'CALL_TO_ACTION', label: 'Visit Website', value: 'https://digygocrm.com' },
    ],
    status: 'approved', usageCount: 142,
  },
  {
    id: 'wt2', name: 'demo_reminder', category: 'UTILITY', language: 'en',
    header: 'Your Demo is Tomorrow!',
    body: 'Hi {%first_name%}, just a reminder that your demo with {%assigned_to%} is scheduled for tomorrow.\n\n📅 Date: {%appointment_date%}\n⏰ Time: {%appointment_time%}\n🔗 Link: {%meeting_link%}',
    footer: 'Reply CANCEL to reschedule',
    buttons: [
      { id: 'b1', type: 'QUICK_REPLY', label: 'Confirm', value: 'confirm_demo' },
      { id: 'b2', type: 'QUICK_REPLY', label: 'Reschedule', value: 'reschedule_demo' },
    ],
    status: 'approved', usageCount: 89,
  },
  {
    id: 'wt3', name: 'proposal_followup', category: 'MARKETING', language: 'en',
    body: 'Hi {%first_name%}! 👋 We sent you a proposal for {%deal_value%}. Have you had a chance to review it?\n\nWe\'d love to hear your thoughts!',
    buttons: [
      { id: 'b1', type: 'QUICK_REPLY', label: 'Yes, let\'s talk!', value: 'interested' },
      { id: 'b2', type: 'QUICK_REPLY', label: 'Need more time', value: 'more_time' },
      { id: 'b3', type: 'QUICK_REPLY', label: 'Not interested', value: 'not_interested' },
    ],
    status: 'pending', usageCount: 0,
  },
];

const defaultEmail: EmailTemplate[] = [
  { id: 'et1', name: 'Welcome Email', subject: 'Welcome to NexCRM, {%first_name%}!', body: `Hi {%first_name%},\n\nThank you for reaching out to us! We're excited to connect with you.\n\nOur team will reach out within 24 hours to discuss how we can help {%company_name%}.\n\nBest regards,\n{%assigned_to%}\nNexCRM Team`, usageCount: 67 },
  { id: 'et2', name: 'Proposal Sent', subject: 'Your Custom Proposal – {%deal_value%}', body: `Hi {%first_name%},\n\nAs discussed, please find your custom proposal attached.\n\nProposal Highlights:\n• Value: {%deal_value%}\n• Valid until: 30 days from today\n\nFeel free to reply with any questions.\n\nBest,\n{%assigned_to%}`, usageCount: 43 },
];

const defaultSMS: SMSTemplate[] = [
  { id: 'st1', name: 'New Lead Welcome', body: 'Hi {%first_name%}! Thanks for your interest. Our team will call you shortly. - NexCRM', usageCount: 201 },
  { id: 'st2', name: 'Follow-up Reminder', body: 'Hi {%first_name%}, just checking in on your inquiry. Reply YES to schedule a call. - NexCRM', usageCount: 88 },
];

const LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'mr'];
const WABA_CATEGORIES: WABACategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const catColor: Record<WABACategory, string> = {
  MARKETING: 'bg-purple-100 text-purple-700',
  UTILITY: 'bg-blue-100 text-blue-700',
  AUTHENTICATION: 'bg-orange-100 text-orange-700',
};
const statusColor = { approved: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', rejected: 'bg-red-100 text-red-700' };

// ── WABA Modal ─────────────────────────────────────────────────────────────────
function WABAModal({ initial, onClose, onSave }: { initial?: WABATemplate | null; onClose: () => void; onSave: (t: Omit<WABATemplate, 'id' | 'status' | 'usageCount'>) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<WABACategory>(initial?.category ?? 'UTILITY');
  const [language, setLanguage] = useState(initial?.language ?? 'en');
  const [header, setHeader] = useState(initial?.header ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [footer, setFooter] = useState(initial?.footer ?? '');
  const [buttons, setButtons] = useState<WABAButton[]>(initial?.buttons ?? []);

  const addButton = () => {
    if (buttons.length >= 3) { toast.error('Max 3 buttons allowed'); return; }
    setButtons([...buttons, { id: `b-${Date.now()}`, type: 'QUICK_REPLY', label: '', value: '' }]);
  };
  const updateBtn = (id: string, k: keyof WABAButton, v: string) => setButtons(buttons.map((b) => b.id === id ? { ...b, [k]: v } : b));
  const removeBtn = (id: string) => setButtons(buttons.filter((b) => b.id !== id));

  const handleSave = () => {
    if (!name.trim()) { toast.error('Template name required'); return; }
    if (!body.trim()) { toast.error('Body text required'); return; }
    onSave({ name: name.trim().toLowerCase().replace(/\s+/g, '_'), category, language, header: header || undefined, body, footer: footer || undefined, buttons });
  };

  const charCount = body.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 shrink-0">
          <h3 className="font-headline font-bold text-[#1c1410]">{initial ? 'Edit WABA Template' : 'Create WABA Template'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5ede3]"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Template Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. welcome_lead" className="font-mono text-sm" />
              <p className="text-[11px] text-[#7a6b5c] mt-1">Lowercase, underscores only</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Category</label>
              <select className="w-full border border-black/5 rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none" value={category} onChange={(e) => setCategory(e.target.value as WABACategory)}>
                {WABA_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Language</label>
              <select className="w-full border border-black/5 rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Header <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Bold header text displayed above body" />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Body Text * <span className="text-muted-foreground font-normal text-xs ml-1">{charCount}/1024</span></label>
            <textarea
              className="w-full border border-black/5 rounded-lg px-3 py-2 text-sm bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none resize-none"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1024}
              placeholder="Message body. Use {%first_name%}, {%assigned_to%}, etc."
            />
            <p className="text-[11px] text-[#7a6b5c] mt-1">Available variables: {'{%first_name%}'} {'{%last_name%}'} {'{%assigned_to%}'} {'{%deal_value%}'} {'{%stage%}'}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Footer <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="e.g. Reply STOP to unsubscribe" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Buttons <span className="text-muted-foreground font-normal text-xs">(max 3)</span></label>
              <button onClick={addButton} className="text-xs text-primary flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> Add Button</button>
            </div>
            <div className="space-y-2">
              {buttons.map((btn) => (
                <div key={btn.id} className="flex gap-2 items-center p-2.5 rounded-xl border border-black/5 bg-[#faf8f6]">
                  <select
                    className="border border-black/5 rounded-lg px-2 py-1.5 text-xs bg-card outline-none shrink-0"
                    value={btn.type}
                    onChange={(e) => updateBtn(btn.id, 'type', e.target.value)}
                  >
                    <option value="QUICK_REPLY">Quick Reply</option>
                    <option value="CALL_TO_ACTION">CTA</option>
                  </select>
                  <Input value={btn.label} onChange={(e) => updateBtn(btn.id, 'label', e.target.value)} placeholder="Button label" className="flex-1 text-xs" />
                  <Input
                    value={btn.value}
                    onChange={(e) => updateBtn(btn.id, 'value', e.target.value)}
                    placeholder={btn.type === 'CALL_TO_ACTION' ? 'https://...' : 'payload_value'}
                    className="flex-1 text-xs font-mono"
                  />
                  <button onClick={() => removeBtn(btn.id)} className="p-1 text-muted-foreground hover:text-destructive rounded"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {buttons.length === 0 && <p className="text-[11px] text-[#7a6b5c] py-2 text-center border border-dashed border-border rounded-lg">No buttons added. Quick Reply buttons let users respond with one tap.</p>}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/5 shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}><Check className="w-4 h-4 mr-1" /> {initial ? 'Save Changes' : 'Submit for Approval'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Email / SMS Modal ──────────────────────────────────────────────────────────
function SimpleTemplateModal({ type, initial, onClose, onSave }: {
  type: 'email' | 'sms';
  initial?: EmailTemplate | SMSTemplate | null;
  onClose: () => void;
  onSave: (t: { name: string; subject?: string; body: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [subject, setSubject] = useState((initial as EmailTemplate)?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const maxChars = type === 'sms' ? 160 : undefined;

  const handleSave = () => {
    if (!name.trim()) { toast.error('Template name required'); return; }
    if (type === 'email' && !subject.trim()) { toast.error('Subject required'); return; }
    if (!body.trim()) { toast.error('Body required'); return; }
    onSave({ name, subject: type === 'email' ? subject : undefined, body });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="font-headline font-bold text-[#1c1410]">{initial ? 'Edit' : 'Create'} {type === 'email' ? 'Email' : 'SMS'} Template</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5ede3]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Template Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome Email" />
          </div>
          {type === 'email' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Subject Line *</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Welcome, {%first_name%}!" />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-foreground">Body *</label>
              {maxChars && <span className={cn('text-xs', body.length > maxChars ? 'text-destructive' : 'text-muted-foreground')}>{body.length}/{maxChars}</span>}
            </div>
            <textarea
              className="w-full border border-black/5 rounded-lg px-3 py-2 text-sm bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none resize-none"
              rows={type === 'email' ? 8 : 4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={maxChars}
              placeholder={type === 'sms' ? 'Short message (160 chars). Use {%first_name%} for personalization.' : 'Email body. Supports {%first_name%}, {%assigned_to%}, {%deal_value%}, etc.'}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}><Check className="w-4 h-4 mr-1" /> {initial ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Preview Modal ──────────────────────────────────────────────────────────────
function WABAPreview({ template, onClose }: { template: WABATemplate; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="font-headline font-bold text-[#1c1410]">Preview</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5ede3]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          <div className="bg-[#e5ddd5] rounded-2xl p-4 min-h-40">
            <div className="bg-white rounded-2xl rounded-tl-sm p-3 max-w-[85%] shadow-sm">
              {template.header && <p className="font-semibold text-sm text-gray-900 mb-1">{template.header}</p>}
              <p className="text-sm text-gray-800 whitespace-pre-line">{template.body.replace(/{%(\w+)%}/g, (_, k) => `[${k}]`)}</p>
              {template.footer && <p className="text-xs text-gray-500 mt-1.5">{template.footer}</p>}
              <p className="text-[10px] text-gray-400 mt-1 text-right">10:30 AM</p>
            </div>
            {template.buttons.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {template.buttons.map((btn) => (
                  <div key={btn.id} className="bg-white rounded-xl py-2 text-center text-sm font-medium text-blue-600 shadow-sm">{btn.label}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AutomationTemplatesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TemplateTab>('waba');
  const [wabaTemplates, setWabaTemplates] = useState(defaultWABA);
  const [emailTemplates, setEmailTemplates] = useState(defaultEmail);
  const [smsTemplates, setSmsTemplates] = useState(defaultSMS);
  const [showWABAModal, setShowWABAModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [editWABA, setEditWABA] = useState<WABATemplate | null>(null);
  const [editEmail, setEditEmail] = useState<EmailTemplate | null>(null);
  const [editSMS, setEditSMS] = useState<SMSTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WABATemplate | null>(null);

  const tabs = [
    { key: 'waba' as TemplateTab, label: 'WhatsApp (WABA)', count: wabaTemplates.length },
    { key: 'email' as TemplateTab, label: 'Email', count: emailTemplates.length },
    { key: 'sms' as TemplateTab, label: 'SMS', count: smsTemplates.length },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/automation')}
            className="p-2 rounded-xl hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-[#1c1410] transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <Button onClick={() => { if (tab === 'waba') setShowWABAModal(true); else if (tab === 'email') setShowEmailModal(true); else setShowSMSModal(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New Template
        </Button>
      </div>

      <div className="flex gap-1 border-b border-black/5">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5', tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
            <span className={cn('text-xs rounded-full px-1.5 py-0.5', tab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* WABA Templates */}
      {tab === 'waba' && (
        <div className="space-y-3">
          {wabaTemplates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-black/5 card-shadow p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-sm font-headline font-bold text-[#1c1410]">{t.name}</p>
                    <Badge className={cn('border-0 text-xs', catColor[t.category])}>{t.category}</Badge>
                    <Badge className={cn('border-0 text-xs capitalize', statusColor[t.status])}>{t.status}</Badge>
                    <span className="text-[11px] text-[#7a6b5c] uppercase">{t.language}</span>
                  </div>
                  {t.header && <p className="text-sm font-headline font-bold text-[#1c1410] mt-2">{t.header}</p>}
                  <p className="text-[13px] text-[#7a6b5c] mt-1 line-clamp-2 whitespace-pre-line">{t.body}</p>
                  {t.buttons.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {t.buttons.map((btn) => (
                        <span key={btn.id} className={cn('text-xs px-2.5 py-1 rounded-lg border font-medium', btn.type === 'QUICK_REPLY' ? 'border-primary/30 text-primary bg-primary/5' : 'border-blue-200 text-blue-600 bg-blue-50')}>
                          {btn.type === 'CALL_TO_ACTION' ? '🔗 ' : ''}{btn.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setPreviewTemplate(t)} className="p-1.5 rounded-md hover:bg-[#f5ede3] text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => { navigator.clipboard.writeText(t.name); toast.success('Template name copied'); }} className="p-1.5 rounded-md hover:bg-[#f5ede3] text-muted-foreground hover:text-foreground transition-colors"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => setEditWABA(t)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { setWabaTemplates(wabaTemplates.filter((x) => x.id !== t.id)); toast.success('Template deleted'); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-black/5">
                <span className="text-[11px] text-[#7a6b5c]">Used {t.usageCount} times in workflows</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Email Templates */}
      {tab === 'email' && (
        <div className="space-y-3">
          {emailTemplates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-black/5 card-shadow p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{t.name}</p>
                  <p className="text-[11px] text-[#7a6b5c] mt-0.5 font-medium">Subject: {t.subject}</p>
                  <p className="text-[13px] text-[#7a6b5c] mt-1.5 line-clamp-2 whitespace-pre-line">{t.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditEmail(t)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { setEmailTemplates(emailTemplates.filter((x) => x.id !== t.id)); toast.success('Template deleted'); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-black/5">
                <span className="text-[11px] text-[#7a6b5c]">Used {t.usageCount} times in workflows</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SMS Templates */}
      {tab === 'sms' && (
        <div className="space-y-3">
          {smsTemplates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-black/5 card-shadow p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{t.name}</p>
                  <p className="text-[13px] text-[#7a6b5c] mt-1">{t.body}</p>
                  <p className="text-[11px] text-[#7a6b5c] mt-1">{t.body.length} / 160 chars{t.body.length > 160 ? ' · 2 SMS' : ' · 1 SMS'}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditSMS(t)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { setSmsTemplates(smsTemplates.filter((x) => x.id !== t.id)); toast.success('Template deleted'); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-black/5">
                <span className="text-[11px] text-[#7a6b5c]">Used {t.usageCount} times in workflows</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {(showWABAModal || editWABA) && (
        <WABAModal
          initial={editWABA}
          onClose={() => { setShowWABAModal(false); setEditWABA(null); }}
          onSave={(data) => {
            if (editWABA) {
              setWabaTemplates(wabaTemplates.map((t) => t.id === editWABA.id ? { ...t, ...data } : t));
              setEditWABA(null);
              toast.success('Template updated — resubmitted for approval');
            } else {
              setWabaTemplates([...wabaTemplates, { ...data, id: `wt-${Date.now()}`, status: 'pending', usageCount: 0 }]);
              setShowWABAModal(false);
              toast.success('Template submitted for Meta approval');
            }
          }}
        />
      )}
      {(showEmailModal || editEmail) && (
        <SimpleTemplateModal
          type="email"
          initial={editEmail}
          onClose={() => { setShowEmailModal(false); setEditEmail(null); }}
          onSave={(data) => {
            if (editEmail) {
              setEmailTemplates(emailTemplates.map((t) => t.id === editEmail.id ? { ...t, ...data } : t));
              setEditEmail(null);
            } else {
              setEmailTemplates([...emailTemplates, { ...data, id: `et-${Date.now()}`, usageCount: 0 } as EmailTemplate]);
              setShowEmailModal(false);
            }
            toast.success('Template saved');
          }}
        />
      )}
      {(showSMSModal || editSMS) && (
        <SimpleTemplateModal
          type="sms"
          initial={editSMS}
          onClose={() => { setShowSMSModal(false); setEditSMS(null); }}
          onSave={(data) => {
            if (editSMS) {
              setSmsTemplates(smsTemplates.map((t) => t.id === editSMS.id ? { ...t, ...data } : t));
              setEditSMS(null);
            } else {
              setSmsTemplates([...smsTemplates, { ...data, id: `st-${Date.now()}`, usageCount: 0 } as SMSTemplate]);
              setShowSMSModal(false);
            }
            toast.success('Template saved');
          }}
        />
      )}
      {previewTemplate && <WABAPreview template={previewTemplate} onClose={() => setPreviewTemplate(null)} />}
    </div>
  );
}
