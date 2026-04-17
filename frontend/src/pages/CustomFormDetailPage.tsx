import { useState, KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  GripVertical, Plus, Trash2, Check, X,
  Type, Mail, Phone, Hash, AlignLeft, ChevronDown, ToggleLeft,
  Tag, Link2, Palette, Database, FileCheck, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useCrmStore } from '@/store/crmStore';
import { toast } from 'sonner';

type FieldType = 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'dropdown' | 'checkbox';

interface FormField {
  id: string;
  label: string;
  type: FieldType;
  placeholder: string;
  required: boolean;
  mapTo: string; // CRM field slug to map this field to
}

const FIELD_ICONS: Record<FieldType, React.ElementType> = {
  text: Type, email: Mail, phone: Phone, number: Hash,
  textarea: AlignLeft, dropdown: ChevronDown, checkbox: ToggleLeft,
};

const FIELD_LABELS: Record<FieldType, string> = {
  text: 'Text', email: 'Email', phone: 'Phone', number: 'Number',
  textarea: 'Long Text', dropdown: 'Dropdown', checkbox: 'Checkbox',
};

const FIELD_TYPES: FieldType[] = ['text', 'email', 'phone', 'number', 'textarea', 'dropdown', 'checkbox'];

// Standard CRM fields always available for mapping
const STANDARD_CRM_FIELDS = [
  { slug: 'first_name', name: 'First Name' },
  { slug: 'last_name', name: 'Last Name' },
  { slug: 'email', name: 'Email' },
  { slug: 'phone', name: 'Phone' },
];

const seedFields: Record<string, FormField[]> = {
  'form-1': [
    { id: 'f1', label: 'Full Name', type: 'text', placeholder: 'Your name', required: true, mapTo: 'first_name' },
    { id: 'f2', label: 'Email', type: 'email', placeholder: 'you@example.com', required: true, mapTo: 'email' },
    { id: 'f3', label: 'Phone', type: 'phone', placeholder: '+91 9876543210', required: false, mapTo: 'phone' },
    { id: 'f4', label: 'Message', type: 'textarea', placeholder: 'How can we help?', required: false, mapTo: '' },
  ],
  'form-2': [
    { id: 'f1', label: 'Name', type: 'text', placeholder: 'Your name', required: true, mapTo: 'first_name' },
    { id: 'f2', label: 'Work Email', type: 'email', placeholder: 'work@company.com', required: true, mapTo: 'email' },
    { id: 'f3', label: 'Company', type: 'text', placeholder: 'Company name', required: true, mapTo: 'company_name' },
  ],
  'form-3': [
    { id: 'f1', label: 'Name', type: 'text', placeholder: 'Your name', required: true, mapTo: 'first_name' },
    { id: 'f2', label: 'Email', type: 'email', placeholder: 'you@example.com', required: true, mapTo: 'email' },
  ],
};

const seedNames: Record<string, string> = {
  'form-1': 'Contact Us',
  'form-2': 'Demo Request',
  'form-3': 'Newsletter Signup',
};

// ── ColorPicker ────────────────────────────────────────────────────────────────
function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a6b5c] mb-2">{label}</label>
      <label className="flex items-center gap-3 cursor-pointer">
        <div className="flex-1 h-9 rounded-xl border border-black/8 relative overflow-hidden" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        </div>
        <span className="text-[11px] font-mono text-[#7a6b5c] shrink-0 w-16">{value}</span>
      </label>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CustomFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';

  const { pipelines, customFields, addPipeline } = useCrmStore();

  // All available CRM fields = standard + custom fields from FieldsPage
  const allCrmFields = [
    ...STANDARD_CRM_FIELDS,
    ...customFields.map((cf) => ({ slug: cf.slug, name: cf.name })),
  ];

  // Basic
  const [formName, setFormName] = useState(isNew ? '' : (seedNames[id ?? ''] ?? 'Untitled Form'));

  // Button
  const [submitLabel, setSubmitLabel] = useState('Submit');
  const [redirectLink, setRedirectLink] = useState('');
  const [btnColor, setBtnColor] = useState('#ea580c');
  const [btnTextColor, setBtnTextColor] = useState('#ffffff');

  // Form colors
  const [transparentForm, setTransparentForm] = useState(false);
  const [formBgColor, setFormBgColor] = useState('#ffffff');
  const [formTextColor, setFormTextColor] = useState('#1c1410');

  // Fields
  const [fields, setFields] = useState<FormField[]>(
    isNew
      ? [{ id: 'f1', label: 'Full Name', type: 'text', placeholder: 'Your name', required: true, mapTo: 'first_name' }]
      : (seedFields[id ?? ''] ?? [
          { id: 'f1', label: 'Full Name', type: 'text', placeholder: 'Your name', required: true, mapTo: 'first_name' },
          { id: 'f2', label: 'Email', type: 'email', placeholder: 'you@example.com', required: true, mapTo: 'email' },
        ])
  );
  const [addType, setAddType] = useState<FieldType>('text');

  // Add to CRM
  const [pipelineId, setPipelineId] = useState('');
  const [stage, setStage] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Add Pipeline inline
  const [showAddPipeline, setShowAddPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');

  // Declaration
  const [declarationEnabled, setDeclarationEnabled] = useState(false);
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyLink, setPolicyLink] = useState('');

  // ── Helpers ──
  const updateField = (fid: string, changes: Partial<FormField>) =>
    setFields(fields.map((f) => f.id === fid ? { ...f, ...changes } : f));

  const removeField = (fid: string) => {
    if (fields.length === 1) { toast.error('A form must have at least one field'); return; }
    setFields(fields.filter((f) => f.id !== fid));
  };

  const addField = () => {
    setFields([...fields, {
      id: `nf-${Date.now()}`,
      label: FIELD_LABELS[addType],
      type: addType,
      placeholder: '',
      required: false,
      mapTo: '',
    }]);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(''); return; }
    setTags([...tags, t]);
    setTagInput('');
  };

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
  };

  const handleAddPipeline = () => {
    const name = newPipelineName.trim();
    if (!name) { toast.error('Pipeline name is required'); return; }
    const newPl = { id: `pl-${Date.now()}`, name, stages: ['New Lead', 'Contacted', 'Qualified', 'Won', 'Lost'] };
    addPipeline(newPl);
    setPipelineId(newPl.id);
    setStage('');
    setNewPipelineName('');
    setShowAddPipeline(false);
    toast.success(`Pipeline "${name}" created`);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error('Form name is required'); return; }
    toast.success('Form saved successfully');
  };

  const selectedPipeline = pipelines.find((p) => p.id === pipelineId);
  const previewBg = transparentForm ? 'transparent' : formBgColor;

  return (
    <div className="h-full flex flex-col -m-5 md:-m-8">

      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-black/5 px-6 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-headline text-[17px] font-bold text-[#1c1410] truncate">
            {formName || (isNew ? 'New Form' : 'Untitled Form')}
          </h2>
        </div>
        <Button onClick={handleSave} size="sm">
          <Check className="w-4 h-4" /> Save
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Settings ── */}
        <div className="w-full lg:w-[55%] overflow-y-auto border-r border-black/5 bg-[#faf8f6]">
          <div className="p-6 space-y-5">

            {/* Form Name */}
            <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5">
              <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-2">Form Name *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Contact Us, Demo Request…" />
            </div>

            {/* Button */}
            <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Button</h3>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-2">Button Title</label>
                <Input value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} placeholder="e.g. Submit, Enquire Now" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-1">Redirect Link</label>
                <p className="text-[11px] text-[#b09e8d] mb-2">Where to send the user after form is submitted</p>
                <Input value={redirectLink} onChange={(e) => setRedirectLink(e.target.value)} placeholder="https://yoursite.com/thank-you" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ColorPicker label="Button Color" value={btnColor} onChange={setBtnColor} />
                <ColorPicker label="Button Text Color" value={btnTextColor} onChange={setBtnTextColor} />
              </div>
            </div>

            {/* Form Colors */}
            <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Palette className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Form Colors</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={transparentForm} onChange={(e) => setTransparentForm(e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500" />
                  <span className="text-[12px] font-medium text-[#7a6b5c]">Transparent background</span>
                </label>
              </div>
              <div className={`grid grid-cols-2 gap-4 transition-opacity ${transparentForm ? 'opacity-40 pointer-events-none' : ''}`}>
                <ColorPicker label="Form Background" value={formBgColor} onChange={setFormBgColor} />
                <ColorPicker label="Form Text Color" value={formTextColor} onChange={setFormTextColor} />
              </div>
            </div>

            {/* Form Fields */}
            <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
              <div className="px-5 py-4 border-b border-black/5">
                <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Form Fields</h3>
                <p className="text-[11px] text-[#7a6b5c] mt-0.5">
                  {fields.length} field{fields.length !== 1 ? 's' : ''} · map each to a CRM field to auto-populate leads
                </p>
              </div>

              <div className="divide-y divide-black/5">
                {fields.map((field) => {
                  const Icon = FIELD_ICONS[field.type];
                  return (
                    <div key={field.id} className="flex items-start gap-3 px-5 py-4">
                      <button className="mt-1 shrink-0 cursor-grab text-[#b09e8d] hover:text-[#7a6b5c] transition-colors">
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2.5 min-w-0">
                        {/* Label + Placeholder */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a6b5c] mb-1.5">Label</label>
                            <Input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })}
                              placeholder="Field label" className="h-9 text-sm" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a6b5c] mb-1.5">Placeholder</label>
                            <Input value={field.placeholder} onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                              placeholder="Placeholder text" className="h-9 text-sm" />
                          </div>
                        </div>

                        {/* Map to CRM Field */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a6b5c] mb-1.5">
                            Maps to CRM Field
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-emerald-50 flex items-center justify-center shrink-0">
                              <ArrowRight className="w-3 h-3 text-emerald-600" />
                            </div>
                            <select
                              value={field.mapTo}
                              onChange={(e) => updateField(field.id, { mapTo: e.target.value })}
                              className="flex-1 text-[12px] border border-black/8 rounded-lg px-2.5 py-1.5 bg-[#faf8f6] text-[#1c1410] outline-none focus:border-emerald-400/50"
                            >
                              <option value="">— Not mapped —</option>
                              <optgroup label="Standard Fields">
                                {STANDARD_CRM_FIELDS.map((f) => (
                                  <option key={f.slug} value={f.slug}>{f.name}</option>
                                ))}
                              </optgroup>
                              {customFields.length > 0 && (
                                <optgroup label="Custom Fields">
                                  {customFields.map((cf) => (
                                    <option key={cf.slug} value={cf.slug}>{cf.name}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>
                          {field.mapTo && (
                            <p className="text-[10px] text-emerald-600 mt-1 ml-7">
                              → Saves to <span className="font-semibold">{allCrmFields.find((f) => f.slug === field.mapTo)?.name ?? field.mapTo}</span>
                            </p>
                          )}
                        </div>

                        {/* Type + Required + Delete */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <select
                              value={field.type}
                              onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                              className="text-[12px] border border-black/8 rounded-lg px-2.5 py-1.5 bg-[#faf8f6] text-[#1c1410] outline-none focus:border-primary/30"
                            >
                              {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_LABELS[t]}</option>)}
                            </select>
                            <div className="flex items-center gap-1.5">
                              <Switch checked={field.required} onCheckedChange={(v) => updateField(field.id, { required: v })} />
                              <span className="text-[11px] text-[#7a6b5c]">Required</span>
                            </div>
                          </div>
                          <button onClick={() => removeField(field.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-[#b09e8d] hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add field */}
              <div className="px-5 py-4 border-t border-black/5 bg-[#faf8f6] flex items-center gap-3">
                <select value={addType} onChange={(e) => setAddType(e.target.value as FieldType)}
                  className="flex-1 text-[13px] border border-black/8 rounded-xl px-3 py-2 bg-white text-[#1c1410] outline-none focus:border-primary/30">
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_LABELS[t]}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={addField}>
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </Button>
              </div>
            </div>

            {/* Add to CRM */}
            <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Add to CRM</h3>
                  <p className="text-[11px] text-[#7a6b5c]">Auto-create a lead when this form is submitted</p>
                </div>
              </div>

              {/* Pipeline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245]">Pipeline</label>
                  <button
                    onClick={() => setShowAddPipeline(!showAddPipeline)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add Pipeline
                  </button>
                </div>

                {showAddPipeline && (
                  <div className="flex gap-2 mb-3 p-3 bg-[#faf8f6] rounded-xl border border-black/5">
                    <Input
                      value={newPipelineName}
                      onChange={(e) => setNewPipelineName(e.target.value)}
                      placeholder="Pipeline name e.g. Real Estate"
                      className="flex-1 h-9 text-sm"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddPipeline(); }}
                      autoFocus
                    />
                    <Button size="sm" onClick={handleAddPipeline}>
                      <Check className="w-3.5 h-3.5" /> Create
                    </Button>
                    <button onClick={() => { setShowAddPipeline(false); setNewPipelineName(''); }}
                      className="p-2 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <select
                  value={pipelineId}
                  onChange={(e) => { setPipelineId(e.target.value); setStage(''); }}
                  className="w-full text-[13px] border border-black/8 rounded-xl px-3 py-2.5 bg-[#faf8f6] text-[#1c1410] outline-none focus:border-primary/30"
                >
                  <option value="">— Select a pipeline —</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Stage */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-2">Initial Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  disabled={!pipelineId}
                  className="w-full text-[13px] border border-black/8 rounded-xl px-3 py-2.5 bg-[#faf8f6] text-[#1c1410] outline-none focus:border-primary/30 disabled:opacity-40"
                >
                  <option value="">— Select a stage —</option>
                  {(selectedPipeline?.stages ?? []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                {!pipelineId && <p className="text-[11px] text-[#b09e8d] mt-1">Select a pipeline first</p>}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tags
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-black/8 bg-[#faf8f6] min-h-[42px]">
                  {tags.map((t) => (
                    <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium">
                      {t}
                      <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKey} onBlur={addTag}
                    placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : 'Add more…'}
                    className="flex-1 min-w-[120px] text-[13px] bg-transparent outline-none text-[#1c1410] placeholder:text-[#b09e8d]"
                  />
                </div>
              </div>
            </div>

            {/* Declaration */}
            <div className="bg-white rounded-2xl border border-black/5 card-shadow p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <FileCheck className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-[#1c1410] text-[14px]">Declaration</h3>
                    <p className="text-[11px] text-[#7a6b5c]">Show a consent / policy checkbox to users</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={declarationEnabled} onCheckedChange={setDeclarationEnabled} />
                  <span className="text-[12px] font-medium text-[#7a6b5c]">{declarationEnabled ? 'Enabled' : 'Off'}</span>
                </div>
              </div>
              {declarationEnabled && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-2">Policy Title</label>
                    <Input value={policyTitle} onChange={(e) => setPolicyTitle(e.target.value)}
                      placeholder="e.g. I agree to the Terms & Privacy Policy" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-2">Policy Link</label>
                    <Input value={policyLink} onChange={(e) => setPolicyLink(e.target.value)}
                      placeholder="https://yoursite.com/privacy-policy" />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Right: Live Preview ── */}
        <div className="hidden lg:flex flex-1 flex-col overflow-y-auto bg-[#f5ede3]/30">
          <div className="p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7a6b5c] mb-5">Live Preview</p>

            <div className="rounded-2xl border border-black/5 card-shadow p-6 max-w-sm mx-auto"
              style={{ background: previewBg, color: formTextColor }}>
              <h3 className="font-headline text-[17px] font-bold mb-5" style={{ color: formTextColor }}>
                {formName || 'Untitled Form'}
              </h3>
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-[12px] font-semibold mb-1.5" style={{ color: formTextColor }}>
                      {field.label || 'Field'}
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                      {field.mapTo && (
                        <span className="ml-2 text-[10px] font-normal text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                          → {allCrmFields.find((f) => f.slug === field.mapTo)?.name ?? field.mapTo}
                        </span>
                      )}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea disabled placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        className="w-full h-20 px-3 py-2.5 rounded-xl bg-[#faf8f6] border border-black/5 text-[13px] text-[#7a6b5c] placeholder:text-[#b09e8d] resize-none outline-none" />
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center gap-2">
                        <input type="checkbox" disabled className="w-4 h-4 rounded" style={{ accentColor: btnColor }} />
                        <span className="text-[13px]" style={{ color: formTextColor }}>{field.placeholder || field.label}</span>
                      </div>
                    ) : (
                      <input disabled type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#faf8f6] border border-black/5 text-[13px] text-[#7a6b5c] placeholder:text-[#b09e8d] outline-none" />
                    )}
                  </div>
                ))}
              </div>

              {declarationEnabled && policyTitle && (
                <div className="flex items-start gap-2 mt-4">
                  <input type="checkbox" disabled className="w-4 h-4 mt-0.5 rounded shrink-0" />
                  <span className="text-[12px]" style={{ color: formTextColor }}>
                    {policyTitle}
                    {policyLink && <span className="underline ml-1 opacity-60">View Policy</span>}
                  </span>
                </div>
              )}

              <button disabled className="mt-6 w-full py-3 rounded-xl text-[14px] font-semibold"
                style={{ background: btnColor, color: btnTextColor }}>
                {submitLabel || 'Submit'}
              </button>
            </div>

            {/* CRM mapping summary */}
            {(pipelineId || tags.length > 0) && (
              <div className="mt-5 max-w-sm mx-auto bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">CRM Mapping</p>
                {selectedPipeline && (
                  <p className="text-[12px] text-emerald-800">
                    Pipeline: <span className="font-semibold">{selectedPipeline.name}</span>
                    {stage && <> → <span className="font-semibold">{stage}</span></>}
                  </p>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-medium">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
