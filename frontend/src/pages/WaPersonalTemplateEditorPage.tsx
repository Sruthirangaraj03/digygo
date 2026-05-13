import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Upload, X, FileText, Film, Loader2, Check } from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getAccessToken, BASE } from '@/lib/api';
import { cn } from '@/lib/utils';

interface WaPersonalTemplate {
  id: string;
  name: string;
  message: string;
  file_path?: string | null;
  file_type?: string | null;
  file_name?: string | null;
  created_at: string;
}

// Static standard variables always available
const STANDARD_VARS = [
  { key: 'first_name',     label: 'First Name' },
  { key: 'last_name',      label: 'Last Name' },
  { key: 'full_name',      label: 'Full Name' },
  { key: 'phone',          label: 'Phone' },
  { key: 'email',          label: 'Email' },
  { key: 'stage',          label: 'Stage' },
  { key: 'pipeline',       label: 'Pipeline' },
  { key: 'assigned_staff', label: 'Assigned Staff' },
  { key: 'source',         label: 'Source' },
  { key: 'today',          label: 'Today\'s Date' },
];

const CALENDAR_VARS = [
  { key: 'appointment_date',       label: 'Appointment Date' },
  { key: 'appointment_start_time', label: 'Start Time' },
  { key: 'appointment_end_time',   label: 'End Time' },
  { key: 'appointment_timezone',   label: 'Timezone' },
  { key: 'calendar_name',          label: 'Calendar Name' },
  { key: 'meeting_link',           label: 'Meeting Link' },
];

const BASE_SAMPLE: Record<string, string> = {
  first_name:             'Ravi',
  last_name:              'Kumar',
  full_name:              'Ravi Kumar',
  phone:                  '+91 98765 43210',
  email:                  'ravi@example.com',
  stage:                  'Qualified',
  pipeline:               'Sales',
  assigned_staff:         'Roshan',
  source:                 'Meta Form',
  today:                  new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  appointment_date:       '13 May 2026',
  appointment_start_time: '10:30 AM',
  appointment_end_time:   '11:00 AM',
  appointment_timezone:   'Asia/Kolkata',
  calendar_name:          'Discovery Call',
  meeting_link:           'https://meet.google.com/abc-xyz',
};

function renderHtml(text: string, sample: Record<string, string>): string {
  if (!text) return '';
  let t = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Substitute {%key%} value tokens (Values tab)
  t = t.replace(/\{%(\w+)%\}/g, (match, key) =>
    key in sample
      ? `<span style="color:#c2410c;font-weight:500">${sample[key]}</span>`
      : `<span style="color:#f97316">${match}</span>`
  );
  // Substitute {key} lead variables
  t = t.replace(/\{(\w+)\}/g, (match, key) =>
    key in sample
      ? `<span style="color:#c2410c;font-weight:500">${sample[key]}</span>`
      : `<span style="color:#f97316">${match}</span>`
  );
  t = t.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
  t = t.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  t = t.replace(/~([^~\n]+)~/g, '<del>$1</del>');
  t = t.replace(/\n/g, '<br>');
  return t;
}

export default function WaPersonalTemplateEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<{ path: string; name: string; type: string } | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<Array<{ slug: string; name: string }>>([]);
  const [valueTokens, setValueTokens] = useState<Array<{ name: string; replace_with: string }>>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch custom fields and value tokens for variable chips
  useEffect(() => {
    const tok = getAccessToken();
    const headers: Record<string, string> = tok ? { Authorization: `Bearer ${tok}` } : {};
    Promise.all([
      fetch(`${BASE}/api/fields/custom`, { headers, credentials: 'include' }).then((r) => r.json()).catch(() => []),
      fetch(`${BASE}/api/fields/values`, { headers, credentials: 'include' }).then((r) => r.json()).catch(() => []),
    ]).then(([cf, vt]) => {
      if (Array.isArray(cf)) setCustomFields(cf.map((f: any) => ({ slug: f.slug, name: f.name })));
      if (Array.isArray(vt)) setValueTokens(vt.map((v: any) => ({ name: v.name, replace_with: v.replace_with })));
    });
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    const t = state?.template as WaPersonalTemplate | undefined;
    if (t) {
      setName(t.name);
      setMessage(t.message);
      if (t.file_path && t.file_name && t.file_type) {
        setExistingFile({ path: t.file_path, name: t.file_name, type: t.file_type });
      }
      setLoading(false);
      return;
    }
    const tok = getAccessToken();
    fetch(`${BASE}/api/wa-personal-templates`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((list: WaPersonalTemplate[]) => {
        const found = Array.isArray(list) ? list.find((x) => x.id === id) : null;
        if (found) {
          setName(found.name);
          setMessage(found.message);
          if (found.file_path && found.file_name && found.file_type) {
            setExistingFile({ path: found.file_path, name: found.file_name, type: found.file_type });
          }
        } else {
          toast.error('Template not found');
          navigate('/automation/templates?tab=wa_personal');
        }
      })
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const wrapSelection = (wrap: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = message.slice(start, end);
    const newMsg = message.slice(0, start) + wrap + selected + wrap + message.slice(end);
    setMessage(newMsg);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + wrap.length, end + wrap.length);
    }, 0);
  };

  const insertVariable = (key: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const val = `{${key}}`;
    const newMsg = message.slice(0, pos) + val + message.slice(pos);
    setMessage(newMsg);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(pos + val.length, pos + val.length);
    }, 0);
  };

  const handleFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    const allowedExt = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp4'];
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('application/') && !allowedExt.includes(ext)) {
      toast.error('Unsupported file type');
      return;
    }
    setFile(f);
    setRemoveFile(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Template name is required'); return; }
    if (!message.trim()) { toast.error('Message is required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('message', message.trim());
      if (removeFile) fd.append('removeFile', 'true');
      if (file) fd.append('file', file);
      const tok = getAccessToken();
      const url = isEdit ? `/api/wa-personal-templates/${id}` : '/api/wa-personal-templates';
      const method = isEdit ? 'PATCH' : 'POST';
      const resp = await fetch(`${BASE}${url}`, {
        method,
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        credentials: 'include',
        body: fd,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Save failed');
      toast.success(isEdit ? 'Template updated' : 'Template created');
      navigate('/automation/templates?tab=wa_personal');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Build the live sample map: base + custom field placeholders + value tokens
  const sample = {
    ...BASE_SAMPLE,
    ...Object.fromEntries(customFields.map((f) => [f.slug, `[${f.name}]`])),
    ...Object.fromEntries(valueTokens.map((v) => [v.name, v.replace_with])),
  };

  const attachType: 'image' | 'video' | 'doc' | null = (() => {
    const t = file?.type ?? existingFile?.type ?? '';
    const n = file?.name ?? existingFile?.name ?? '';
    if (t.startsWith('image/')) return 'image';
    if (t.startsWith('video/') || n.toLowerCase().endsWith('.mp4')) return 'video';
    if (t || n) return 'doc';
    return null;
  })();

  const attachName = file?.name ?? existingFile?.name ?? '';
  const attachImgSrc = previewUrl ?? (existingFile?.type?.startsWith('image/') ? `${BASE}${existingFile.path}` : null);
  const showAttach = attachType !== null && !(removeFile && !file);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    // Negative margins cancel AppLayout's padding so the editor fills edge-to-edge
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden -mx-3 -my-4 md:-mx-6 md:-my-5">

      {/* ── Header ── */}
      <header className="bg-white border-b border-orange-100 px-5 py-0 flex items-center justify-between shrink-0 h-14">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => navigate('/automation/templates?tab=wa_personal')}
            className="flex items-center gap-1.5 text-[13px] text-[#7a6b5c] hover:text-[#c2410c] transition-colors group shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Templates</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-[#7a6b5c]/30 shrink-0" />
          <span className="text-[13px] font-semibold text-[#1c1410] truncate">
            {isEdit ? 'Edit Template' : 'New Template'}
          </span>
          <span className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-[11px] font-medium text-green-700 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            WA Personal
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/automation/templates?tab=wa_personal')}
            className="h-8 text-[13px] border-orange-200 text-[#7a6b5c] hover:bg-orange-50 hover:border-orange-300"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-[13px] bg-[#ea580c] hover:bg-[#c2410c] text-white border-0 shadow-sm px-4"
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
              : <><Check className="w-3.5 h-3.5 mr-1.5" />{isEdit ? 'Save Changes' : 'Create Template'}</>}
          </Button>
        </div>
      </header>

      {/* ── Body: two columns ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Compose */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-8 space-y-7">

            {/* 1 · Template Details */}
            <section>
              <SectionLabel n={1} title="Template Details" />
              <div className="bg-white rounded-2xl border border-orange-100 p-5">
                <label className="text-sm font-medium text-[#1c1410] mb-1.5 block">
                  Template Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Welcome Message, Follow Up Reminder, Brochure Send"
                  className="border-orange-100 focus:border-orange-300 focus:ring-1 focus:ring-orange-200 bg-[#fffbf7]"
                />
                <p className="text-[11px] text-[#7a6b5c] mt-1.5">
                  Only visible to your team — not sent to the lead.
                </p>
              </div>
            </section>

            {/* 2 · Message */}
            <section>
              <SectionLabel n={2} title="Message" />
              <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden">

                {/* Formatting toolbar */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-orange-50 bg-[#fffbf7]">
                  <span className="text-[11px] font-medium text-[#7a6b5c] mr-1">Format:</span>
                  <FormatBtn onClick={() => wrapSelection('*')} title="Bold  *text*">
                    <span className="font-bold text-[13px]">B</span>
                  </FormatBtn>
                  <FormatBtn onClick={() => wrapSelection('_')} title="Italic  _text_">
                    <span className="italic text-[13px]">I</span>
                  </FormatBtn>
                  <FormatBtn onClick={() => wrapSelection('~')} title="Strikethrough  ~text~">
                    <span className="line-through text-[13px]">S</span>
                  </FormatBtn>
                  <div className="h-4 w-px bg-orange-200 mx-1" />
                  <span className="text-[11px] text-[#7a6b5c] hidden sm:block">Select text then click to format</span>
                  <span className="ml-auto text-[11px] text-[#7a6b5c]">{message.length} / 4096</span>
                </div>

                {/* Textarea */}
                <div className="px-4 pt-4 pb-2">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={4096}
                    rows={9}
                    placeholder={"Hi {first_name}! 👋\n\nThank you for reaching out to us.\n\nHere's what we'd love to share with you..."}
                    className="w-full text-[13px] text-[#1c1410] placeholder:text-[#7a6b5c]/40 bg-transparent outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Variable chips — organized by category */}
                <div className="px-4 pb-4 pt-1 space-y-3">
                  <p className="text-[11px] font-medium text-[#7a6b5c]">
                    Click to insert at cursor:
                  </p>

                  {/* Standard fields */}
                  <div>
                    <p className="text-[10px] font-bold text-[#92400e] uppercase tracking-widest mb-1.5">Lead Info</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STANDARD_VARS.map((v) => (
                        <button
                          key={v.key}
                          onClick={() => insertVariable(v.key)}
                          title={v.label}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-colors"
                        >
                          {`{${v.key}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calendar fields */}
                  <div>
                    <p className="text-[10px] font-bold text-[#92400e] uppercase tracking-widest mb-1.5">Appointment / Calendar</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CALENDAR_VARS.map((v) => (
                        <button
                          key={v.key}
                          onClick={() => insertVariable(v.key)}
                          title={v.label}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                        >
                          {`{${v.key}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom / Additional fields */}
                  {customFields.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[#92400e] uppercase tracking-widest mb-1.5">Additional Fields</p>
                      <div className="flex flex-wrap gap-1.5">
                        {customFields.map((f) => (
                          <button
                            key={f.slug}
                            onClick={() => insertVariable(f.slug)}
                            title={f.name}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-colors"
                          >
                            {`{${f.slug}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Values tab tokens */}
                  {valueTokens.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[#92400e] uppercase tracking-widest mb-1.5">Values (static replacements)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {valueTokens.map((v) => (
                          <button
                            key={v.name}
                            onClick={() => {
                              const el = textareaRef.current;
                              if (!el) return;
                              const pos = el.selectionStart;
                              const val = `{%${v.name}%}`;
                              const newMsg = message.slice(0, pos) + val + message.slice(pos);
                              setMessage(newMsg);
                              setTimeout(() => { el.focus(); el.setSelectionRange(pos + val.length, pos + val.length); }, 0);
                            }}
                            title={`Replaces with: ${v.replace_with}`}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-colors"
                          >
                            {`{%${v.name}%}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 3 · Attachment */}
            <section>
              <SectionLabel n={3} title="Attachment" subtitle="optional" />
              <div className="bg-white rounded-2xl border border-orange-100 p-5 space-y-4">

                {/* Existing file (edit mode) */}
                {existingFile && !removeFile && !file && (
                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <FileTypeIcon type={existingFile.type} name={existingFile.name} className="w-5 h-5 text-orange-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1c1410] truncate">{existingFile.name}</p>
                      <p className="text-[11px] text-[#7a6b5c]">Current attachment</p>
                    </div>
                    <button
                      onClick={() => setRemoveFile(true)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#7a6b5c] hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Newly selected file */}
                {file && (
                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
                    <FileTypeIcon type={file.type} name={file.name} className="w-5 h-5 text-orange-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1c1410] truncate">{file.name}</p>
                      <p className="text-[11px] text-[#7a6b5c]">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#7a6b5c] hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all select-none',
                    dragOver
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-orange-200 bg-[#fffbf7] hover:border-orange-300 hover:bg-orange-50/60',
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-5 h-5 text-orange-500" />
                  </div>
                  <p className="text-sm font-medium text-[#1c1410]">
                    Drop file here or <span className="text-orange-600 underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-[11px] text-[#7a6b5c] mt-1">
                    Images · PDF · Word · Excel · Video · Max 16 MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/mp4,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
              </div>
            </section>

            <div className="h-8" />
          </div>
        </div>

        {/* RIGHT — Live Preview (independent scroll) */}
        <div className="w-[380px] shrink-0 border-l border-orange-100 bg-[#fff7f0] overflow-y-auto">
          <div className="p-6 space-y-5">

            <h2 className="text-[11px] font-bold text-[#92400e] uppercase tracking-widest">Live Preview</h2>

            {/* WhatsApp mockup */}
            <div className="rounded-2xl overflow-hidden shadow-md border border-black/[0.08]">

              {/* WA Header */}
              <div className="bg-[#075e54] px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#128c7e] border-2 border-white/20 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">WA</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-semibold leading-tight">DigyGo CRM</p>
                  <p className="text-green-300 text-[10px]">online</p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-white/15" />
                  <div className="w-3.5 h-3.5 rounded-full bg-white/15" />
                </div>
              </div>

              {/* Chat area */}
              <div className="min-h-[260px] p-3 flex flex-col gap-2" style={{ backgroundColor: '#efeae2' }}>
                {!message.trim() ? (
                  <div className="flex-1 flex items-center justify-center py-10">
                    <p className="text-[12px] text-[#9e9e9e] text-center leading-relaxed">
                      Start typing your message<br />to see the preview here
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-start">
                    <div className="max-w-[90%] bg-white rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">

                      {/* Attachment in preview */}
                      {showAttach && attachType === 'image' && attachImgSrc && (
                        <img src={attachImgSrc} alt="" className="w-full max-h-40 object-cover" />
                      )}
                      {showAttach && attachType === 'video' && (
                        <div className="flex items-center gap-2 bg-gray-100 px-3 py-2.5">
                          <Film className="w-5 h-5 text-gray-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-gray-700 truncate max-w-[180px]">{attachName}</p>
                            <p className="text-[10px] text-gray-500">Video</p>
                          </div>
                        </div>
                      )}
                      {showAttach && attachType === 'doc' && (
                        <div className="flex items-center gap-2.5 border-b border-orange-100 bg-orange-50 px-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-gray-800 truncate max-w-[180px]">{attachName}</p>
                            <p className="text-[10px] text-gray-500">{attachName.split('.').pop()?.toUpperCase() || 'FILE'}</p>
                          </div>
                        </div>
                      )}

                      {/* Message text */}
                      <div className="px-3 py-2">
                        <p
                          className="text-[12px] text-gray-800 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderHtml(message, sample) || '&nbsp;' }}
                        />
                        <div className="flex items-center justify-end gap-1 mt-1.5">
                          <span className="text-[10px] text-gray-400">10:30 AM</span>
                          <span className="text-[10px] text-blue-400">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fake WA input bar */}
              <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2">
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-gray-400">
                  Type a message
                </div>
                <div className="w-7 h-7 rounded-full bg-[#25d366] flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] ml-0.5">▶</span>
                </div>
              </div>
            </div>

            {/* Variable legend — all categories */}
            <div className="bg-white rounded-2xl border border-orange-100 p-4">
              <h3 className="text-[10px] font-bold text-[#92400e] uppercase tracking-widest mb-3">
                Preview Sample Values
              </h3>
              <div className="space-y-1.5">
                {STANDARD_VARS.map((v) => (
                  <div key={v.key} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="text-orange-600 font-mono shrink-0">{`{${v.key}}`}</span>
                    <span className="text-[#7a6b5c] text-right truncate">{BASE_SAMPLE[v.key]}</span>
                  </div>
                ))}
                {CALENDAR_VARS.map((v) => (
                  <div key={v.key} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="text-blue-600 font-mono shrink-0">{`{${v.key}}`}</span>
                    <span className="text-[#7a6b5c] text-right truncate">{BASE_SAMPLE[v.key]}</span>
                  </div>
                ))}
                {customFields.map((f) => (
                  <div key={f.slug} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="text-purple-600 font-mono shrink-0">{`{${f.slug}}`}</span>
                    <span className="text-[#7a6b5c] text-right truncate">[{f.name}]</span>
                  </div>
                ))}
                {valueTokens.map((v) => (
                  <div key={v.name} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="text-green-600 font-mono shrink-0">{`{%${v.name}%}`}</span>
                    <span className="text-[#7a6b5c] text-right truncate">{v.replace_with}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formatting tips */}
            <div className="bg-orange-50 rounded-2xl border border-orange-100 p-4">
              <h3 className="text-[10px] font-bold text-[#92400e] uppercase tracking-widest mb-3">
                WhatsApp Formatting
              </h3>
              <div className="space-y-2 text-[12px] text-[#7a6b5c]">
                <div className="flex items-center gap-2">
                  <code className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-[11px]">*text*</code>
                  <span>→</span>
                  <strong className="text-[#1c1410]">bold</strong>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-[11px]">_text_</code>
                  <span>→</span>
                  <em className="text-[#1c1410]">italic</em>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-[11px]">~text~</code>
                  <span>→</span>
                  <del className="text-[#1c1410]">strikethrough</del>
                </div>
                <p className="text-[11px] pt-1.5 border-t border-orange-100 text-[#7a6b5c]">
                  Emoji can be typed or pasted directly — 👋 🎉 📎 ✅
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ n, title, subtitle }: { n: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-orange-700">{n}</span>
      </div>
      <h2 className="text-[11px] font-bold text-[#92400e] uppercase tracking-widest">
        {title}
        {subtitle && <span className="text-[#7a6b5c] normal-case font-normal ml-1">· {subtitle}</span>}
      </h2>
    </div>
  );
}

function FormatBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 rounded-md hover:bg-orange-100 text-[#1c1410] transition-colors flex items-center justify-center"
    >
      {children}
    </button>
  );
}

function FileTypeIcon({ type, name, className }: { type: string; name: string; className?: string }) {
  if (type.startsWith('image/')) return <ImageIcon className={className} />;
  if (type.startsWith('video/') || name.toLowerCase().endsWith('.mp4')) return <Film className={className} />;
  return <FileText className={className} />;
}
