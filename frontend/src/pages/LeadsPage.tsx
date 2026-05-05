import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCrmStore, LeadActivity } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Lead, Pipeline } from '@/data/mockData';
import {
  Search, Filter, Plus, GripVertical, Phone, X, MessageCircle, Calendar,
  FileText, User, Tag, DollarSign, ChevronDown, Trash2, Check,
  Mail, Pencil, CheckSquare, RotateCcw, LayoutGrid, List, EyeOff, Eye,
  Star, ChevronRight, ArrowLeft, ArrowRight, Settings, Download, Package, Zap, Copy, ArrowUpDown, Layers,
  CalendarPlus, MoreHorizontal, UserX, ArrowLeftRight, UserCheck, UserPlus, Circle, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { cn, copyToClipboard } from '@/lib/utils';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragOverlay, DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

function getSourceLabel(lead: { source: string; meta_form_name?: string }) {
  const s = lead.source ?? '';
  if (s.startsWith('calendar:')) return s.slice(9);
  if (s.startsWith('form:'))     return s.slice(5);
  if (s === 'calendar_booking')  return 'Calendar Booking';
  if (s === 'Custom Form')       return 'Custom Form';
  if (s === 'meta_form') return 'Meta';
  if (s === 'whatsapp' || s === 'WhatsApp') return 'WhatsApp';
  if (s === 'Landing Page') return 'Landing Page';
  return s || 'Manual';
}

function getSourceColor(source: string) {
  const s = source ?? '';
  if (s.startsWith('calendar:') || s === 'calendar_booking') return 'bg-teal-50 text-teal-600';
  if (s.startsWith('form:') || s === 'Custom Form')          return 'bg-purple-50 text-purple-600';
  if (s === 'meta_form')    return 'bg-blue-50 text-blue-600';
  if (s === 'whatsapp' || s === 'WhatsApp') return 'bg-emerald-50 text-emerald-600';
  if (s === 'Manual')       return 'bg-[#faf0e8] text-primary';
  if (s === 'Landing Page') return 'bg-amber-50 text-amber-600';
  return 'bg-gray-100 text-gray-500';
}

const SOURCE_COLORS: Record<string, string> = {
  'meta_form':        'bg-blue-50 text-blue-600',
  'Meta Forms':       'bg-blue-50 text-blue-600',
  'WhatsApp':         'bg-emerald-50 text-emerald-600',
  'whatsapp':         'bg-emerald-50 text-emerald-600',
  'Custom Form':      'bg-purple-50 text-purple-600',
  'Manual':           'bg-[#faf0e8] text-primary',
  'Landing Page':     'bg-amber-50 text-amber-600',
  'calendar_booking': 'bg-teal-50 text-teal-600',
};

const TAG_COLORS: Record<string, string> = {
  'Hot Lead': 'bg-red-100 text-red-700', 'Enterprise': 'bg-purple-100 text-purple-700',
  'SMB': 'bg-blue-100 text-blue-700', 'Follow Up': 'bg-yellow-100 text-yellow-700',
  'Demo Scheduled': 'bg-green-100 text-green-700', 'Price Sent': 'bg-orange-100 text-orange-700',
  'Urgent': 'bg-red-100 text-red-700', 'VIP': 'bg-amber-100 text-amber-700',
};

// ─── Add Lead Modal ────────────────────────────────────────────────────────────
function AddLeadModal({ onClose }: { onClose: () => void }) {
  const { addLead, pipelines, leads } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const now = new Date().toISOString();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '+91 ',
    city: '', pipelineId: pipelines[0]?.id ?? '', stage: pipelines[0]?.stages[0]?.name ?? '',
    tags: [] as string[], tagInput: '', dealValue: 0, source: 'Manual',
    assignedTo: currentUser?.id ?? '',
  });

  const selectedPipeline = pipelines.find((p) => p.id === form.pipelineId);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.phone.trim()) { toast.error('Name and phone are required'); return; }
    const normalizedPhone = form.phone.replace(/\D/g, '');
    if (normalizedPhone.length > 4) {
      const dup = leads.find((l) => l.phone.replace(/\D/g, '') === normalizedPhone);
      if (dup) { toast.error(`Phone already exists: ${dup.firstName} ${dup.lastName}`); return; }
    }
    setSaving(true);
    try {
      const stageId = selectedPipeline?.stages.find((s) => s.name === form.stage)?.id;
      const created = await api.post<any>('/api/leads', {
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        source: form.source,
        pipeline_id: form.pipelineId || undefined,
        stage_id: stageId || undefined,
        assigned_to: form.assignedTo || undefined,
        tags: form.tags,
      });
      addLead({
        id: created.id,
        firstName: form.firstName, lastName: form.lastName,
        email: form.email, phone: form.phone,
        pipelineId: form.pipelineId, stage: form.stage,
        source: form.source, dealValue: form.dealValue,
        tags: form.tags, score: 0, notes: [],
        assignedTo: form.assignedTo,
        createdAt: created.created_at ?? now, lastActivity: created.created_at ?? now,
      });
      toast.success('Opportunity added');
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-[#1c1410] outline-none focus:border-gray-400 placeholder:text-gray-300';
  const lbl = (text: string, required = false) => (
    <label className="text-[12px] text-[#7a6b5c] mb-1 block">{text}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-[16px] font-bold text-[#1c1410]">+ Add opportunity</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Opportunity pill */}
          <div>
            <button className="px-4 py-1.5 rounded-lg text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>
              Opportunity
            </button>
          </div>

          <h4 className="text-[16px] font-bold text-[#1c1410]">Contact Info</h4>

          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <div>
              {lbl('Opportunity Name', true)}
              <input className={inputCls} placeholder="Add Opportunity Name" value={`${form.firstName} ${form.lastName}`.trim()} onChange={(e) => { const [f, ...l] = e.target.value.split(' '); setForm({ ...form, firstName: f, lastName: l.join(' ') }); }} />
            </div>
            <div>
              {lbl('Contact Name', true)}
              <input className={inputCls} placeholder="Contact Name" value={`${form.firstName} ${form.lastName}`.trim()} readOnly />
            </div>
            <div>
              {lbl('Email')}
              <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              {lbl('Phone')}
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 focus-within:border-gray-400">
                <span className="text-[13px] shrink-0">🇮🇳 +91</span>
                <input className="flex-1 text-[13px] text-[#1c1410] outline-none bg-transparent placeholder:text-gray-300" placeholder="81234 56789" value={form.phone.replace('+91 ', '')} onChange={(e) => setForm({ ...form, phone: '+91 ' + e.target.value })} />
              </div>
            </div>
            <div>
              {lbl('City')}
              <input className={inputCls} placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              {lbl('Pipeline', true)}
              <select className={inputCls} value={form.pipelineId} onChange={(e) => {
                const pl = pipelines.find((p) => p.id === e.target.value);
                setForm({ ...form, pipelineId: e.target.value, stage: pl?.stages[0]?.name ?? '' });
              }}>
                <option value="">Select Pipeline</option>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              {lbl('Stage', true)}
              <select className={inputCls} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {(selectedPipeline?.stages ?? []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              {lbl('Created At')}
              <input className={inputCls} type="datetime-local" defaultValue={format(new Date(now), "yyyy-MM-dd'T'HH:mm")} readOnly />
            </div>
            <div>
              {lbl('Tags')}
              <div className="border border-gray-200 rounded-lg px-3 py-2 focus-within:border-gray-400 transition-all">
                <div className="flex flex-wrap gap-1 mb-1">
                  {form.tags.map((t) => (
                    <span key={t} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-md flex items-center gap-1">
                      {t}<button onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
                <input
                  className="w-full text-[13px] outline-none bg-transparent placeholder:text-gray-300"
                  placeholder="Write & hit enter to add tags"
                  value={form.tagInput}
                  onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && form.tagInput.trim()) { setForm({ ...form, tags: [...form.tags, form.tagInput.trim()], tagInput: '' }); }}}
                />
              </div>
            </div>
            <div>
              {lbl('Lead Value')}
              <input className={inputCls} type="number" placeholder="0" value={form.dealValue || ''} onChange={(e) => setForm({ ...form, dealValue: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">Created On: {format(new Date(now), 'dd/MM/yyyy HH:mm aa').toUpperCase()}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">CANCEL</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>{saving ? 'Saving…' : 'SAVE'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Panel ──────────────────────────────────────────────────────────────
const DATE_RANGES = ['Today', 'Yesterday', 'This Week', 'Last Week', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'This Year', 'Last Year', 'Custom'];
const LEAD_QUALITIES = ['Cold Lead', 'Hot Lead', 'Warm Lead', 'Won', 'Lost'];
const OPP_VALUES = ['Less than ₹1,000', '₹1,000 - ₹5,000', '₹5,001 - ₹10,000', '₹10,001 - ₹50,000', 'More than ₹50,000', 'Custom'];

const emptyFilters = {
  assignedTo: [] as string[],
  contactType: [] as string[],
  stage: [] as string[],
  tags: [] as string[],
  leadQuality: [] as string[],
  opportunityValue: [] as string[],
  initialCallDate: '',
  createdOn: '',
  updatedOn: '',
  calendar: '',
  followUp: '',
};
type FilterState = typeof emptyFilters;

const FILTER_CATS = [
  { key: 'assignedTo',     label: 'Assigned to',       Icon: User },
  { key: 'contactType',    label: 'Lead | Customer',    Icon: FileText },
  { key: 'stage',          label: 'Filter by Stage',    Icon: Layers },
  { key: 'tags',           label: 'Filter by Tag',      Icon: Tag },
  { key: 'leadQuality',    label: 'Lead Quality',       Icon: Star },
  { key: 'opportunityValue', label: 'Opportunity Value', Icon: DollarSign },
  { key: 'initialCallDate', label: 'Initial Call Date', Icon: Calendar },
  { key: 'createdOn',      label: 'Created on',         Icon: Calendar },
  { key: 'updatedOn',      label: 'Updated on',         Icon: Calendar },
  { key: 'calendar',       label: 'Calendar',           Icon: Calendar },
  { key: 'followUp',       label: 'Follow Up',          Icon: Calendar },
];

function FilterPanel({ filters, onChange, onClose, stages }: { filters: FilterState; onChange: (f: FilterState) => void; onClose: () => void; stages: string[] }) {
  const { tags: storeTags, staff } = useCrmStore();
  const [local, setLocal] = useState<FilterState>(filters);
  const [subPanel, setSubPanel] = useState('');
  const [subSearch, setSubSearch] = useState('');

  const apply = () => { onChange(local); onClose(); };
  const clearAll = () => setLocal({ ...emptyFilters });

  const toggleArr = (key: keyof FilterState, val: string) => {
    const arr = local[key] as string[];
    setLocal({ ...local, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] });
  };
  const setRadio = (key: keyof FilterState, val: string) => {
    setLocal({ ...local, [key]: (local[key] as string) === val ? '' : val });
  };

  const hasActive = (key: string) => { const v = (local as any)[key]; return Array.isArray(v) ? v.length > 0 : !!v; };
  const hasSearch = ['assignedTo', 'tags', 'stage'].includes(subPanel);
  const activeCat = FILTER_CATS.find((c) => c.key === subPanel);

  const CheckItem = ({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) => (
    <button onClick={onClick} className={cn('w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors', checked ? 'bg-green-50' : 'hover:bg-gray-50')}>
      <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', checked ? 'border-primary bg-primary' : 'border-gray-300')}>
        {checked && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <span className="text-[14px] text-[#1c1410]">{label}</span>
    </button>
  );

  const RadioItem = ({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) => (
    <button onClick={onClick} className={cn('w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors', selected ? 'bg-green-50' : 'hover:bg-gray-50')}>
      <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', selected ? 'border-primary' : 'border-gray-300')}>
        {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      <span className="text-[14px] text-[#1c1410]">{label}</span>
    </button>
  );

  const renderSubContent = () => {
    if (subPanel === 'assignedTo') {
      const opts = [{ id: 'none', name: 'Assigned to None' }, ...staff.map((s) => ({ id: s.id, name: s.name }))];
      return opts.filter((o) => o.name.toLowerCase().includes(subSearch.toLowerCase())).map((o) => (
        <CheckItem key={o.id} checked={local.assignedTo.includes(o.id)} label={o.name} onClick={() => toggleArr('assignedTo', o.id)} />
      ));
    }
    if (subPanel === 'contactType') {
      return ['Lead', 'Customer'].map((o) => (
        <CheckItem key={o} checked={local.contactType.includes(o)} label={o} onClick={() => toggleArr('contactType', o)} />
      ));
    }
    if (subPanel === 'stage') {
      return stages.filter((s) => s.toLowerCase().includes(subSearch.toLowerCase())).map((s) => (
        <CheckItem key={s} checked={local.stage.includes(s)} label={s} onClick={() => toggleArr('stage', s)} />
      ));
    }
    if (subPanel === 'tags') {
      const allTags = storeTags.map((t) => t.name);
      return allTags.filter((t) => t.toLowerCase().includes(subSearch.toLowerCase())).map((t) => (
        <CheckItem key={t} checked={local.tags.includes(t)} label={t} onClick={() => toggleArr('tags', t)} />
      ));
    }
    if (subPanel === 'leadQuality') {
      return LEAD_QUALITIES.map((q) => (
        <CheckItem key={q} checked={local.leadQuality.includes(q)} label={q} onClick={() => toggleArr('leadQuality', q)} />
      ));
    }
    if (subPanel === 'opportunityValue') {
      return OPP_VALUES.map((v) => (
        <CheckItem key={v} checked={local.opportunityValue.includes(v)} label={v} onClick={() => toggleArr('opportunityValue', v)} />
      ));
    }
    if (['initialCallDate', 'createdOn', 'updatedOn', 'calendar', 'followUp'].includes(subPanel)) {
      return DATE_RANGES.map((d) => (
        <RadioItem key={d} selected={(local as any)[subPanel] === d} label={d} onClick={() => setRadio(subPanel as keyof FilterState, d)} />
      ));
    }
    return null;
  };

  const BottomBar = () => (
    <div className="flex items-center gap-1.5 px-3 py-3 border-t border-black/5 shrink-0">
      <button onClick={clearAll} className="text-[12px] font-semibold text-red-500 hover:text-red-600 transition-colors shrink-0 mr-1">Clear all</button>
      <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-semibold text-[#1c1410] hover:bg-gray-50 transition-colors shrink-0">Cancel</button>
      <button onClick={apply} className="flex-1 py-1.5 rounded-lg text-[12px] font-bold text-white whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)' }}>Apply & Save</button>
      <button onClick={apply} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)' }}>Apply</button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backdropFilter: 'blur(3px)', backgroundColor: 'rgba(0,0,0,0.25)' }} onClick={onClose}>
      <div className="bg-white w-[340px] h-full flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-black/5 shrink-0">
          <div className="flex items-center gap-3">
            {subPanel && (
              <button onClick={() => { setSubPanel(''); setSubSearch(''); }} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <ArrowLeft className="w-4 h-4 text-[#7a6b5c]" />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Filter className="w-4 h-4 text-blue-500" />
            </div>
            <span className="font-bold text-[15px] text-[#1c1410]">{subPanel ? activeCat?.label : 'Filters'}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-[#7a6b5c]" />
          </button>
        </div>

        {/* Sub-panel search */}
        {subPanel && hasSearch && (
          <div className="px-4 py-2.5 border-b border-black/5 shrink-0">
            <input
              autoFocus
              className="w-full px-3 py-2 text-[13px] bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-primary/30 placeholder:text-gray-400"
              placeholder="Search"
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04]">
          {!subPanel
            ? FILTER_CATS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => { setSubPanel(key); setSubSearch(''); }}
                  className={cn('w-full flex items-center gap-3 px-5 py-4 text-left transition-colors', hasActive(key) ? 'bg-green-50' : 'hover:bg-gray-50')}
                >
                  <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="flex-1 text-[14px] text-[#1c1410]">{label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              ))
            : renderSubContent()
          }
        </div>

        <BottomBar />
      </div>
    </div>
  );
}

// ─── Compact Filter Popover (kept for deep filter) ─────────────────────────────
function FilterPopover({ filters, onChange, onClose, stages, anchorRef }: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClose: () => void;
  stages: string[];
  anchorRef: React.RefObject<HTMLButtonElement>;
}) {
  const { tags: storeTags, staff } = useCrmStore();
  const [expanded, setExpanded] = useState<string>('assignedTo');
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', esc); };
  }, [onClose, anchorRef]);

  const toggleArr = (k: keyof FilterState, v: string) => {
    const a = filters[k] as string[];
    onChange({ ...filters, [k]: a.includes(v) ? a.filter((x) => x !== v) : [...a, v] });
  };
  const setRadio = (k: keyof FilterState, v: string) => {
    onChange({ ...filters, [k]: (filters[k] as string) === v ? '' : v });
  };
  const clearAll = () => onChange({ ...emptyFilters });
  const total = Object.values(filters).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0);

  const sections: { key: keyof FilterState; label: string; type: 'multi' | 'single'; options: { value: string; label: string }[] }[] = [
    { key: 'assignedTo', label: 'Assignee', type: 'multi', options: [{ value: 'none', label: 'Unassigned' }, ...staff.map((s) => ({ value: s.id, label: s.name }))] },
    { key: 'stage', label: 'Stage', type: 'multi', options: stages.map((s) => ({ value: s, label: s })) },
    { key: 'tags', label: 'Tags', type: 'multi', options: storeTags.map((t) => ({ value: t.name, label: t.name })) },
    { key: 'contactType', label: 'Type', type: 'multi', options: [{ value: 'Lead', label: 'Lead' }, { value: 'Customer', label: 'Customer' }] },
    { key: 'leadQuality', label: 'Lead Quality', type: 'multi', options: LEAD_QUALITIES.map((q) => ({ value: q, label: q })) },
    { key: 'opportunityValue', label: 'Deal Value', type: 'multi', options: OPP_VALUES.map((v) => ({ value: v, label: v })) },
    { key: 'createdOn', label: 'Created', type: 'single', options: DATE_RANGES.map((d) => ({ value: d, label: d })) },
    { key: 'followUp', label: 'Follow-up due', type: 'single', options: DATE_RANGES.map((d) => ({ value: d, label: d })) },
  ];

  const q = search.toLowerCase();
  const matching = sections.map((s) => ({ ...s, options: q ? s.options.filter((o) => o.label.toLowerCase().includes(q) || s.label.toLowerCase().includes(q)) : s.options })).filter((s) => !q || s.options.length > 0);

  const countFor = (key: string) => { const v = (filters as any)[key]; return Array.isArray(v) ? v.length : (v ? 1 : 0); };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-11 z-50 w-[340px] bg-white rounded-2xl border border-black/5 overflow-hidden flex flex-col"
      style={{ maxHeight: '70vh', boxShadow: '0 12px 40px rgba(0,0,0,0.14)' }}
    >
      <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2 shrink-0">
        <Filter className="w-4 h-4 text-primary" />
        <h4 className="text-[14px] font-bold text-[#1c1410] flex-1">Filters</h4>
        {total > 0 && (
          <button onClick={clearAll} className="text-[11px] font-semibold text-red-500 hover:underline">Clear all · {total}</button>
        )}
        <button onClick={onClose} className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-[#7a6b5c]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 py-2 border-b border-black/5 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
          <input
            autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-[#faf8f6] border border-transparent rounded-lg outline-none focus:border-primary/30 focus:bg-white placeholder:text-gray-400"
            placeholder="Search filters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-black/[0.05]">
        {matching.map((s) => {
          const isOpen = expanded === s.key || !!q;
          const sel = countFor(s.key);
          return (
            <div key={s.key}>
              <button onClick={() => setExpanded(isOpen ? '' : s.key)} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[#faf8f6] transition-colors">
                <span className="flex-1 text-left text-[13px] font-semibold text-[#1c1410]">{s.label}</span>
                {sel > 0 && <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">{sel}</span>}
                <ChevronDown className={cn('w-3.5 h-3.5 text-[#b09e8d] transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="px-3 pb-2 pt-0.5 space-y-0.5 max-h-52 overflow-y-auto">
                  {s.options.length === 0 && <p className="text-[11px] text-[#b09e8d] py-2 italic px-2">No options</p>}
                  {s.options.map((o) => {
                    const isOn = s.type === 'multi' ? (filters[s.key] as string[]).includes(o.value) : (filters[s.key] as string) === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => s.type === 'multi' ? toggleArr(s.key, o.value) : setRadio(s.key, o.value)}
                        className={cn('w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors',
                          isOn ? 'bg-[#faf0e8] text-primary' : 'hover:bg-[#faf8f6] text-[#1c1410]')}
                      >
                        {s.type === 'multi' ? (
                          <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', isOn ? 'bg-primary border-primary' : 'border-gray-300')}>
                            {isOn && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                        ) : (
                          <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', isOn ? 'border-primary' : 'border-gray-300')}>
                            {isOn && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                          </div>
                        )}
                        <span className="text-[12.5px] font-medium flex-1">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {matching.length === 0 && <p className="text-[12px] text-[#b09e8d] text-center py-6">No filters match "{search}"</p>}
      </div>

      <div className="px-4 py-2 border-t border-black/5 bg-[#faf8f6] shrink-0 text-center">
        <p className="text-[10px] text-[#7a6b5c]">Instant apply · <kbd className="text-[9px] bg-white border border-black/10 rounded px-1">Esc</kbd> to close</p>
      </div>
    </div>
  );
}

// ─── Removable Filter Chip ─────────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
      {label}
      <button onClick={onRemove} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

// ─── Workflow Modal ─────────────────────────────────────────────────────────────
function WorkflowModal({ leadIds, onClose }: { leadIds: string[]; onClose: () => void }) {
  const { workflows } = useCrmStore();
  const activeWorkflows = workflows.filter((w) => (w as any).status === 'active');
  const [selected, setSelected] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!selected) { toast.error('Please select a workflow'); return; }
    const wf = activeWorkflows.find((w) => w.id === selected);
    setSending(true);
    try {
      await api.post(`/api/workflows/${selected}/bulk-trigger`, { lead_ids: leadIds });
      toast.success(`${leadIds.length} contact${leadIds.length !== 1 ? 's' : ''} pushed to "${wf?.name}" — automation is executing`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to trigger workflow');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <h3 className="font-bold text-[17px] text-[#1c1410]">Trigger Workflow</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-[#7a6b5c]" /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <label className="text-[13px] font-semibold text-[#1c1410] block">Select Active Workflow</label>
          <div className="relative">
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 bg-white appearance-none pr-10">
              <option value="">— Choose a workflow —</option>
              {activeWorkflows.map((wf) => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {activeWorkflows.length === 0 && (
            <p className="text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              No active workflows found. Set a workflow to Active in Automation first.
            </p>
          )}
          <p className="text-[12px] text-blue-500 flex items-start gap-1.5 pt-1">
            <Settings className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {leadIds.length} contact{leadIds.length !== 1 ? 's' : ''} selected — all will be pushed through the chosen workflow.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/5">
          <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200 text-[13px] font-bold text-gray-600 hover:bg-gray-300 transition-colors uppercase tracking-wide">Close</button>
          <button onClick={send} disabled={sending || !selected} className="px-6 py-2 rounded-lg bg-green-500 text-[13px] font-bold text-white hover:bg-green-600 disabled:opacity-50 transition-colors uppercase tracking-wide">
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Modal ──────────────────────────────────────────────────────────────
const IMPORT_STEPS = ['Upload CSV File', 'Mapping', 'Manage', 'Result'];
const CRM_FIELDS = ['First Name', 'Last Name', 'Phone', 'Email', 'Deal Value', 'Stage', 'Source', 'Tag', '-- Skip --'];

function ImportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [importOption, setImportOption] = useState('Create New Opportunities Only');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [allCsvRows, setAllCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{ imported: number; errors: Array<{ row: number; reason: string }> } | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('File size exceeds 5 MB'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split('\n').filter((l) => l.trim());
      if (!lines.length) return;
      const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
      const allRows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim().replace(/"/g, '')));
      const rows = allRows.slice(0, 5);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setAllCsvRows(allRows);
      const autoMap: Record<string, string> = {};
      headers.forEach((h) => {
        const lo = h.toLowerCase();
        if (lo.includes('first')) autoMap[h] = 'First Name';
        else if (lo.includes('last')) autoMap[h] = 'Last Name';
        else if (lo.includes('phone')) autoMap[h] = 'Phone';
        else if (lo.includes('email')) autoMap[h] = 'Email';
        else if (lo.includes('value') || lo.includes('deal')) autoMap[h] = 'Deal Value';
        else if (lo.includes('stage')) autoMap[h] = 'Stage';
        else if (lo.includes('source')) autoMap[h] = 'Source';
        else if (lo.includes('tag')) autoMap[h] = 'Tag';
        else autoMap[h] = '-- Skip --';
      });
      setMapping(autoMap);
    };
    reader.readAsText(f);
  };

  const downloadSample = () => {
    const csv = 'First Name,Last Name,Phone,Email,Deal Value,Stage,Source\nJohn,Doe,+919876543210,john@example.com,50000,New Lead,Manual\nJane,Smith,+918765432109,jane@example.com,25000,Contacted,WhatsApp';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'sample_opportunities.csv' });
    a.click();
  };

  const next = async () => {
    if (step === 1 && !file) { toast.error('Please upload a CSV file'); return; }
    if (step === 3) {
      // Actual import
      setImporting(true);
      try {
        const reverseMap: Record<string, string> = {
          'First Name': 'first_name', 'Last Name': 'last_name', 'Phone': 'phone',
          'Email': 'email', 'Deal Value': 'deal_value', 'Stage': 'stage',
          'Source': 'source', 'Tag': 'tag',
        };
        const rows = allCsvRows.map((row) => {
          const obj: Record<string, string> = {};
          csvHeaders.forEach((h, i) => {
            const crmField = mapping[h];
            if (crmField && crmField !== '-- Skip --') {
              const key = reverseMap[crmField] ?? crmField.toLowerCase();
              obj[key] = row[i] ?? '';
            }
          });
          // Combine first+last as name
          if (obj.first_name || obj.last_name) {
            obj.name = `${obj.first_name ?? ''} ${obj.last_name ?? ''}`.trim();
          }
          return obj;
        });
        const result = await api.post<{ imported: number; errors: Array<{ row: number; reason: string }> }>(
          '/api/leads/import',
          { rows }
        );
        setImportResult(result);
      } catch {
        toast.error('Import failed');
        setImporting(false);
        return;
      } finally {
        setImporting(false);
      }
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const progress = ((step - 1) / 3) * 100;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0">
          <h3 className="font-bold text-[15px] text-[#1c1410]">Import Opportunities</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-[#7a6b5c]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <h2 className="text-center font-extrabold text-[22px] text-[#1c1410] mb-6">CSV Opportunity Import</h2>

          {/* Steps */}
          <div className="relative flex items-start justify-between mb-3">
            <div className="absolute top-4 h-px bg-gray-200 z-0" style={{ left: '12.5%', right: '12.5%' }} />
            {IMPORT_STEPS.map((s, i) => (
              <div key={s} className="flex flex-col items-center z-10 flex-1">
                <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center text-[13px] font-bold bg-white',
                  step > i + 1 ? 'border-primary bg-primary text-white' :
                  step === i + 1 ? 'border-[#1c1410] text-[#1c1410]' : 'border-gray-300 text-gray-300'
                )}>{i + 1}</div>
                <span className={cn('text-[11px] font-semibold mt-1.5 text-center', step === i + 1 ? 'text-[#1c1410]' : 'text-gray-400')}>{s}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 rounded-full mb-8 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #c2410c, #ea580c)' }} />
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-[13px] font-semibold text-[#1c1410] mb-2 block">Upload CSV File</label>
                <input type="file" accept=".csv" onChange={handleFile} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-gray-100 file:text-[12px] file:font-semibold cursor-pointer" />
                <p className="text-[12px] text-cyan-500 mt-1.5">Maximum file size is 5 MB</p>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#1c1410] mb-2 block">Choose import option for Opportunities</label>
                <select value={importOption} onChange={(e) => setImportOption(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 bg-white">
                  <option>Create New Opportunities Only</option>
                  <option>Update Existing Opportunities Only</option>
                  <option>Create and Update Opportunities</option>
                </select>
              </div>
              <button onClick={downloadSample} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary/20 text-[13px] font-semibold text-primary hover:bg-primary/5 transition-colors">
                <Download className="w-4 h-4" /> Download Sample File
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <p className="text-[13px] text-[#7a6b5c] mb-4">Map your CSV columns to the CRM fields.</p>
              {csvHeaders.length === 0 ? <p className="text-center text-[13px] text-gray-400 py-8">No headers detected. Go back and upload a valid CSV.</p> : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c]">CSV Column</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c]">CRM Field</span>
                  </div>
                  {csvHeaders.map((h) => (
                    <div key={h} className="grid grid-cols-2 gap-4 px-3 py-2 border border-gray-100 rounded-lg items-center">
                      <span className="text-[13px] text-[#1c1410] font-medium">{h}</span>
                      <select value={mapping[h] ?? ''} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:border-primary/40">
                        {CRM_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <p className="text-[13px] text-[#7a6b5c] mb-4">Preview — first {csvRows.length} rows of your data.</p>
              {csvRows.length === 0 ? <p className="text-center text-[13px] text-gray-400 py-8">No data rows to preview.</p> : (
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-[12px]">
                    <thead className="bg-gray-50"><tr>{csvHeaders.map((h) => <th key={h} className="px-3 py-2.5 text-left font-bold text-[#7a6b5c] whitespace-nowrap">{mapping[h] && mapping[h] !== '-- Skip --' ? mapping[h] : h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-gray-50">{csvRows.map((row, i) => <tr key={i} className="hover:bg-gray-50">{row.map((cell, j) => <td key={j} className="px-3 py-2.5 text-[#1c1410]">{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-extrabold text-[20px] text-[#1c1410]">Import Complete!</h3>
              <p className="text-[13px] text-[#7a6b5c]">Your opportunities have been imported successfully.</p>
              <div className="flex gap-8 mt-2">
                <div className="text-center"><p className="text-[28px] font-extrabold text-green-500">{importResult?.imported ?? allCsvRows.length}</p><p className="text-[12px] text-[#7a6b5c]">Records imported</p></div>
                <div className="text-center"><p className="text-[28px] font-extrabold text-red-400">{importResult?.errors?.length ?? 0}</p><p className="text-[12px] text-[#7a6b5c]">Errors</p></div>
              </div>
              {(importResult?.errors?.length ?? 0) > 0 && (
                <div className="w-full max-h-32 overflow-y-auto text-[11px] text-red-600 space-y-1 border border-red-100 rounded-lg p-3">
                  {importResult!.errors.slice(0, 10).map((e) => <div key={e.row}>Row {e.row}: {e.reason}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/5 shrink-0">
          {step > 1 && step < 4 && (
            <button onClick={() => setStep((s) => s - 1)} className="px-5 py-2 rounded-xl border border-gray-200 text-[13px] font-semibold text-[#7a6b5c] hover:bg-gray-50 transition-colors">Back</button>
          )}
          {step < 4
            ? <button onClick={next} disabled={importing} className="px-6 py-2 rounded-xl text-[13px] font-bold text-white hover:-translate-y-0.5 transition-all disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.3)' }}>{importing ? 'Importing…' : 'Next'}</button>
            : <button onClick={onClose} className="px-6 py-2 rounded-xl text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)' }}>Done</button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Note Modal ────────────────────────────────────────────────────────────────
function NoteModal({ leadId, onClose, onCreated }: { leadId: string; onClose: () => void; onCreated?: (note: any) => void }) {
  const { addNote } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 placeholder:text-gray-300';
  const submit = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!content.trim()) { toast.error('Note content is required'); return; }
    setSaving(true);
    try {
      const created = await api.post<any>(`/api/leads/${leadId}/notes`, { title: title.trim(), content: content.trim() });
      addNote({ id: created.id, leadId, content: `[${title.trim()}] ${content.trim()}`, createdBy: currentUser?.id ?? '', createdAt: created.created_at ?? new Date().toISOString() });
      onCreated?.(created);
      toast.success('Note added');
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
          <h3 className="font-headline font-bold text-[#1c1410] text-[17px]">Add Note</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#7a6b5c]"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[#7a6b5c] mb-1.5 block">Title <span className="text-red-400">*</span></label>
            <input className={inputCls} placeholder="e.g. Follow-up call" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#7a6b5c] mb-1.5 block">Description <span className="text-red-400">*</span></label>
            <textarea className={inputCls + ' resize-none min-h-[100px]'} placeholder="Write your note..." value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/5">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-[#7a6b5c] hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-6 py-2 rounded-xl text-[13px] font-bold text-white hover:-translate-y-0.5 transition-all disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.3)' }}>{saving ? 'Saving…' : 'Save Note'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Follow-Up Modal ───────────────────────────────────────────────────────────
function FollowUpModal({ leadId, onClose, onCreated }: { leadId: string; onClose: () => void; onCreated?: (fu: any) => void }) {
  const { addFollowUp } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);
  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 placeholder:text-gray-300';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const created = await api.post<any>(`/api/leads/${leadId}/followups`, {
        title: title.trim(),
        description: notes.trim() || undefined,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        assigned_to: currentUser?.id,
      });
      const fu = {
        id: created.id, leadId,
        dueAt: created.due_at,
        note: title.trim(),
        completed: false,
        assignedTo: currentUser?.id ?? '',
        createdAt: created.created_at ?? new Date().toISOString(),
      };
      addFollowUp(fu);
      onCreated?.(fu);
      toast.success('Follow-up scheduled');
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to schedule follow-up');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
          <h3 className="font-headline font-bold text-[#1c1410] text-[17px]">Set Follow-Up</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#7a6b5c]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Title <span className="text-red-400">*</span></label>
            <input className={inputCls} placeholder="e.g. Call back for pre-sales pitch" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Notes</label>
            <textarea className={inputCls + ' resize-none h-20'} placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Due Date & Time</label>
            <input type="datetime-local" className={inputCls} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-[#7a6b5c] hover:bg-gray-100 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 rounded-xl text-[13px] font-bold text-white hover:-translate-y-0.5 transition-all disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.3)' }}>{saving ? 'Saving…' : 'Schedule'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { updateLead, staff } = useCrmStore();
  const [selected, setSelected] = useState(lead.assignedTo);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/leads/${lead.id}`, { assigned_to: selected || null });
      const name = staff.find((s) => s.id === selected)?.name ?? '';
      updateLead(lead.id, { assignedTo: selected, assignedName: name });
      toast.success(`Lead assigned to ${displayName}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to assign lead');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-black/5">
          <h3 className="font-semibold">Assign Lead</h3><button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-4 space-y-2">
          {staff.filter((s) => s.status === 'active').map((s) => (
            <button key={s.id} onClick={() => setSelected(s.id)} className={cn('w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left', selected === s.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-[#f5ede3]')}>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">{s.avatar}</div>
              <div><p className="text-sm font-medium">{s.name}</p><p className="text-[11px] text-[#7a6b5c] capitalize">{s.role}</p></div>
              {selected === s.id && <Check className="w-4 h-4 text-primary ml-auto" />}
            </button>
          ))}
          <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button><Button className="flex-1" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Assign'}</Button></div>
        </div>
      </div>
    </div>
  );
}

// ─── Opportunity Modal ─────────────────────────────────────────────────────────
function OpportunityModal({ leadId, onClose, onCreated }: { leadId: string; onClose: () => void; onCreated?: (opp: any) => void }) {
  const { addOpportunity } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [form, setForm] = useState({ title: '', value: '', probability: '50', expectedCloseDate: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.value) { toast.error('Title and value are required'); return; }
    setSaving(true);
    try {
      const created = await api.post<any>('/api/opportunities', {
        lead_id: leadId,
        title: form.title,
        value: Number(form.value),
        probability: Number(form.probability),
        expected_close_date: form.expectedCloseDate || undefined,
        assigned_to: currentUser?.id,
      });
      addOpportunity({ id: created.id, leadId, title: form.title, value: Number(form.value), status: 'open', probability: Number(form.probability), expectedCloseDate: form.expectedCloseDate, assignedTo: currentUser?.id ?? '', createdAt: created.created_at ?? new Date().toISOString() });
      toast.success('Opportunity created');
      onCreated?.(created);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create opportunity');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-black/5">
          <h3 className="font-semibold">Create Opportunity</h3><button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label><Input placeholder="e.g. Enterprise License" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Deal Value (₹) *</label><Input type="number" placeholder="250000" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Win Probability (%)</label><Input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></div>
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Expected Close Date</label><Input type="date" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} /></div>
          <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button></div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Lead Modal ─────────────────────────────────────────────────────────
function DeleteLeadModal({ lead, onClose, onDeleted }: { lead: Lead; onClose: () => void; onDeleted: () => void }) {
  const { updateLead } = useCrmStore();

  const handleConfirm = async () => {
    await api.patch(`/api/leads/${lead.id}`, { pipeline_id: null, stage_id: null });
    updateLead(lead.id, { pipeline: '', stage: '', stageId: '', pipelineId: '' } as any);
    toast.success('Removed from pipeline — contact data preserved');
    onDeleted();
  };

  return (
    <ConfirmModal
      title="Remove from Pipeline?"
      message={<><span className="font-semibold text-[#1c1410]">{lead.firstName} {lead.lastName}</span> will be removed from the pipeline. Their contact data, notes, and history will be kept.</>}
      confirmLabel="Yes, Remove"
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
}

// ─── Edit Lead Modal ───────────────────────────────────────────────────────────
function EditLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { updateLead, deleteLead, moveLeadStage, pipelines, calendarEvents, addNote, updateNote, deleteNote, addFollowUp, addCalendarEvent, bookingLinks } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  type Tab = 'opportunity' | 'additional' | 'followup' | 'notes' | 'appointments';
  const [activeTab, setActiveTab] = useState<Tab>('opportunity');
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  const [form, setForm] = useState({
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    stage: lead.stage,
    pipelineId: lead.pipelineId,
    source: lead.source,
    dealValue: lead.dealValue,
    tags: [...lead.tags],
    tagInput: '',
    city: '',
    // Additional Info
    businessName: '', gstNo: '', businessAddress: '', state: '', postalCode: '', pincode: '',
    // Follow-up
    fuTitle: '', fuDesc: '', fuDue: '',
    // Notes
    noteTitle: '', noteTag: '',
    // Appointments
    apptEvent: '', apptLocation: '', apptLink: '', apptDate: '', apptTz: 'Asia/Kolkata', apptSlot: '',
  });

  const [leadNotes, setLeadNotes] = useState<any[]>([]);
  const [leadFollowUps, setLeadFollowUps] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>(`/api/leads/${lead.id}/notes`).then(setLeadNotes).catch(() => null);
    api.get<any[]>(`/api/leads/${lead.id}/followups`).then((data) =>
      setLeadFollowUps(data.map((f) => ({ id: f.id, leadId: lead.id, dueAt: f.due_at, note: f.title, completed: f.completed, assignedTo: f.assigned_to, createdAt: f.created_at })))
    ).catch(() => null);
  }, [lead.id]);
  const leadEvents = calendarEvents?.filter((e) => e.leadName === `${lead.firstName} ${lead.lastName}`) ?? [];

  const handleUpdate = async () => {
    try {
      const pipeline = pipelines.find((p) => p.id === form.pipelineId);
      const stageId = pipeline?.stages.find((s) => s.name === form.stage)?.id;
      await api.patch(`/api/leads/${lead.id}`, {
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        source: form.source,
        pipeline_id: form.pipelineId || undefined,
        stage_id: stageId || undefined,
        tags: form.tags,
      });
      updateLead(lead.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        stage: form.stage,
        pipelineId: form.pipelineId,
        source: form.source,
        dealValue: Number(form.dealValue),
        tags: form.tags,
      });
      if (form.stage !== lead.stage) moveLeadStage(lead.id, form.stage);
      toast.success('Lead updated');
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update lead');
    }
  };


  const addTag = () => {
    const t = form.tagInput.trim();
    if (t && !form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t], tagInput: '' });
    else setForm({ ...form, tagInput: '' });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'opportunity', label: 'Opportunity' },
    { key: 'additional', label: 'Additional Info' },
    { key: 'followup', label: 'Follow-up' },
  ];

  const field = (label: string, child: React.ReactNode, required = false) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] text-[#7a6b5c]">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {child}
    </div>
  );

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-[#1c1410] bg-white outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-all placeholder:text-gray-300';
  const readonlyCls = 'w-full border border-gray-100 rounded-lg px-3 py-2.5 text-[13px] text-gray-400 bg-gray-50 outline-none cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[88vh]" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-[11px] text-gray-400 mb-0.5">+ Add opportunity</p>
            <h3 className="text-[15px] font-bold text-[#1c1410]">
              Contact Info (Edit) <span className="font-normal text-gray-400 mx-1">|</span> Contact Type: <span className="text-primary">Lead</span>
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all',
                activeTab === t.key
                  ? 'bg-[#1c1410] text-white'
                  : 'text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-[#1c1410]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">

          {activeTab === 'opportunity' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {field('Opportunity Name', <input className={inputCls} value={`${form.firstName} ${form.lastName}`} onChange={(e) => { const [f, ...l] = e.target.value.split(' '); setForm({ ...form, firstName: f, lastName: l.join(' ') }); }} />, true)}
              {field('Contact Name', <input className={readonlyCls} value={`${form.firstName} ${form.lastName}`} readOnly />, true)}
              {field('Email', <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />)}
              {field('Phone', <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />)}
              {field('City', <input className={inputCls} placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />)}
              {field('Pipeline', (
                <select className={inputCls} value={form.pipelineId} onChange={(e) => {
                  const newPipeline = pipelines.find((p) => p.id === e.target.value);
                  const firstStage = newPipeline?.stages[0]?.name ?? '';
                  setForm({ ...form, pipelineId: e.target.value, stage: firstStage });
                }}>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ), true)}
              {field('Stage', (
                <select className={inputCls} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                  {(pipelines.find((p) => p.id === form.pipelineId)?.stages ?? []).map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              ), true)}
              {field('Created At', <input className={readonlyCls} type="datetime-local" defaultValue={format(new Date(lead.createdAt), "yyyy-MM-dd'T'HH:mm")} readOnly />)}
              {field('Updated At', <input className={readonlyCls} type="datetime-local" defaultValue={format(new Date(lead.lastActivity), "yyyy-MM-dd'T'HH:mm")} readOnly />)}
              {field('Tags', (
                <div className="border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-300 transition-all">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {form.tags.map((tag) => (
                      <span key={tag} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                        {tag}
                        <button onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })} className="hover:text-red-500 ml-0.5 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    className="w-full text-[13px] text-[#1c1410] outline-none bg-transparent placeholder:text-gray-300"
                    placeholder="Type & press Enter to add tags"
                    value={form.tagInput}
                    onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  />
                </div>
              ))}
              {field('Type', (
                <select className={inputCls}>
                  <option>Lead</option>
                  <option>Contact</option>
                </select>
              ))}
              {field('Lead Value', <input className={inputCls} type="number" value={form.dealValue} onChange={(e) => setForm({ ...form, dealValue: Number(e.target.value) })} />)}
            </div>
          )}

          {/* ── Additional Info ── */}
          {activeTab === 'additional' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                {field('First Name', <input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />, true)}
                {field('Last Name', <input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />)}
                {field('Email', <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />, true)}
                {field('Phone', <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />, true)}
                {field('Contact Type', (
                  <select className={inputCls}>
                    <option>Lead</option>
                    <option>Contact</option>
                    <option>Customer</option>
                  </select>
                ))}
                {field('Business Name', <input className={inputCls} placeholder="Business name" value={form.businessName ?? ''} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />)}
                {field('GST No', <input className={inputCls} placeholder="GST number" value={form.gstNo ?? ''} onChange={(e) => setForm({ ...form, gstNo: e.target.value })} />)}
                {field('State', <input className={inputCls} placeholder="State" value={form.state ?? ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />)}
              </div>
              {field('Business Address', <input className={inputCls} placeholder="Business address" value={form.businessAddress ?? ''} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} />)}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                {field('Postal Code', <input className={inputCls} placeholder="Postal code" value={form.postalCode ?? ''} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />)}
                {field('Pincode', <input className={inputCls} placeholder="Pincode" value={form.pincode ?? ''} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />)}
              </div>
            </div>
          )}

          {/* ── Follow-up ── */}
          {activeTab === 'followup' && (
            <div className="flex gap-8">
              {/* Left: add form */}
              <div className="w-64 shrink-0 space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-100 self-start">
                <p className="text-[13px] font-bold text-[#1c1410] mb-1">Add Follow-Up</p>
                <div>
                  <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Title <span className="text-red-400">*</span></label>
                  <input className={inputCls} placeholder="Enter follow-up title" value={form.fuTitle ?? ''} onChange={(e) => setForm({ ...form, fuTitle: e.target.value })} />
                </div>
                <div>
                  <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Notes</label>
                  <textarea className={inputCls + ' resize-none h-20'} placeholder="Add any notes..." value={form.fuDesc ?? ''} onChange={(e) => setForm({ ...form, fuDesc: e.target.value })} />
                </div>
                <div>
                  <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Due Date <span className="text-red-400">*</span></label>
                  <input className={inputCls} type="datetime-local" value={form.fuDue ?? ''} onChange={(e) => setForm({ ...form, fuDue: e.target.value })} />
                </div>
                <button
                  onClick={async () => {
                    if (!form.fuTitle?.trim() || !form.fuDue) { toast.error('Title and due date required'); return; }
                    try {
                      const created = await api.post<any>(`/api/leads/${lead.id}/followups`, {
                        title: form.fuTitle.trim(),
                        description: form.fuDesc?.trim() || undefined,
                        due_at: new Date(form.fuDue).toISOString(),
                        assigned_to: currentUser?.id,
                      });
                      const fu = { id: created.id, leadId: lead.id, dueAt: created.due_at, note: form.fuTitle.trim(), completed: false, assignedTo: currentUser?.id ?? '', createdAt: created.created_at };
                      addFollowUp(fu);
                      setLeadFollowUps((prev) => [...prev, fu]);
                      toast.success('Follow-up added');
                      setForm({ ...form, fuTitle: '', fuDesc: '', fuDue: '' });
                    } catch (err: any) { toast.error(err.message ?? 'Failed to add follow-up'); }
                  }}
                  className="w-full py-2 rounded-xl text-white text-[13px] font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}
                >ADD</button>
              </div>

              {/* Right: existing list */}
              <div className="flex-1 min-w-0">
                <h4 className="font-headline font-bold text-[#1c1410] text-[15px] mb-3">Follow-up Tasks</h4>
                {leadFollowUps.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-[#faf0e8] flex items-center justify-center mb-2">
                      <CheckSquare className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-[13px] text-[#7a6b5c]">No follow-ups yet.</p>
                  </div>
                )}
                <div className="space-y-2">
                  {leadFollowUps.map((f) => {
                    const isOverdue = !f.completed && isPast(new Date(f.dueAt));
                    const isDone = f.completed;
                    const isPending = !f.completed && !isOverdue;

                    const cardCls = isDone
                      ? 'bg-emerald-50 border-emerald-200'
                      : isOverdue
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200';

                    const dotCls = isDone ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-amber-400';

                    const badge = isDone
                      ? { label: 'Done', cls: 'bg-emerald-100 text-emerald-700' }
                      : isOverdue
                      ? { label: 'Overdue', cls: 'bg-red-100 text-red-600' }
                      : { label: 'Pending', cls: 'bg-amber-100 text-amber-700' };

                    return (
                      <div key={f.id} className={cn('p-3 rounded-xl border', cardCls)}>
                        <div className="flex items-start gap-2">
                          <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', dotCls)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-semibold text-[#1c1410] truncate">{f.note || 'Follow-up'}</p>
                              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', badge.cls)}>{badge.label}</span>
                            </div>
                            <p className="text-[11px] text-[#7a6b5c] mt-0.5">Due: {format(new Date(f.dueAt), 'dd MMM yyyy, h:mm a')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}


          {/* ── Appointments ── */}
          {activeTab === 'appointments' && (() => {
            const apptET = bookingLinks.find((b) => b.id === (form.apptEvent ?? '')) as any | undefined;
            const apptSlots = apptET && form.apptDate ? genSlots(apptET.schedule ?? {}, form.apptDate, apptET.duration ?? 30) : [];
            return (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                <div className="sm:col-span-2">
                  <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Calendar Event <span className="text-red-400">*</span></label>
                  <select className={inputCls} value={form.apptEvent ?? ''} onChange={(e) => {
                    const et = bookingLinks.find((b) => b.id === e.target.value) as any | undefined;
                    setForm({ ...form, apptEvent: e.target.value, apptLink: et?.meetingLink ?? '', apptSlot: '' });
                  }}>
                    <option value="">Select Event</option>
                    {bookingLinks.filter((b) => (b as any).isActive !== false).map((b) => (
                      <option key={b.id} value={b.id}>{(b as any).name ?? b.title}</option>
                    ))}
                  </select>
                </div>

                {form.apptEvent && (<>
                  <div>
                    <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Meeting Type</label>
                    <input className="w-full border border-gray-100 rounded-lg px-3 py-2 text-[13px] text-[#7a6b5c] bg-gray-50 outline-none" value={apptET?.meetingType || '—'} readOnly />
                  </div>
                  <div>
                    <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Meeting Link / Address</label>
                    <input className={inputCls} placeholder="Meeting link or address" value={form.apptLink ?? ''} onChange={(e) => setForm({ ...form, apptLink: e.target.value })} />
                  </div>
                </>)}

                <div>
                  <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Event Date <span className="text-red-400">*</span></label>
                  <input className={inputCls} type="date" value={form.apptDate ?? ''} onChange={(e) => setForm({ ...form, apptDate: e.target.value, apptSlot: '' })} />
                </div>

                <div>
                  <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Timezone</label>
                  <select className={inputCls} value={form.apptTz ?? 'Asia/Kolkata'} onChange={(e) => setForm({ ...form, apptTz: e.target.value })}>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">Timeslot <span className="text-red-400">*</span></label>
                  <select className={inputCls} value={form.apptSlot ?? ''} onChange={(e) => setForm({ ...form, apptSlot: e.target.value })} disabled={!form.apptEvent || !form.apptDate}>
                    <option value="">{!form.apptEvent ? 'Select a calendar first' : !form.apptDate ? 'Select a date first' : apptSlots.length === 0 ? 'No slots available this day' : 'Pick a timeslot'}</option>
                    {apptSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    if (!form.apptEvent || !form.apptDate || !form.apptSlot) { toast.error('Please fill all required fields'); return; }
                    const bookingName = apptET?.name ?? 'Appointment';
                    const slotParts = (form.apptSlot as string).split(' ');
                    const [hhStr, mmStr] = slotParts[0].split(':');
                    let hh = parseInt(hhStr, 10);
                    const mm = parseInt(mmStr, 10);
                    if (slotParts[1] === 'PM' && hh !== 12) hh += 12;
                    else if (slotParts[1] === 'AM' && hh === 12) hh = 0;
                    const time24 = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                    const startIso = `${form.apptDate}T${time24}:00`;
                    const endDate = new Date(startIso);
                    endDate.setMinutes(endDate.getMinutes() + (apptET?.duration ?? 30));
                    try {
                      const created = await api.post<any>('/api/calendar', {
                        title: `${bookingName} - ${lead.firstName} ${lead.lastName}`,
                        type: apptET?.eventType ?? 'meeting',
                        start_time: startIso,
                        end_time: endDate.toISOString(),
                        lead_id: lead.id,
                        assigned_to: lead.assignedTo || undefined,
                        event_type_id: form.apptEvent,
                        meeting_link: form.apptLink || undefined,
                      });
                      addCalendarEvent({
                        id: created.id,
                        title: `${bookingName} - ${lead.firstName} ${lead.lastName}`,
                        type: (apptET?.eventType as 'meeting' | 'demo' | 'call') ?? 'meeting',
                        leadName: `${lead.firstName} ${lead.lastName}`,
                        assignedTo: lead.assignedTo,
                        date: form.apptDate as string,
                        time: time24,
                        duration: apptET?.duration ?? 30,
                        status: 'scheduled',
                        meetingLink: form.apptLink,
                      });
                      toast.success('Appointment booked');
                      setForm({ ...form, apptEvent: '', apptDate: '', apptSlot: '', apptLink: '', apptLocation: '' });
                    } catch (err: any) {
                      toast.error(err.message ?? 'Failed to book appointment');
                    }
                  }}
                  className="px-8 py-2 rounded-xl text-white text-[13px] font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}
                >Book Appointment</button>
              </div>

              {/* Existing appointments */}
              {leadEvents.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-black/5">
                  <p className="text-[12px] font-semibold text-[#7a6b5c]">Existing Appointments</p>
                  {leadEvents.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#faf8f6] border border-black/5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[#1c1410]">{ev.title}</p>
                        <p className="text-[11px] text-[#7a6b5c]">{ev.date} · {ev.time} · {ev.duration} min</p>
                      </div>
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-md', ev.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : ev.status === 'no-show' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600')}>{ev.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">
            Created On: {format(new Date(lead.createdAt), 'dd/MM/yyyy hh:mm aa')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-5 py-2 rounded-lg text-[13px] font-bold text-red-500 border border-red-200 hover:bg-red-50 transition-all"
            >DELETE</button>
            <button
              onClick={handleUpdate}
              className="px-5 py-2 rounded-lg text-[13px] font-bold text-white bg-[#1c1410] hover:bg-[#2d1f18] transition-all"
            >UPDATE</button>
          </div>
        </div>
      </div>
      {showDeleteModal && (
        <DeleteLeadModal lead={lead} onClose={() => setShowDeleteModal(false)} onDeleted={onClose} />
      )}
    </div>
  );
}

// ─── Additional Info Section (pipeline questionnaire) ──────────────────────────
function AdditionalInfoSection({ lead, onUpdate }: { lead: Lead; onUpdate: (fields: { label: string; value: string }[]) => void }) {
  const { additionalFields } = useCrmStore();
  // Include the lead's pipeline-specific questions + global questions (pipelineId === 'all')
  const pipelineQuestions = additionalFields.filter((q) => q.pipelineId === lead.pipelineId || q.pipelineId === 'all');

  // Build answer map from lead.customFields (label -> value)
  const existingAnswers: Record<string, string> = {};
  (lead.customFields ?? []).forEach((f) => { existingAnswers[f.label] = f.value; });

  const [answers, setAnswers] = useState<Record<string, string>>(existingAnswers);

  const saveAnswer = (fieldId: string, question: string, value: string) => {
    const next = { ...answers, [question]: value };
    setAnswers(next);
    const fieldList = Object.entries(next)
      .filter(([, v]) => v !== '')
      .map(([label, val]) => ({ label, value: val }));
    onUpdate(fieldList);
    // Persist to API
    if (fieldId) {
      api.patch(`/api/leads/${lead.id}/fields`, { values: [{ field_id: fieldId, value }] }).catch(() => null);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 bg-white';

  // Empty state — no questions configured for this pipeline
  if (pipelineQuestions.length === 0) {
    return (
      <div className="px-5 py-4 border-b border-black/5">
        <h4 className="text-[11px] font-bold text-[#7a6b5c] uppercase tracking-wider mb-2">Additional Info</h4>
        <p className="text-[12px] text-[#b09e8d] italic">
          No questions configured for this pipeline.{' '}
          <a href="/fields" className="text-primary font-semibold hover:underline">Set them up in Fields → Additional Fields</a>
        </p>
      </div>
    );
  }

  const filledCount = pipelineQuestions.filter((q) => answers[q.question] && answers[q.question].trim() !== '').length;

  return (
    <div className="px-5 py-4 border-b border-black/5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold text-[#7a6b5c] uppercase tracking-wider">
          Additional Info
          <span className="text-[#b09e8d] font-normal ml-1">· {filledCount}/{pipelineQuestions.length} filled</span>
        </h4>
      </div>

      <div className="space-y-3">
        {pipelineQuestions.map((q) => {
          const value = answers[q.question] ?? '';
          const filled = value.trim() !== '';
          return (
            <div key={q.id}>
              <label className="text-[12px] font-semibold text-[#1c1410] mb-1 flex items-center gap-1">
                {q.question}
                {q.required && <span className="text-red-500">*</span>}
                {filled && <Check className="w-3 h-3 text-green-500 ml-auto" />}
              </label>

              {/* Render input based on type */}
              {q.type === 'Multi Line' && (
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 bg-white resize-none"
                  rows={2}
                  placeholder="Type answer..."
                  value={value}
                  onChange={(e) => saveAnswer(q.id, q.question, e.target.value)}
                />
              )}
              {q.type === 'Dropdown' && (
                <select className={inputCls} value={value} onChange={(e) => saveAnswer(q.id, q.question, e.target.value)}>
                  <option value="">Choose...</option>
                  {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {q.type === 'Multi-select' && (
                <div className="flex flex-wrap gap-1.5">
                  {(q.options ?? []).map((o) => {
                    const selected = value.split(',').map((x) => x.trim()).includes(o);
                    return (
                      <button
                        key={o}
                        onClick={() => {
                          const current = value ? value.split(',').map((x) => x.trim()) : [];
                          const next = selected ? current.filter((x) => x !== o) : [...current, o];
                          saveAnswer(q.id, q.question, next.join(', '));
                        }}
                        className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                          selected ? 'bg-primary text-white border-primary' : 'bg-white text-[#7a6b5c] border-black/10 hover:border-primary/30')}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              )}
              {q.type === 'Radio' && (
                <div className="space-y-1.5">
                  {(q.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`radio-${q.id}`}
                        checked={value === o}
                        onChange={() => saveAnswer(q.id, q.question, o)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-[13px] text-[#1c1410]">{o}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'Multi-Checkbox' && (
                <div className="space-y-1.5">
                  {(q.options ?? []).map((o) => {
                    const selected = value.split(',').map((x) => x.trim()).includes(o);
                    return (
                      <label key={o} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const current = value ? value.split(',').map((x) => x.trim()).filter(Boolean) : [];
                            const next = selected ? current.filter((x) => x !== o) : [...current, o];
                            saveAnswer(q.id, q.question, next.join(', '));
                          }}
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-[13px] text-[#1c1410]">{o}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {q.type === 'Checkbox' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={value === 'true'} onChange={(e) => saveAnswer(q.id, q.question, e.target.checked ? 'true' : 'false')} className="w-4 h-4 accent-primary" />
                  <span className="text-[13px] text-[#1c1410]">Yes</span>
                </label>
              )}
              {q.type === 'Date' && (
                <input className={inputCls} type="date" value={value} onChange={(e) => saveAnswer(q.id, q.question, e.target.value)} />
              )}
              {q.type === 'Number' && (
                <input className={inputCls} type="number" placeholder="0" value={value} onChange={(e) => saveAnswer(q.id, q.question, e.target.value)} />
              )}
              {q.type === 'Monetary' && (
                <input className={inputCls} type="number" placeholder="₹" value={value} onChange={(e) => saveAnswer(q.id, q.question, e.target.value)} />
              )}
              {q.type === 'Phone' && (
                <input className={inputCls} type="tel" placeholder="+91" value={value} onChange={(e) => saveAnswer(q.id, q.question, e.target.value)} />
              )}
              {q.type === 'Email' && (
                <input className={inputCls} type="email" placeholder="name@example.com" value={value} onChange={(e) => saveAnswer(q.id, q.question, e.target.value)} />
              )}
              {q.type === 'URL' && (
                <input className={inputCls} type="url" placeholder="https://" value={value} onChange={(e) => saveAnswer(q.id, q.question, e.target.value)} />
              )}
              {/* Default: Single Line + File Upload (text for now) */}
              {(q.type === 'Single Line' || q.type === 'File Upload') && (
                <input className={inputCls} placeholder="Type answer..." value={value} onChange={(e) => saveAnswer(q.id, q.question, e.target.value)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lead Detail Panel ─────────────────────────────────────────────────────────
function LeadDetailPanel({ lead, onClose, onLeadUpdated }: {
  lead: Lead;
  onClose: () => void;
  onLeadUpdated?: (id: string, updates: { pipelineId: string; stage: string; stageId: string | undefined; tags: string[] }) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showFuModal, setShowFuModal] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  // Real API data for this lead
  const [leadNotes, setLeadNotes] = useState<any[]>([]);
  const [leadFollowUps, setLeadFollowUps] = useState<any[]>([]);
  const [leadActivities, setLeadActivities] = useState<any[]>([]);

  const { calendarEvents, updateLead, deleteLead, addActivity, pipelines, tags: storeTags, staff, bookingLinks, addCalendarEvent } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const canEditLead   = usePermission('leads:edit');
  const canDeleteLead = usePermission('leads:delete');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);

  useEffect(() => {
    api.get<any[]>(`/api/leads/${lead.id}/notes`).then(setLeadNotes).catch(() => null);
    api.get<any[]>(`/api/leads/${lead.id}/followups`).then((data) =>
      setLeadFollowUps(data.map((f) => ({ id: f.id, leadId: lead.id, dueAt: f.due_at, note: f.title, completed: f.completed, assignedTo: f.assigned_to, createdAt: f.created_at })))
    ).catch(() => null);
    api.get<any[]>(`/api/leads/${lead.id}/activities`).then((data) =>
      setLeadActivities(data.map((a) => ({ id: a.id, leadId: lead.id, type: a.type, title: a.title, detail: a.detail, timestamp: a.created_at, createdBy: a.created_by_name ?? a.created_by })))
    ).catch(() => null);
    // Load persisted custom field values
    api.get<any[]>(`/api/leads/${lead.id}/fields`).then((rows) => {
      const customFields = rows.map((r) => ({ label: r.field_name ?? r.slug, value: r.value, fieldId: r.field_id }));
      updateLead(lead.id, { customFields });
    }).catch(() => null);
  }, [lead.id]);

  // Option B: re-fetch activities whenever this lead is updated (from any source/window)
  useEffect(() => {
    const socket = getSocket();
    const onLeadUpdated = (updated: any) => {
      if (updated.id !== lead.id) return;
      api.get<any[]>(`/api/leads/${lead.id}/activities`).then((data) =>
        setLeadActivities(data.map((a) => ({
          id: a.id, leadId: lead.id, type: a.type, title: a.title,
          detail: a.detail, timestamp: a.created_at,
          createdBy: a.created_by_name ?? a.created_by,
        })))
      ).catch(() => null);
    };
    socket.on('lead:updated', onLeadUpdated);
    return () => { socket.off('lead:updated', onLeadUpdated); };
  }, [lead.id]);

  const assignedStaff = staff.find((s) => s.id === lead.assignedTo);
  const assignedDisplayName = assignedStaff?.name || lead.assignedName || '';
  const pipelineName = pipelines.find((p) => p.id === lead.pipelineId)?.name ?? lead.pipelineId;

  const leadAppointments = calendarEvents.filter((e) => e.leadName === `${lead.firstName} ${lead.lastName}`.trim());

  // Edit form state
  const [editForm, setEditForm] = useState({
    firstName: lead.firstName, lastName: lead.lastName,
    phone: lead.phone, email: lead.email,
    dealValue: lead.dealValue, source: lead.source,
    assignedTo: lead.assignedTo ?? '',
    tags: [...lead.tags], tagInput: '',
  });

  const handleSaveEdit = async () => {
    try {
      const pipeline = pipelines.find((p) => p.id === lead.pipelineId);
      const stageId = pipeline?.stages.find((s) => s.name === lead.stage)?.id;
      await api.patch(`/api/leads/${lead.id}`, {
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        email: editForm.email,
        phone: editForm.phone,
        stage_id: stageId || undefined,
        assigned_to: editForm.assignedTo || null,
        tags: editForm.tags,
        deal_value: editForm.dealValue !== undefined ? Number(editForm.dealValue) : undefined,
      });
      updateLead(lead.id, {
        firstName: editForm.firstName, lastName: editForm.lastName,
        phone: editForm.phone, email: editForm.email,
        dealValue: Number(editForm.dealValue),
        assignedTo: editForm.assignedTo,
        assignedName: staff.find((s) => s.id === editForm.assignedTo)?.name ?? '',
        tags: editForm.tags,
      });
      setEditMode(false);
      toast.success('Lead updated');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update lead');
    }
  };

  const logActivity = (type: LeadActivity['type'], title: string, detail?: string) => {
    const act = {
      id: `act-${Date.now()}`, leadId: lead.id, type, title, detail,
      timestamp: new Date().toISOString(), createdBy: currentUser?.id ?? '',
    };
    addActivity(act);
    setLeadActivities((prev) => [act, ...prev]);
  };

  const handleCall = () => {
    logActivity('call', 'Called', lead.phone);
    window.open(`tel:${lead.phone}`);
  };

  const handleWhatsApp = () => {
    logActivity('whatsapp', 'WhatsApp', lead.phone);
    window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank');
  };

  const cleanActivityTitle = (t: string) => t
    .replace(/^Lead added\/updated in CRM and verified\s*→\s*stage:\s*/i, 'Added to CRM · ')
    .replace(/^Tags added and verified:\s*/i, 'Tags added: ')
    .replace(/^Tags removed and verified:\s*/i, 'Tags removed: ')
    .replace(/^Assigned and verified:\s*/i, 'Assigned: ')
    .replace(/^Staff assignment removed and verified$/i, 'Staff unassigned')
    .replace(/^Lead quality set and verified:\s*/i, 'Quality: ')
    .replace(/^Attributes updated and verified:\s*/i, 'Updated: ')
    .replace(/^Lead soft-deleted and verified$/i, 'Lead removed')
    .replace(/^Note created and verified:\s*/i, 'Note: ')
    .replace(/^Follow-up created and verified:\s*/i, 'Follow-up: ')
    .replace(/^Notification sent and verified:\s*/i, 'Notified: ')
    .replace(/^Appointment status changed and verified:\s*/i, 'Appointment: ')
    .replace(/^Stage changed and verified:\s*/i, 'Moved to ')
    .replace(/^Stage changed to\s+/i, 'Moved to ')
    .replace(/^Stage →\s*/i, 'Moved to ');

  // Build timeline from all sources
  type TimelineEntry = { id: string; type: LeadActivity['type']; title: string; detail?: string; timestamp: string; createdBy?: string };
  const timeline: TimelineEntry[] = [
    { id: 'created', type: 'created', title: `Joined · ${pipelineName}`, detail: getSourceLabel(lead), timestamp: lead.createdAt },
    ...leadActivities.map((a) => ({ id: a.id, type: a.type, title: cleanActivityTitle(a.title), detail: a.detail, timestamp: a.timestamp, createdBy: a.createdBy })),
    ...leadNotes.map((n) => ({ id: `note-${n.id}`, type: 'note' as const, title: 'Note', detail: n.content, timestamp: n.created_at, createdBy: n.created_by_name ?? n.created_by })),
    ...leadAppointments.map((a) => ({
      id: `appt-${a.id}`, type: 'appointment' as const,
      title: a.title.split(' - ')[0],
      detail: `${format(new Date(a.date), 'dd MMM yyyy')} · ${a.time}`,
      timestamp: a.date,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const iconForType = (type: LeadActivity['type']) => {
    switch (type) {
      case 'call': return { Icon: Phone, bg: 'bg-orange-100', color: 'text-primary' };
      case 'whatsapp': return { Icon: MessageCircle, bg: 'bg-emerald-100', color: 'text-emerald-600' };
      case 'email': return { Icon: Mail, bg: 'bg-blue-100', color: 'text-blue-600' };
      case 'note': return { Icon: FileText, bg: 'bg-purple-100', color: 'text-purple-600' };
      case 'followup': return { Icon: Clock, bg: 'bg-amber-100', color: 'text-amber-600' };
      case 'appointment': return { Icon: Calendar, bg: 'bg-indigo-100', color: 'text-indigo-600' };
      case 'stage_change': return { Icon: ArrowLeftRight, bg: 'bg-slate-100', color: 'text-slate-600' };
      case 'tag_added': return { Icon: Tag, bg: 'bg-pink-100', color: 'text-pink-600' };
      case 'assigned': return { Icon: UserCheck, bg: 'bg-teal-100', color: 'text-teal-600' };
      case 'created': return { Icon: UserPlus, bg: 'bg-orange-100', color: 'text-primary' };
      default: return { Icon: Circle, bg: 'bg-gray-100', color: 'text-gray-500' };
    }
  };

  const timestampLabel = (ts: string) => {
    const d = new Date(ts);
    const today = new Date();
    const yday = new Date(today); yday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return `Today, ${format(d, 'h:mm a')}`;
    if (d.toDateString() === yday.toDateString()) return `Yesterday, ${format(d, 'h:mm a')}`;
    return format(d, 'MMM d, h:mm a');
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 bg-white';

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backdropFilter: 'blur(3px)', backgroundColor: 'rgba(0,0,0,0.25)' }} onClick={onClose}>
    <div className="w-full max-w-[480px] bg-white h-full flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

      {/* Header */}
      <div className="px-5 py-4 border-b border-black/5 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[17px] text-[#1c1410]">Lead Details</h2>
          <div className="flex items-center gap-1">
            {lead.source && (
              <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', getSourceColor(lead.source))}>
                {getSourceLabel(lead)}
              </span>
            )}
            {!editMode && canEditLead && (
              <button onClick={() => setEditMode(true)} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-primary transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {canDeleteLead && (
              <button onClick={() => setShowDeleteModal(true)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#c4b09e] hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {showDeleteModal && (
              <DeleteLeadModal lead={lead} onClose={() => setShowDeleteModal(false)} onDeleted={onClose} />
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-[#f5ede3] rounded-lg transition-colors">
              <X className="w-5 h-5 text-[#7a6b5c]" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* Profile */}
        {!editMode ? (
          <div className="px-5 py-5 border-b border-black/5">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[16px] shrink-0" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>
                {lead.firstName[0]}{lead.lastName?.[0] ?? ''}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[17px] text-[#1c1410] leading-tight">{lead.firstName} {lead.lastName}</h3>
                <p className="text-[13px] text-[#7a6b5c] mt-0.5">Deal value: <span className="font-semibold text-[#1c1410]">₹{lead.dealValue.toLocaleString()}</span></p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { Icon: User, value: `${lead.firstName} ${lead.lastName}` },
                { Icon: Phone, value: lead.phone },
                { Icon: Mail, value: lead.email || '—' },
                { Icon: Layers, value: lead.stage ? `${lead.stage} · ${pipelineName}` : pipelineName },
                { Icon: UserCheck, value: assignedDisplayName ? `Assigned to ${assignedDisplayName}` : 'Unassigned' },
                { Icon: Tag, value: getSourceLabel(lead) },
              ].map(({ Icon, value }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-[#7a6b5c] shrink-0" />
                  <span className="text-[13px] text-[#1c1410] font-medium flex-1 break-words">{value}</span>
                </div>
              ))}

              {/* Last Follow Up */}
              {(() => {
                const last = leadFollowUps
                  .filter((f) => f.dueAt)
                  .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime())[0];
                if (!last) return null;
                return (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-[#7a6b5c] shrink-0" />
                    <span className="text-[13px] text-[#1c1410] font-medium">
                      Last Follow Up:{' '}
                      <span className="text-[#1c1410]">{format(new Date(last.dueAt), 'dd MMM yyyy')}</span>
                      <span className="text-[#7a6b5c] ml-1">({formatDistanceToNow(new Date(last.dueAt), { addSuffix: true })})</span>
                    </span>
                  </div>
                );
              })()}

              {/* Tags */}
              {lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {lead.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-[#c2410c] border border-orange-100">
                      <Tag className="w-2.5 h-2.5" />{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Additional custom fields — collapsed by default */}
              {lead.customFields && lead.customFields.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowCustomFields((v) => !v)}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-[#c2410c] transition-colors"
                  >
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${showCustomFields ? 'rotate-90' : ''}`} />
                    Additional Fields ({lead.customFields.length})
                  </button>
                  {showCustomFields && (
                    <div className="mt-2 space-y-2 pl-1">
                      {lead.customFields.map((f, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <FileText className="w-4 h-4 text-[#7a6b5c] shrink-0 mt-0.5" />
                          <span className="text-[13px] text-[#1c1410] font-medium flex-1 break-words">
                            <span className="text-[#7a6b5c]">{f.label}:</span> {f.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="pt-1 border-t border-black/5 mt-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#7a6b5c]">Created at</span>
                  <span className="text-[11px] font-medium text-[#1c1410]">{format(new Date(lead.createdAt), 'dd MMM yyyy, hh:mm:ss a')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#7a6b5c]">Updated at</span>
                  <span className="text-[11px] font-medium text-[#1c1410]">{format(new Date(lead.lastActivity), 'dd MMM yyyy, hh:mm:ss a')}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* EDIT MODE — sectioned structure */
          <div className="border-b border-black/5">

            {/* ═══ CONTACT SECTION ═══ */}
            <div className="px-5 py-4 border-b border-black/[0.05]">
              <h4 className="text-[11px] font-bold text-[#7a6b5c] uppercase tracking-wider mb-3">Contact</h4>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-[#7a6b5c] mb-1 block font-medium">First name</label>
                    <input className={inputCls} value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#7a6b5c] mb-1 block font-medium">Last name</label>
                    <input className={inputCls} value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#7a6b5c] mb-1 block font-medium">Phone</label>
                  <input className={inputCls} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>

                <div>
                  <label className="text-[11px] text-[#7a6b5c] mb-1 block font-medium">Email</label>
                  <input className={inputCls} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-[#7a6b5c] mb-1 block font-medium">Deal value (₹)</label>
                    <input className={inputCls} type="number" value={editForm.dealValue} onChange={(e) => setEditForm({ ...editForm, dealValue: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#7a6b5c] mb-1 block font-medium">Source</label>
                    <div className={inputCls + ' bg-gray-50 text-[#7a6b5c] cursor-default select-none'}>
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', getSourceColor(lead.source))}>
                        {getSourceLabel(lead)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#7a6b5c] mb-1 block font-medium">Assigned to</label>
                  <select className={inputCls} value={editForm.assignedTo} onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-[11px] text-[#7a6b5c] mb-1.5 block font-medium">Tags</label>
                  {editForm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {editForm.tags.map((t) => (
                        <span key={t} className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold', TAG_COLORS[t] ?? 'bg-gray-100 text-gray-600')}>
                          {t}
                          <button onClick={() => setEditForm({ ...editForm, tags: editForm.tags.filter((x) => x !== t) })}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-[12px] text-[#1c1410] outline-none focus:border-primary/40 bg-[#faf8f6] placeholder:text-gray-400"
                      placeholder="Add tag..."
                      value={editForm.tagInput}
                      onChange={(e) => setEditForm({ ...editForm, tagInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = editForm.tagInput.trim();
                          if (v && !editForm.tags.includes(v)) setEditForm({ ...editForm, tags: [...editForm.tags, v], tagInput: '' });
                        }
                      }}
                      list="tag-edit-sugg"
                    />
                    <datalist id="tag-edit-sugg">{storeTags.map((t) => <option key={t.id} value={t.name} />)}</datalist>
                    <button onClick={() => { const v = editForm.tagInput.trim(); if (v && !editForm.tags.includes(v)) setEditForm({ ...editForm, tags: [...editForm.tags, v], tagInput: '' }); }} className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-[12px] font-semibold hover:bg-primary/20 transition-colors">Add</button>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ ADDITIONAL INFO SECTION ═══ */}
            <AdditionalInfoSection lead={lead} onUpdate={(customFields) => updateLead(lead.id, { customFields })} />

            {/* ═══ FOOTER · Save / Cancel ═══ */}
            <div className="flex gap-2 px-5 py-4 bg-[#faf8f6] sticky bottom-0 border-t border-black/5">
              <button
                onClick={() => { setEditMode(false); setEditForm({ firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone, email: lead.email, dealValue: lead.dealValue, source: lead.source, assignedTo: lead.assignedTo ?? '', tags: [...lead.tags], tagInput: '' }); }}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-[#7a6b5c] hover:bg-gray-100 transition-colors"
              >Cancel</button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-bold text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 12px rgba(234,88,12,0.25)' }}
              >Save Changes</button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {!editMode && (
          <div className="px-5 py-4 border-b border-black/5">
            <h4 className="text-[13px] font-bold text-[#1c1410] mb-3">Quick Actions</h4>
            <div className="grid grid-cols-4 gap-2">
              {([
                { Icon: Layers, label: 'Pipeline', onClick: () => setShowPipelineModal(true) },
                { Icon: MessageCircle, label: 'WhatsApp', onClick: handleWhatsApp },
                { Icon: Clock, label: 'Follow-up', onClick: () => setShowFuModal(true) },
                { Icon: CalendarPlus, label: 'Appointment', onClick: () => setShowApptModal(true) },
              ]).map(({ Icon, label, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-black/[0.07] bg-white hover:bg-[#faf0e8] hover:border-primary/30 transition-colors"
                >
                  <Icon className="w-4 h-4 text-[#7a6b5c]" />
                  <span className="text-[10px] font-medium text-[#7a6b5c]">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}


        {/* Activity Timeline */}
        {!editMode && (
          <div className="px-5 py-4">
            <h4 className="text-[13px] font-bold text-[#1c1410] mb-3">Activity Timeline</h4>
            {timeline.length === 0 ? (
              <p className="text-[12px] text-[#b09e8d] text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((entry) => {
                  const { Icon, bg, color } = iconForType(entry.type);
                  return (
                    <div key={entry.id} className="flex gap-3">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', bg, color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 pt-0.5 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1c1410]">{entry.title}</p>
                        {entry.detail && <p className="text-[12px] text-[#7a6b5c] mt-0.5 break-words">{entry.detail}</p>}
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[11px] text-[#b09e8d] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {timestampLabel(entry.timestamp)}
                          </p>
                          <span className="text-[11px] text-[#7a6b5c] font-medium">
                            ~ {entry.createdBy || 'Automation'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    </div>
    {showNoteModal && <NoteModal leadId={lead.id} onClose={() => setShowNoteModal(false)} onCreated={(n) => setLeadNotes((prev) => [n, ...prev])} />}
    {showPipelineModal && <QuickEditModal lead={lead} onClose={() => setShowPipelineModal(false)} onSaved={(updates) => onLeadUpdated?.(lead.id, updates)} />}
    {showFuModal && <FollowUpModal leadId={lead.id} onClose={() => setShowFuModal(false)} onCreated={(fu) => {
      setLeadFollowUps((prev) => [...prev, fu]);
      setTimeout(() => {
        api.get<any[]>(`/api/leads/${lead.id}/activities`).then((data) =>
          setLeadActivities(data.map((a) => ({ id: a.id, leadId: lead.id, type: a.type, title: a.title, detail: a.detail, timestamp: a.timestamp ?? a.created_at, createdBy: a.created_by_name ?? a.created_by })))
        ).catch(() => null);
      }, 400);
    }} />}
    {showApptModal && <AppointmentModal lead={lead} onClose={() => setShowApptModal(false)} onBooked={() => {
      setTimeout(() => {
        api.get<any[]>(`/api/leads/${lead.id}/activities`).then((data) =>
          setLeadActivities(data.map((a) => ({ id: a.id, leadId: lead.id, type: a.type, title: a.title, detail: a.detail, timestamp: a.created_at, createdBy: a.created_by_name ?? a.created_by })))
        ).catch(() => null);
      }, 500);
    }} />}
    </>
  );
}

// ─── Kanban Card ───────────────────────────────────────────────────────────────
// ─── Quick Edit Modal ──────────────────────────────────────────────────────────
function QuickEditModal({ lead, onClose, onSaved }: {
  lead: Lead;
  onClose: () => void;
  onSaved?: (updates: { pipelineId: string; stage: string; stageId: string | undefined; tags: string[] }) => void;
}) {
  const { updateLead, moveLeadStage, pipelines, tags: storeTags } = useCrmStore();
  const [pipelineId, setPipelineId] = useState(lead.pipelineId);
  const [stage, setStage] = useState(lead.stage);
  const [tags, setTags] = useState<string[]>([...lead.tags]);
  const [tagInput, setTagInput] = useState('');

  const selectedPipeline = pipelines.find((p) => p.id === pipelineId);
  const stageOptions = selectedPipeline?.stages.map((s) => s.name) ?? [];

  const addTag = (t: string) => {
    const val = t.trim();
    if (val && !tags.includes(val)) setTags([...tags, val]);
    setTagInput('');
  };

  const handleSave = async () => {
    const stageId = selectedPipeline?.stages.find((s) => s.name === stage)?.id;
    try {
      await api.patch(`/api/leads/${lead.id}`, {
        pipeline_id: pipelineId || undefined,
        stage_id: stageId || undefined,
        tags,
      });
    } catch { /* best-effort */ }
    updateLead(lead.id, { pipelineId, stage, stageId, tags });
    if (stage !== lead.stage) moveLeadStage(lead.id, stage, stageId);
    onSaved?.({ pipelineId, stage, stageId, tags });
    toast.success('Lead updated');
    onClose();
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 transition-colors bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <div>
            <p className="text-[11px] text-[#b09e8d]">Pipeline / Stage / Tags</p>
            <h3 className="font-bold text-[15px] text-[#1c1410]">{lead.firstName} {lead.lastName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#7a6b5c]"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Pipeline */}
          <div>
            <label className="text-[12px] text-[#7a6b5c] mb-1.5 block font-semibold">Pipeline</label>
            <select className={inputCls} value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setStage(''); }}>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Stage */}
          <div>
            <label className="text-[12px] text-[#7a6b5c] mb-1.5 block font-semibold">Stage</label>
            <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Select stage</option>
              {stageOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[12px] text-[#7a6b5c] mb-1.5 block font-semibold">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-[12px] text-[#c4b09e]">No tags</span>}
            </div>
            <div className="flex gap-2">
              <input
                className={inputCls + ' flex-1'}
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag(tagInput)}
                list="tag-suggestions"
              />
              <datalist id="tag-suggestions">
                {storeTags.map((t) => <option key={t.id} value={t.name} />)}
              </datalist>
              <button onClick={() => addTag(tagInput)} disabled={!tagInput.trim()} className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-[12px] font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40">
                Add
              </button>
            </div>
          </div>

          {/* Created date — read only */}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#faf8f6] border border-black/5">
            <span className="text-[12px] font-semibold text-[#7a6b5c]">Created</span>
            <span className="text-[12px] font-bold text-[#1c1410]">
              {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all" style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' }}>
            Update
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Appointment Modal ─────────────────────────────────────────────────────────
const SHORT_DAYS_APPT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function genSlots(schedule: Record<string, { enabled: boolean; slots: { start: string; end: string }[] }>, date: string, duration: number): string[] {
  const dayName = SHORT_DAYS_APPT[new Date(date + 'T12:00:00').getDay()];
  const day = schedule[dayName];
  if (!day?.enabled) return [];
  const result: string[] = [];
  for (const w of day.slots) {
    let [sh, sm] = w.start.split(':').map(Number);
    const [eh, em] = w.end.split(':').map(Number);
    const endMins = eh * 60 + em;
    while (sh * 60 + sm + duration <= endMins) {
      const hh = sh % 12 === 0 ? 12 : sh % 12;
      const ampm = sh < 12 ? 'AM' : 'PM';
      result.push(`${String(hh).padStart(2,'0')}:${String(sm).padStart(2,'0')} ${ampm}`);
      const total = sh * 60 + sm + duration;
      sh = Math.floor(total / 60); sm = total % 60;
    }
  }
  return result;
}

function AppointmentModal({ lead, onClose, onBooked }: { lead: Lead; onClose: () => void; onBooked?: () => void }) {
  const { addCalendarEvent, bookingLinks } = useCrmStore();
  const [form, setForm] = useState({
    event: '', locationValue: '', date: '', tz: 'Asia/Kolkata', slot: '',
  });

  const selectedET = bookingLinks.find((b) => b.id === form.event) as any | undefined;
  const location   = selectedET?.meetingType ?? '';
  const slots      = selectedET && form.date ? genSlots(selectedET.schedule ?? {}, form.date, selectedET.duration ?? 30) : [];

  const handleSelectEvent = (id: string) => {
    const et = bookingLinks.find((b) => b.id === id) as any | undefined;
    setForm((f) => ({ ...f, event: id, locationValue: et?.meetingLink ?? '', slot: '' }));
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 transition-colors bg-white';
  const lbl = (text: string, required = true) => (
    <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  );

  const handleBook = async () => {
    if (!form.event || !form.date || !form.slot) {
      toast.error('Please select a calendar, date and timeslot'); return;
    }
    const bookingName = selectedET?.name ?? 'Appointment';
    const slotParts = form.slot.split(' ');
    const [hhStr, mmStr] = slotParts[0].split(':');
    let hh = parseInt(hhStr, 10);
    const mm = parseInt(mmStr, 10);
    if (slotParts[1] === 'PM' && hh !== 12) hh += 12;
    else if (slotParts[1] === 'AM' && hh === 12) hh = 0;
    const time24 = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const startIso = `${form.date}T${time24}:00`;
    const endDate = new Date(startIso);
    endDate.setMinutes(endDate.getMinutes() + (selectedET?.duration ?? 30));
    try {
      const created = await api.post<any>('/api/calendar', {
        title: `${bookingName} - ${lead.firstName} ${lead.lastName}`,
        type: selectedET?.eventType ?? 'meeting',
        start_time: startIso,
        end_time: endDate.toISOString(),
        lead_id: lead.id,
        assigned_to: lead.assignedTo || undefined,
        event_type_id: form.event,
        meeting_link: form.locationValue || undefined,
      });
      addCalendarEvent({
        id: created.id,
        title: `${bookingName} - ${lead.firstName} ${lead.lastName}`,
        type: (selectedET?.eventType as 'meeting' | 'demo' | 'call') ?? 'meeting',
        date: form.date, time: time24, duration: selectedET?.duration ?? 30,
        leadName: `${lead.firstName} ${lead.lastName}`, status: 'scheduled',
      });
      toast.success('Appointment booked');
      onClose();
      onBooked?.();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to book appointment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <h3 className="font-bold text-[17px] text-[#1c1410]">Appointment Booking</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#7a6b5c] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Lead name — read only */}
          <input
            className="w-full border border-gray-100 rounded-lg px-3 py-2.5 text-[13px] text-[#7a6b5c] bg-gray-50 outline-none cursor-default"
            value={`${lead.firstName} ${lead.lastName}`}
            readOnly
          />

          {/* Calendar Event */}
          <div>
            {lbl('Calendar Event')}
            <select className={inputCls} value={form.event} onChange={(e) => handleSelectEvent(e.target.value)}>
              <option value="">Select Event</option>
              {bookingLinks.filter((b) => (b as any).isActive !== false).map((b) => (
                <option key={b.id} value={b.id}>{(b as any).name ?? b.title}</option>
              ))}
            </select>
          </div>

          {/* Location — auto-filled from calendar, editable */}
          {form.event && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                {lbl('Meeting Type', false)}
                <input
                  className="w-full border border-gray-100 rounded-lg px-3 py-2.5 text-[13px] text-[#7a6b5c] bg-gray-50 outline-none cursor-default"
                  value={location || '—'}
                  readOnly
                />
              </div>
              <div>
                {lbl('Meeting Link / Address', false)}
                <input
                  className={inputCls}
                  placeholder="Meeting link or address"
                  value={form.locationValue}
                  onChange={(e) => setForm({ ...form, locationValue: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Event Date + Timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              {lbl('Event Date')}
              <input
                className={inputCls}
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value, slot: '' })}
              />
            </div>
            <div>
              {lbl('Timezone', false)}
              <select className={inputCls} value={form.tz} onChange={(e) => setForm({ ...form, tz: e.target.value })}>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </div>
          </div>

          {/* Timeslots — from calendar schedule */}
          <div>
            {lbl('Timeslot')}
            <select
              className={inputCls}
              value={form.slot}
              onChange={(e) => setForm({ ...form, slot: e.target.value })}
              disabled={!form.event || !form.date}
            >
              <option value="">
                {!form.event ? 'Select a calendar first' : !form.date ? 'Select a date first' : slots.length === 0 ? 'No slots available this day' : 'Pick a timeslot'}
              </option>
              {slots.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 pb-6">
          <button
            onClick={handleBook}
            className="px-8 py-2.5 rounded-lg text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.3)' }}
          >
            Book Appointment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Card ───────────────────────────────────────────────────────────────
function LeadCard({ lead, onClick, onFollowUp, onNote, onAssign, showPhone }: { lead: Lead; onClick: () => void; onFollowUp: () => void; onNote: () => void; onAssign: () => void; showPhone: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const stopAnd = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const { staff: allStaff, followUps } = useCrmStore();
  const assignedStaff = allStaff.find((s) => s.id === lead.assignedTo);
  const assignedCardName = assignedStaff?.name || lead.assignedName || '';
  const assignedCardAvatar = assignedStaff?.avatar || assignedCardName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '';
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [showCardMenu, setShowCardMenu] = useState(false);

  const initials = `${lead.firstName[0] ?? ''}${lead.lastName[0] ?? ''}`.toUpperCase() || '?';
  const bgPalette = ['#fde8d8','#dbeafe','#dcfce7','#ede9fe','#fce7f3','#fef9c3'];
  const fgPalette = ['#c2410c','#1d4ed8','#15803d','#7c3aed','#be185d','#a16207'];
  const ci = (lead.firstName.charCodeAt(0) ?? 0) % bgPalette.length;

  // ── Follow-up & days calculations ──
  const now = new Date();
  const leadFUs = followUps.filter((f) => f.leadId === lead.id);
  const lastFU = leadFUs
    .filter((f) => new Date(f.dueAt) <= now)
    .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime())[0] ?? null;
  const nextFU = leadFUs
    .filter((f) => !f.completed && new Date(f.dueAt) > now)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0] ?? null;
  const created = new Date(lead.createdAt);
  const daysInPipeline = Math.max(0, Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
     Date.UTC(created.getFullYear(), created.getMonth(), created.getDate())) / (1000 * 60 * 60 * 24)
  ));
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const diffDays = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (diffDays === 0) return `${dateStr} (today)`;
    if (diffDays > 0) return `${dateStr} (${diffDays}d ago)`;
    return `${dateStr} (in ${Math.abs(diffDays)}d)`;
  };
  const daysBg = daysInPipeline <= 2 ? 'bg-emerald-50 text-emerald-700' : daysInPipeline <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600';

  return (<>
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1 }}
      className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing"
      onClick={onClick}
    >
      <div className="p-2.5">
        {/* Row 1: avatar + name/phone (left) | staff avatar + 3-dot menu (right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: bgPalette[ci], color: fgPalette[ci] }}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#1c1410] truncate leading-tight">
                {lead.firstName} {lead.lastName}
              </p>
              <p className="text-[11px] text-[#7a6b5c] truncate">
                {showPhone ? lead.phone : lead.phone.replace(/\d(?=\d{4})/g, '*')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {assignedCardName && (
              <div title={`Assigned: ${assignedCardName}`}
                className="w-5 h-5 rounded-full bg-[#f5ede3] flex items-center justify-center text-[9px] font-bold text-primary">
                {assignedCardAvatar}
              </div>
            )}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowCardMenu((v) => !v)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#1c1410] hover:bg-orange-50 hover:text-primary transition-colors">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {showCardMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowCardMenu(false)} />
                  <div className="absolute right-0 top-7 z-40 w-44 bg-white rounded-xl border border-black/5 shadow-xl overflow-hidden py-1">
                    <button onClick={() => { setShowCardMenu(false); setShowQuickEdit(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                      <Pencil className="w-3 h-3 text-[#7a6b5c]" /> Edit
                    </button>
                    <button onClick={() => { setShowCardMenu(false); onFollowUp(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                      <CheckSquare className="w-3 h-3 text-[#7a6b5c]" /> Follow-up
                    </button>
                    <button onClick={() => { setShowCardMenu(false); setShowAppointment(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                      <CalendarPlus className="w-3 h-3 text-[#7a6b5c]" /> Book Appointment
                    </button>
                    {!assignedCardName && (
                      <button onClick={() => { setShowCardMenu(false); onAssign(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                        <User className="w-3 h-3 text-[#7a6b5c]" /> Assign
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quality badge */}
        {lead.leadQuality && (
          <div className="mt-1.5">
            <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
              lead.leadQuality === 'Hot' ? 'bg-red-100 text-red-700' :
              lead.leadQuality === 'Warm' ? 'bg-amber-100 text-amber-700' :
              lead.leadQuality === 'Cold' ? 'bg-blue-100 text-blue-700' :
              lead.leadQuality === 'Unqualified' ? 'bg-gray-100 text-gray-500' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {lead.leadQuality === 'Hot' ? '🔥' : lead.leadQuality === 'Warm' ? '☀️' : lead.leadQuality === 'Cold' ? '❄️' : ''} {lead.leadQuality}
            </span>
          </div>
        )}

        {/* Row 2: last FU (left) | days untouched (center) | next FU (right) */}
        <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-black/[0.05]">
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[9px] font-bold text-[#9e8e7e] uppercase tracking-wide leading-none mb-0.5">Last Follow</span>
            <span className="text-[11px] font-bold text-[#1c1410] truncate">
              {lastFU ? fmtDate(lastFU.dueAt) : <span className="text-[#c4b09e]">—</span>}
            </span>
          </div>
          <div className="flex flex-col items-end min-w-0">
            <span className="text-[9px] font-bold text-[#9e8e7e] uppercase tracking-wide leading-none mb-0.5">Next Follow</span>
            <span className="text-[11px] font-bold text-[#1c1410] truncate">
              {nextFU ? fmtDate(nextFU.dueAt) : <span className="text-[#c4b09e]">—</span>}
            </span>
          </div>
        </div>

      </div>

    </div>

    {showQuickEdit && <QuickEditModal lead={lead} onClose={() => setShowQuickEdit(false)} />}
    {showAppointment && <AppointmentModal lead={lead} onClose={() => setShowAppointment(false)} />}
  </>);
}

// ─── Stage Column ──────────────────────────────────────────────────────────────
function StageColumn({ stage, leads: stageLeads, onLeadClick, onFollowUp, onNote, onAssign, showPhone }: {
  stage: string; leads: Lead[]; onLeadClick: (l: Lead) => void;
  onFollowUp: (l: Lead) => void; onNote: (l: Lead) => void; onAssign: (l: Lead) => void; showPhone: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: stage });
  const dotPalette = ['#3b82f6','#f59e0b','#8b5cf6','#10b981','#f43f5e','#06b6d4','#ea580c'];
  const dotColor = dotPalette[(stage.charCodeAt(0) ?? 0) % dotPalette.length];
  return (
    <div className="min-w-[280px] w-[280px] flex-shrink-0 flex flex-col min-h-0">
      {/* Column header — centered name with colored dot + count */}
      <div className="mb-3 flex items-center justify-center gap-1.5 shrink-0 px-0.5">
        <h3 className="text-[14px] font-bold text-[#c2410c]">{stage}</h3>
        <span className="flex items-center gap-0.5 text-[13px] font-semibold">
          <span style={{ color: dotColor }}>•</span>
          <span className="text-[#1c1410] font-bold">({stageLeads.length})</span>
        </span>
      </div>

      <div ref={setNodeRef} className="space-y-2.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-0.5 pb-2 scrollbar-hide">
        <SortableContext items={stageLeads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {stageLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead}
              onClick={() => onLeadClick(lead)}
              onFollowUp={() => onFollowUp(lead)}
              onNote={() => onNote(lead)}
              onAssign={() => onAssign(lead)}
              showPhone={showPhone}
            />
          ))}
        </SortableContext>
        {stageLeads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl border-2 border-dashed border-gray-100">
            <User className="w-5 h-5 text-gray-200" />
            <p className="text-[11px] text-gray-300">No leads</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Pipeline Modal ────────────────────────────────────────────────────────
// ─── Sortable Stage Row ────────────────────────────────────────────────────────
function SortableStageRow({
  stage, index, total,
  onRename, onRemove,
}: {
  stage: { id: string; name: string };
  index: number;
  total: number;
  onRename: (id: string, val: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-white transition-shadow',
        isDragging ? 'shadow-lg border-primary/30' : 'border-gray-100 hover:border-gray-200'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 transition-colors shrink-0 touch-none"
        tabIndex={-1}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Index */}
      <span className="text-[11px] text-[#b09e8d] w-5 shrink-0 select-none">{index + 1}.</span>

      {/* Stage name input */}
      <input
        className="flex-1 text-[13px] text-[#1c1410] outline-none bg-transparent placeholder:text-gray-300"
        value={stage.name}
        onChange={(e) => onRename(stage.id, e.target.value)}
        placeholder="Stage name"
      />

      {/* Remove */}
      <button
        onClick={() => onRemove(stage.id)}
        disabled={total <= 1}
        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── New Pipeline Modal ────────────────────────────────────────────────────────
function NewPipelineModal({ onClose }: { onClose: () => void }) {
  const { addPipeline, pipelines } = useCrmStore();
  const [name, setName] = useState('');
  const ts = Date.now();
  const [stages, setStages] = useState([
    { id: `s1-${ts}`, name: 'New Lead' },
    { id: `s2-${ts}`, name: 'Contacted' },
    { id: `s3-${ts}`, name: 'Qualified' },
  ]);
  const [stageInput, setStageInput] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = stages.findIndex((s) => s.id === active.id);
    const newIdx = stages.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = [...stages];
    const [moved] = next.splice(oldIdx, 1);
    next.splice(newIdx, 0, moved);
    setStages(next);
  };

  const addStage = () => {
    const n = stageInput.trim();
    if (!n) return;
    setStages([...stages, { id: `s${Date.now()}`, name: n }]);
    setStageInput('');
  };

  const removeStage = (id: string) => setStages(stages.filter((s) => s.id !== id));
  const renameStage = (id: string, val: string) =>
    setStages(stages.map((s) => (s.id === id ? { ...s, name: val } : s)));

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Pipeline name is required'); return; }
    if (stages.length === 0) { toast.error('Add at least one stage'); return; }
    if (pipelines.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
      toast.error('A pipeline with this name already exists'); return;
    }
    try {
      const stagesWithColor = stages.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] }));
      await addPipeline({ id: '', name: name.trim(), stages: stagesWithColor });
      toast.success(`Pipeline "${name.trim()}" created`);
      onClose();
    } catch {
      toast.error('Failed to create pipeline. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <p className="text-[11px] text-gray-400 mb-0.5">Lead Management</p>
            <h3 className="text-[16px] font-bold text-[#1c1410]">Create New Pipeline</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">

          {/* Pipeline Name */}
          <div>
            <label className="text-[12px] text-[#7a6b5c] mb-1.5 block">
              Pipeline Name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-[#1c1410] outline-none focus:border-primary/50 transition-colors"
              placeholder="e.g. Sales Pipeline, Support Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Stages */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] text-[#7a6b5c]">
                Stages <span className="text-[11px] text-gray-400">({stages.length})</span>
              </label>
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <GripVertical className="w-3 h-3" /> drag to reorder
              </span>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5 mb-3">
                  {stages.map((stage, idx) => (
                    <SortableStageRow
                      key={stage.id}
                      stage={stage}
                      index={idx}
                      total={stages.length}
                      onRename={renameStage}
                      onRemove={removeStage}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add stage input */}
            <div className="flex items-center gap-2 mt-1">
              <input
                className="flex-1 border border-dashed border-gray-300 rounded-xl px-3 py-2 text-[13px] text-[#1c1410] outline-none focus:border-primary/50 transition-colors placeholder:text-gray-400 bg-gray-50"
                placeholder="+ Type a stage name and press Enter"
                value={stageInput}
                onChange={(e) => setStageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addStage()}
              />
              <button
                onClick={addStage}
                disabled={!stageInput.trim()}
                className="px-3 py-2 rounded-lg text-[12px] font-semibold text-white disabled:opacity-40 transition-all hover:-translate-y-0.5 shrink-0"
                style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.3)' }}
          >
            Create Pipeline
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Query Builder Helpers (S2.3.1 / S2.3.3) ──────────────────────────────────
function dateRangeToIso(range: string): { date_from?: string; date_to?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) => d.toISOString();
  switch (range) {
    case 'Today':      return { date_from: iso(today) };
    case 'Yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); return { date_from: iso(y), date_to: iso(today) }; }
    case 'This Week':  { const w = new Date(today); w.setDate(w.getDate() - w.getDay()); return { date_from: iso(w) }; }
    case 'Last Week':  { const ws = new Date(today); ws.setDate(ws.getDate() - ws.getDay() - 7); const we = new Date(today); we.setDate(we.getDate() - we.getDay()); return { date_from: iso(ws), date_to: iso(we) }; }
    case 'Last 7 Days':  { const d = new Date(today); d.setDate(d.getDate() - 7);  return { date_from: iso(d) }; }
    case 'Last 30 Days': { const d = new Date(today); d.setDate(d.getDate() - 30); return { date_from: iso(d) }; }
    case 'This Month': return { date_from: iso(new Date(now.getFullYear(), now.getMonth(), 1)) };
    case 'Last Month': { const ms = new Date(now.getFullYear(), now.getMonth() - 1, 1); const me = new Date(now.getFullYear(), now.getMonth(), 1); return { date_from: iso(ms), date_to: iso(me) }; }
    case 'This Year':  return { date_from: iso(new Date(now.getFullYear(), 0, 1)) };
    case 'Last Year':  { const ys = new Date(now.getFullYear() - 1, 0, 1); const ye = new Date(now.getFullYear(), 0, 1); return { date_from: iso(ys), date_to: iso(ye) }; }
    default: return {};
  }
}

function buildLeadsParams(
  filters: FilterState,
  search: string,
  pipelineId: string | null,
  selectedPipeline: Pipeline | undefined,
  cursor = '',
): URLSearchParams {
  const p = new URLSearchParams();
  p.set('after', cursor);          // triggers cursor-mode response
  p.set('limit', '50');
  if (pipelineId) p.set('pipeline_id', pipelineId);
  if (search)     p.set('search', search);
  // Single-selection filters map directly to API; multi-selection stays client-side
  if (filters.assignedTo.length === 1 && filters.assignedTo[0] !== 'none') p.set('assigned_to', filters.assignedTo[0]);
  if (filters.stage.length === 1) {
    const stageId = selectedPipeline?.stages.find((s) => s.name === filters.stage[0])?.id;
    if (stageId) p.set('stage', stageId);
  }
  if (filters.tags.length === 1) p.set('tag', filters.tags[0]);
  if (filters.createdOn) {
    const { date_from, date_to } = dateRangeToIso(filters.createdOn);
    if (date_from) p.set('date_from', date_from);
    if (date_to)   p.set('date_to',   date_to);
  }
  return p;
}

function mapApiLeadsToStore(rows: any[], stageMap: Record<string, string>): Lead[] {
  return rows.map((l) => {
    const parts = (l.name ?? '').split(' ');
    const stageName = stageMap[l.stage_id] ?? l.stage_name ?? 'New Lead';
    return {
      id: l.id,
      firstName: l.first_name ?? parts[0] ?? '',
      lastName: l.last_name ?? parts.slice(1).join(' ') ?? '',
      email: l.email ?? '',
      phone: l.phone ?? '',
      stage: stageName,
      stageId: l.stage_id ?? '',
      pipelineId: l.pipeline_id ?? '',
      source: l.source ?? 'Manual',
      tags: l.tags ?? [],
      assignedTo: l.assigned_to ?? '',
      assignedName: l.assigned_name ?? '',
      createdAt: l.created_at ?? new Date().toISOString(),
      lastActivity: l.updated_at ?? l.created_at ?? new Date().toISOString(),
      businessName: '',
      city: '',
      notes: l.notes ?? '',
      dealValue: Number(l.deal_value ?? 0),
      value: 0,
      probability: 0,
      nextFollowUp: null,
      customFields: {},
    } as Lead;
  });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { leads, moveLeadStage, followUps, completeFollowUp, pipelines, updateLead, deleteLead, staff, bookingLinks } = useCrmStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const canViewOwn    = usePermission('leads:view_own');
  const canViewAll    = usePermission('leads:view_all');
  const canCreateLead = usePermission('leads:create');
  const canEditLead   = usePermission('leads:edit');
  const canDeleteLead = usePermission('leads:delete');
  const [search, setSearch] = useState('');
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const dashFilter = searchParams.get('filter') as 'stale' | 'converted' | null;
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
    () => searchParams.get('pipeline') ?? localStorage.getItem('crm_selected_pipeline') ?? null
  );

  // Persist pipeline selection across refreshes
  const setPipeline = (id: string) => {
    setSelectedPipelineId(id);
    localStorage.setItem('crm_selected_pipeline', id);
  };

  // Sync selected pipeline when real pipelines load from API
  // If ?pipeline= param is present, it takes priority over localStorage
  useEffect(() => {
    if (pipelines.length === 0) return;
    const fromUrl = searchParams.get('pipeline');
    if (fromUrl && pipelines.find((p) => p.id === fromUrl)) {
      setPipeline(fromUrl);
      return;
    }
    // If already on a valid pipeline, do nothing — don't reset on every 30s poll
    if (selectedPipelineId && pipelines.find((p) => p.id === selectedPipelineId)) return;
    // Pipeline was deleted or nothing selected yet — fall back to saved or first
    const saved = localStorage.getItem('crm_selected_pipeline');
    const valid = saved && pipelines.find((p) => p.id === saved);
    setPipeline(valid ? saved! : pipelines[0].id);
  }, [pipelines]);
  const [kanbanView, setKanbanView] = useState(!dashFilter);
  const [showPhone, setShowPhone] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;
  const [showAddLead, setShowAddLead] = useState(false);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showBulkStage, setShowBulkStage] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  // Keyboard shortcut Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
        setSearch('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close overflow menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    if (showMoreMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  const stageMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of pipelines) for (const s of p.stages) m[s.id] = s.name;
    return m;
  }, [pipelines]);

  // Real-time: update leads live when others create/edit them
  useEffect(() => {
    const socket = getSocket();

    const onLeadCreated = (lead: any) => {
      const stageName = stageMap[lead.stage_id] ?? lead.stage_name ?? '';
      useCrmStore.getState().addLead({
        id: lead.id,
        firstName: (lead.name ?? '').split(' ')[0],
        lastName: (lead.name ?? '').split(' ').slice(1).join(' '),
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        pipelineId: lead.pipeline_id ?? '',
        stage: stageName,
        source: lead.source ?? '',
        dealValue: lead.deal_value ?? 0,
        tags: lead.tags ?? [],
        score: 0,
        notes: [],
        assignedTo: lead.assigned_to ?? '',
        assignedName: lead.assigned_name ?? '',
        createdAt: lead.created_at ?? new Date().toISOString(),
        lastActivity: lead.updated_at ?? new Date().toISOString(),
      });
    };

    const onLeadUpdated = (lead: any) => {
      const stageName = stageMap[lead.stage_id] ?? lead.stage_name ?? '';
      const parts = (lead.name ?? '').split(' ');
      useCrmStore.getState().updateLead(lead.id, {
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' ') ?? '',
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        stage: stageName,
        stageId: lead.stage_id ?? '',
        pipelineId: lead.pipeline_id ?? '',
        tags: lead.tags ?? [],
        assignedTo: lead.assigned_to ?? '',
        assignedName: lead.assigned_name ?? '',
        dealValue: Number(lead.deal_value ?? 0),
        lastActivity: lead.updated_at ?? new Date().toISOString(),
        leadQuality: lead.custom_fields?.lead_quality ?? undefined,
      });
    };

    socket.on('lead:created', onLeadCreated);
    socket.on('lead:updated', onLeadUpdated);
    return () => {
      socket.off('lead:created', onLeadCreated);
      socket.off('lead:updated', onLeadUpdated);
    };
  }, [stageMap]);

  const exportLeads = () => {
    // Use real API export when available
    api.get('/api/leads/export', { responseType: 'blob' } as any)
      .then((data: any) => {
        const blob = data instanceof Blob ? data : new Blob([data as any], { type: 'text/csv' });
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob),
          download: `leads_${format(new Date(), 'dd-MM-yyyy')}.csv`,
        });
        a.click();
        toast.success('Leads exported');
      })
      .catch(() => {
        // Fallback to client-side export
        const headers = ['First Name', 'Last Name', 'Phone', 'Email', 'Deal Value', 'Stage', 'Source', 'Tags', 'Created At'];
        const rows = filteredLeads.map((l) => [l.firstName, l.lastName, l.phone, l.email, l.dealValue, l.stage, l.source, l.tags.join('; '), format(new Date(l.createdAt), 'dd/MM/yyyy')]);
        const csv = [headers, ...rows].map((r) => r.map((c) => `"${c ?? ''}"`).join(',')).join('\n');
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `opportunities_${format(new Date(), 'dd-MM-yyyy')}.csv` });
        a.click();
        toast.success(`${filteredLeads.length} opportunities exported`);
      });
  };
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ ...emptyFilters });
  const [quickEditLead, setQuickEditLead] = useState<Lead | null>(null);
  const [quickNoteLead, setQuickNoteLead] = useState<Lead | null>(null);
  const [quickFollowUpLead, setQuickFollowUpLead] = useState<Lead | null>(null);
  const [quickAssignLead, setQuickAssignLead] = useState<Lead | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId) ?? pipelines[0];
  const activeStages = selectedPipeline?.stages.map((s) => s.name) ?? [];

  // ── Server-side filter state (S2.3.1 + S2.3.3) ──────────────────────────────
  const [apiLeads, setApiLeads] = useState<Lead[] | null>(null);

  const hasServerFilter = !!(
    search || selectedPipelineId ||
    filters.assignedTo.length || filters.stage.length ||
    filters.tags.length || filters.createdOn
  );

  useEffect(() => {
    if (!hasServerFilter) { setApiLeads(null); return; }

    let cancelled = false;
    const delay = search ? 300 : 0;
    const t = setTimeout(async () => {
      try {
        let allLeads: any[] = [];
        let cursor = '';
        while (true) {
          const params = buildLeadsParams(filters, search, selectedPipelineId, selectedPipeline, cursor);
          const data = await api.get<{ leads: any[]; nextCursor: string | null }>(`/api/leads?${params}`);
          if (cancelled) return;
          allLeads = [...allLeads, ...data.leads];
          if (!data.nextCursor) break;
          cursor = data.nextCursor;
        }
        setApiLeads(mapApiLeadsToStore(allLeads, stageMap));
      } catch { /* ignore */ }
    }, delay);
    return () => { cancelled = true; clearTimeout(t); };
  }, [filters, search, selectedPipelineId, selectedPipeline?.id, hasServerFilter]);

  const filteredLeads = useMemo(() => {
    // Dashboard quick-filter — cross-pipeline, bypasses server fetch
    if (dashFilter === 'stale') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return leads.filter((l) => new Date(l.lastActivity) < sevenDaysAgo);
    }
    if (dashFilter === 'converted') {
      const wonStageIds = new Set(pipelines.flatMap((p) => p.stages.filter((s) => s.is_won).map((s) => s.id)));
      return wonStageIds.size > 0 ? leads.filter((l) => wonStageIds.has(l.stageId)) : [];
    }

    // Use server-fetched leads when active filters exist, otherwise use store leads
    let result = apiLeads ?? leads;

    // Client-side-only filters (no backend equivalent)
    if (filters.contactType.length) result = result.filter((l) => filters.contactType.includes('Customer') ? l.stage === 'Closed Won' : l.stage !== 'Closed Won');
    if (filters.opportunityValue.length) result = result.filter((l) => {
      const v = l.dealValue;
      return filters.opportunityValue.some((r) =>
        r === 'Less than ₹1,000' ? v < 1000 :
        r === '₹1,000 - ₹5,000' ? v >= 1000 && v <= 5000 :
        r === '₹5,001 - ₹10,000' ? v >= 5001 && v <= 10000 :
        r === '₹10,001 - ₹50,000' ? v >= 10001 && v <= 50000 :
        r === 'More than ₹50,000' ? v > 50000 : true
      );
    });

    // Multi-value filters still applied client-side when >1 selection
    if (!apiLeads) {
      if (selectedPipelineId) result = result.filter((l) => l.pipelineId === selectedPipelineId);
      if (search) { const s = search.toLowerCase(); result = result.filter((l) => `${l.firstName} ${l.lastName}`.toLowerCase().includes(s) || l.phone.includes(s) || l.email.toLowerCase().includes(s)); }
      if (filters.assignedTo.length) result = result.filter((l) => filters.assignedTo.includes('none') ? !l.assignedTo : filters.assignedTo.includes(l.assignedTo ?? ''));
      if (filters.stage.length) result = result.filter((l) => filters.stage.includes(l.stage));
      if (filters.tags.length) result = result.filter((l) => filters.tags.some((t) => l.tags.includes(t)));
      if (filters.createdOn) {
        const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        result = result.filter((l) => {
          const d = new Date(l.createdAt);
          if (filters.createdOn === 'Today') return d >= today;
          if (filters.createdOn === 'Yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); return d >= y && d < today; }
          if (filters.createdOn === 'This Week') { const w = new Date(today); w.setDate(w.getDate() - w.getDay()); return d >= w; }
          if (filters.createdOn === 'This Month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          if (filters.createdOn === 'Last 7 Days') { const w = new Date(today); w.setDate(w.getDate() - 7); return d >= w; }
          if (filters.createdOn === 'Last 30 Days') { const m = new Date(today); m.setDate(m.getDate() - 30); return d >= m; }
          return true;
        });
      }
    } else if (filters.assignedTo.length > 1) {
      result = result.filter((l) => filters.assignedTo.includes('none') ? !l.assignedTo : filters.assignedTo.includes(l.assignedTo ?? ''));
    }

    return result;
  }, [leads, apiLeads, selectedPipelineId, search, filters, dashFilter, pipelines]);

  const totalCount = filteredLeads.length;
  const leadCount = filteredLeads.filter((l) => l.stage !== 'Closed Won').length;
  const customerCount = filteredLeads.filter((l) => l.stage === 'Closed Won').length;
  const activeFiltersCount = Object.values(filters).filter((v) => (Array.isArray(v) ? v.length > 0 : !!v)).length;

  const filteredPipelines = pipelines.filter((p) =>
    p.name.toLowerCase().includes(pipelineSearch.toLowerCase())
  );

  const handleDragStart = (e: DragStartEvent) => setActiveDragId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over) return;
    const leadId = active.id as string;
    const overId = over.id as string;

    let newStage: string | undefined;
    let newStageId: string | undefined;

    if (activeStages.includes(overId)) {
      newStage = overId;
      newStageId = selectedPipeline?.stages.find((s) => s.name === overId)?.id;
    } else {
      const targetLead = (apiLeads ?? leads).find((l) => l.id === overId);
      const srcLead = (apiLeads ?? leads).find((l) => l.id === leadId);
      if (targetLead && targetLead.stage !== srcLead?.stage) {
        newStage = targetLead.stage;
        newStageId = targetLead.stageId;
      }
    }

    if (!newStage) return;

    // Update store leads
    moveLeadStage(leadId, newStage, newStageId);

    // Also update apiLeads so filteredLeads (which reads apiLeads ?? leads) reflects the move
    if (apiLeads) {
      setApiLeads((prev) =>
        (prev ?? []).map((l) => l.id === leadId ? { ...l, stage: newStage!, stageId: newStageId ?? l.stageId } : l)
      );
    }

    toast.success(`Lead moved to ${newStage}`);
    if (newStageId) api.patch(`/api/leads/${leadId}`, { stage_id: newStageId }).catch(() => null);
  };

  const activeLead = activeDragId ? (apiLeads ?? leads).find((l) => l.id === activeDragId) : null;

  const pipelineLeads = selectedPipelineId ? leads.filter((l) => l.pipelineId === selectedPipelineId) : leads;

  // Bulk actions
  const bulkMove = async (stage: string) => {
    const ids = [...selectedIds];
    const pl = pipelines.find((p) => p.id === selectedPipelineId) ?? pipelines[0];
    const stageId = pl?.stages.find((s) => s.name === stage)?.id;
    ids.forEach((id) => moveLeadStage(id, stage, stageId));
    toast.success(`${ids.length} leads moved to ${stage}`);
    setSelectedIds([]); setShowBulkStage(false);
    if (stageId) {
      await Promise.all(ids.map((id) => api.patch(`/api/leads/${id}`, { stage_id: stageId }).catch(() => null)));
    }
  };
  const bulkAssign = async (staffId: string) => {
    const ids = [...selectedIds];
    ids.forEach((id) => updateLead(id, { assignedTo: staffId }));
    const name = staffId ? staff.find((s: any) => s.id === staffId)?.name : 'unassigned';
    toast.success(`${ids.length} leads ${staffId ? 'assigned to ' + name : 'unassigned'}`);
    setSelectedIds([]); setShowBulkAssign(false);
    await Promise.all(ids.map((id) => api.patch(`/api/leads/${id}`, { assigned_to: staffId || null }).catch(() => null)));
  };
  const bulkDelete = async () => {
    let failed = 0;
    await Promise.all(selectedIds.map((id) =>
      api.delete(`/api/leads/${id}`).then(() => deleteLead(id)).catch(() => { failed++; })
    ));
    const done = selectedIds.length - failed;
    if (done > 0) toast.success(`${done} contact${done !== 1 ? 's' : ''} deleted`);
    if (failed > 0) toast.error(`${failed} could not be deleted`);
    setSelectedIds([]);
    setShowBulkDeleteConfirm(false);
  };

  const role = currentUser?.role;
  const noAccess = role === 'staff' && !canViewOwn && !canViewAll;

  if (noAccess) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <EyeOff className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-[18px] font-bold text-[#1c1410] mb-2">No access to leads</h2>
        <p className="text-[14px] text-[#7a6b5c] max-w-sm">You don't have permission to view leads. Contact your admin to request access.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-fade-in">

      {/* ── Dashboard filter banner ── */}
      {dashFilter && (
        <div className={`flex items-center gap-3 mb-3 px-4 py-2.5 rounded-xl border text-[13px] font-medium ${dashFilter === 'stale' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <span className="flex-1">
            {dashFilter === 'stale'
              ? `Showing ${filteredLeads.length} stale lead${filteredLeads.length !== 1 ? 's' : ''} — no activity in 7+ days`
              : `Showing ${filteredLeads.length} converted lead${filteredLeads.length !== 1 ? 's' : ''} — in won stage`}
          </span>
          <a href="/leads" className="text-[11px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100">Clear filter</a>
        </div>
      )}

      {/* ── Smart Toolbar ── */}
      <div className="sticky top-0 z-20 bg-[#faf8f6] pt-2 pb-3 space-y-2.5">

        {/* Row 1: Contextual bar — bulk actions when leads selected, else default toolbar */}
        {selectedIds.length > 0 ? (
          /* ── Bulk Action Bar ── */
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 animate-fade-in"
            style={{ background: 'linear-gradient(to right, #faf0e8, #fff)', boxShadow: '0 2px 8px rgba(234,88,12,0.08)' }}
          >
            <div className="flex items-center gap-2 pr-3 border-r border-primary/20">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">{selectedIds.length}</div>
              <span className="text-[12px] font-semibold text-[#1c1410]">selected</span>
            </div>

            {/* Change Stage */}
            <div className="relative">
              <button onClick={() => { setShowBulkStage((v) => !v); setShowBulkAssign(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#1c1410] hover:bg-white transition-colors">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Change Stage <ChevronDown className="w-3 h-3" />
              </button>
              {showBulkStage && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowBulkStage(false)} />
                  <div className="absolute left-0 top-10 z-40 bg-white rounded-xl border border-black/5 shadow-xl w-44 py-1 overflow-hidden">
                    {activeStages.map((s) => (
                      <button key={s} onClick={() => bulkMove(s)} className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#faf0e8] hover:text-primary transition-colors">{s}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Assign */}
            <div className="relative">
              <button onClick={() => { setShowBulkAssign((v) => !v); setShowBulkStage(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#1c1410] hover:bg-white transition-colors">
                <User className="w-3.5 h-3.5" /> Assign <ChevronDown className="w-3 h-3" />
              </button>
              {showBulkAssign && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowBulkAssign(false)} />
                  <div className="absolute left-0 top-10 z-40 bg-white rounded-xl border border-black/5 shadow-xl w-48 py-1 overflow-hidden max-h-60 overflow-y-auto">
                    <button onClick={() => bulkAssign('')} className="w-full text-left px-3 py-2 text-[12px] text-[#7a6b5c] hover:bg-gray-50 transition-colors italic">Unassign</button>
                    <div className="border-t border-black/5 my-1" />
                    {staff.map((s) => (
                      <button key={s.id} onClick={() => bulkAssign(s.id)} className="w-full flex items-center gap-2 text-left px-3 py-2 text-[12px] hover:bg-[#faf0e8] hover:text-primary transition-colors">
                        <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center">{s.avatar}</div>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Workflow */}
            <button onClick={() => setShowWorkflow(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#1c1410] hover:bg-white transition-colors">
              <Zap className="w-3.5 h-3.5" /> Trigger Workflow
            </button>

            <div className="flex-1" />

            {/* Delete */}
            {canDeleteLead && (
              <button onClick={() => setShowBulkDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
            {showBulkDeleteConfirm && (
              <ConfirmModal
                title={`Delete ${selectedIds.length} contact${selectedIds.length !== 1 ? 's' : ''}?`}
                message="This will permanently remove them from the CRM. This cannot be undone."
                confirmLabel="Yes, Delete"
                onConfirm={bulkDelete}
                onClose={() => setShowBulkDeleteConfirm(false)}
              />
            )}

            {/* Clear selection */}
            <button onClick={() => setSelectedIds([])} className="p-1.5 rounded-lg hover:bg-white transition-colors text-[#7a6b5c]">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ── Default Toolbar ── */
          <div className="flex items-center gap-3">

            {/* Pipeline selector */}
            <div className="relative shrink-0">
              <button
                onClick={() => { setPipelineOpen((o) => !o); setPipelineSearch(''); }}
                className="flex items-center gap-2.5 pl-3 pr-2.5 h-10 rounded-xl bg-white border border-black/10 text-[13px] font-semibold text-[#1c1410] hover:border-primary/40 hover:bg-orange-50/30 transition-all"
              >
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="truncate max-w-[130px]">{selectedPipeline?.name ?? 'Select pipeline'}</span>
                <span className="text-[11px] font-bold bg-primary/10 text-primary rounded-md px-1.5 py-0.5 min-w-[22px] text-center">{pipelineLeads.length}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#9a8a7a]" />
              </button>

              {pipelineOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setPipelineOpen(false)} />
                  <div className="absolute left-0 top-12 z-40 bg-white rounded-2xl border border-black/5 shadow-2xl w-64 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/5">
                      <Search className="w-3.5 h-3.5 text-[#b09e8d] shrink-0" />
                      <input autoFocus className="flex-1 text-[12px] outline-none text-[#1c1410] placeholder:text-gray-400" placeholder="Search pipeline..." value={pipelineSearch} onChange={(e) => setPipelineSearch(e.target.value)} />
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1.5">
                      {filteredPipelines.map((p) => {
                        const cnt = leads.filter((l) => l.pipelineId === p.id).length;
                        return (
                          <button key={p.id} onClick={() => { setPipeline(p.id); setPipelineOpen(false); }}
                            className={cn('w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center gap-2', p.id === selectedPipelineId ? 'bg-[#faf0e8] text-primary font-semibold' : 'text-[#1c1410] hover:bg-[#faf8f6]')}>
                            {p.id === selectedPipelineId && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                            <span className="flex-1 truncate">{p.name}</span>
                            <span className="text-[10px] text-[#b09e8d] font-normal">{cnt}</span>
                          </button>
                        );
                      })}
                      {filteredPipelines.length === 0 && <p className="px-4 py-3 text-[12px] text-[#7a6b5c]">No pipelines found</p>}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d] pointer-events-none" />
              <input
                ref={searchInputRef}
                className="w-full h-10 pl-9 pr-10 text-[13px] bg-white border border-black/10 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder:text-[#b09e8d] transition-all"
                placeholder="Search leads…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {!search
                ? <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#c4b09e] bg-gray-50 border border-black/[0.07] rounded px-1.5 py-0.5">⌘K</kbd>
                : <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-gray-100 flex items-center justify-center text-[#b09e8d]"><X className="w-3 h-3" /></button>
              }
            </div>

            <div className="flex-1" />

            {/* Right action group */}
            <div className="flex items-center gap-2 shrink-0">

              {/* View toggle — segmented pill */}
              <div className="flex items-center h-10 bg-gray-100 rounded-xl p-1 gap-0.5">
                <button title="Board" onClick={() => setKanbanView(true)}
                  className={cn('flex items-center justify-center w-8 h-8 rounded-lg transition-all', kanbanView ? 'bg-white shadow-sm text-primary' : 'text-[#7a6b5c] hover:text-[#1c1410]')}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button title="List" onClick={() => setKanbanView(false)}
                  className={cn('flex items-center justify-center w-8 h-8 rounded-lg transition-all', !kanbanView ? 'bg-white shadow-sm text-primary' : 'text-[#7a6b5c] hover:text-[#1c1410]')}>
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filter */}
              <div className="relative">
                <button ref={filterBtnRef} onClick={() => setShowFilters((v) => !v)}
                  title={activeFiltersCount > 0 ? `${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active` : 'Filter'}
                  className={cn('relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all',
                    activeFiltersCount > 0 || showFilters ? 'bg-orange-50 border-primary/30 text-primary' : 'bg-white border-black/10 text-[#7a6b5c] hover:border-primary/30 hover:text-primary'
                  )}>
                  <Filter className="w-4 h-4" />
                  {activeFiltersCount > 0 && <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFiltersCount}</span>}
                </button>
                {showFilters && <FilterPopover filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} stages={activeStages} anchorRef={filterBtnRef} />}
              </div>

              {/* More */}
              <div className="relative" ref={moreMenuRef}>
                <button onClick={() => setShowMoreMenu((v) => !v)}
                  className={cn('flex items-center justify-center w-10 h-10 rounded-xl border transition-all', showMoreMenu ? 'bg-orange-50 border-primary/30 text-primary' : 'bg-white border-black/10 text-[#7a6b5c] hover:border-primary/30 hover:text-primary')}>
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-12 z-40 w-56 bg-white rounded-xl border border-black/5 shadow-xl overflow-hidden py-1">
                    <button onClick={() => { setShowMoreMenu(false); setShowImport(true); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                      <Package className="w-3.5 h-3.5 text-[#7a6b5c]" /> Import leads
                    </button>
                    <button onClick={() => { setShowMoreMenu(false); exportLeads(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                      <Download className="w-3.5 h-3.5 text-[#7a6b5c]" /> Export leads
                    </button>
                    <div className="border-t border-black/5 my-1" />
                    <button onClick={() => { setShowMoreMenu(false); setShowWorkflow(true); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                      <Zap className="w-3.5 h-3.5 text-[#7a6b5c]" /> Trigger Workflow
                    </button>
                    <button onClick={() => { setShowMoreMenu(false); setShowPhone((v) => !v); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                      {showPhone ? <EyeOff className="w-3.5 h-3.5 text-[#7a6b5c]" /> : <Eye className="w-3.5 h-3.5 text-[#7a6b5c]" />}
                      {showPhone ? 'Hide contact info' : 'Show contact info'}
                    </button>
                    <div className="border-t border-black/5 my-1" />
                    <button onClick={() => { setShowMoreMenu(false); setSearch(''); setFilters({ ...emptyFilters }); setSelectedIds([]); toast.success('Reset'); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors">
                      <RotateCcw className="w-3.5 h-3.5 text-[#7a6b5c]" /> Reset filters
                    </button>
                  </div>
                )}
              </div>

              {/* Add Lead */}
              {canCreateLead && (
                <button onClick={() => setShowAddLead(true)}
                  className="flex items-center gap-2 px-4 h-10 rounded-xl text-[13px] font-bold text-white bg-primary hover:bg-primary/90 transition-all active:scale-95 shrink-0">
                  <Plus className="w-4 h-4" /> Add Lead
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active filter chips — one per value, instant remove */}
        {selectedIds.length === 0 && activeFiltersCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[#7a6b5c] font-semibold uppercase tracking-wide mr-1">Filtered by:</span>
            {filters.assignedTo.map((id) => {
              const name = id === 'none' ? 'Unassigned' : staff.find((s) => s.id === id)?.name ?? id;
              return <FilterChip key={`a-${id}`} label={`Assignee: ${name}`} onRemove={() => setFilters({ ...filters, assignedTo: filters.assignedTo.filter((x) => x !== id) })} />;
            })}
            {filters.stage.map((s) => (
              <FilterChip key={`s-${s}`} label={`Stage: ${s}`} onRemove={() => setFilters({ ...filters, stage: filters.stage.filter((x) => x !== s) })} />
            ))}
            {filters.tags.map((t) => (
              <FilterChip key={`t-${t}`} label={`Tag: ${t}`} onRemove={() => setFilters({ ...filters, tags: filters.tags.filter((x) => x !== t) })} />
            ))}
            {filters.contactType.map((t) => (
              <FilterChip key={`ct-${t}`} label={`Type: ${t}`} onRemove={() => setFilters({ ...filters, contactType: filters.contactType.filter((x) => x !== t) })} />
            ))}
            {filters.leadQuality.map((q) => (
              <FilterChip key={`lq-${q}`} label={`Quality: ${q}`} onRemove={() => setFilters({ ...filters, leadQuality: filters.leadQuality.filter((x) => x !== q) })} />
            ))}
            {filters.opportunityValue.map((v) => (
              <FilterChip key={`ov-${v}`} label={`Value: ${v}`} onRemove={() => setFilters({ ...filters, opportunityValue: filters.opportunityValue.filter((x) => x !== v) })} />
            ))}
            {filters.createdOn && <FilterChip label={`Created: ${filters.createdOn}`} onRemove={() => setFilters({ ...filters, createdOn: '' })} />}
            {filters.followUp && <FilterChip label={`Follow-up: ${filters.followUp}`} onRemove={() => setFilters({ ...filters, followUp: '' })} />}
            <button onClick={() => setFilters({ ...emptyFilters })} className="ml-1 text-[11px] text-red-500 font-semibold hover:underline">Clear all</button>
          </div>
        )}
      </div>

      {/* ── Board ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {kanbanView ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto overflow-y-hidden flex-1 min-h-0 pb-4 items-stretch scrollbar-hide">
            {activeStages.map((stage) => {
              const now = new Date();
              const stageLeadsSorted = filteredLeads
                .filter((l) => l.stage === stage)
                .sort((a, b) => {
                  const nextA = followUps
                    .filter((f) => f.leadId === a.id && !f.completed)
                    .sort((x, y) => new Date(x.dueAt).getTime() - new Date(y.dueAt).getTime())[0];
                  const nextB = followUps
                    .filter((f) => f.leadId === b.id && !f.completed)
                    .sort((x, y) => new Date(x.dueAt).getTime() - new Date(y.dueAt).getTime())[0];
                  if (nextA && nextB) return new Date(nextA.dueAt).getTime() - new Date(nextB.dueAt).getTime();
                  if (nextA) return -1;
                  if (nextB) return 1;
                  return 0;
                });
              return (
              <StageColumn
                key={stage} stage={stage}
                leads={stageLeadsSorted}
                onLeadClick={(l) => setSelectedLeadId(l.id)}
                onFollowUp={setQuickFollowUpLead}
                onNote={setQuickNoteLead}
                onAssign={setQuickAssignLead}
                showPhone={showPhone}
              />
              );
            })}
          </div>
          <DragOverlay>{activeLead && <div className="bg-card rounded-lg border-2 border-primary p-3 shadow-2xl opacity-90 w-[280px]"><span className="font-semibold text-sm">{activeLead.firstName} {activeLead.lastName}</span></div>}</DragOverlay>
        </DndContext>
      ) : (
        /* ── List View ── */
        <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#faf8f6] border-b border-black/5">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox"
                    checked={filteredLeads.length > 0 && selectedIds.length === filteredLeads.length}
                    onChange={() => setSelectedIds(selectedIds.length === filteredLeads.length ? [] : filteredLeads.map((l) => l.id))}
                    className="w-4 h-4 accent-primary"
                  />
                </th>
                {[['Opportunity', '130px'], ['Contact Name', '150px'], ['Contact Email', '210px'], ['Contact Phone', '160px'], ['Pipeline', '170px'], ['Stage', '110px'], ['Created', '150px'], ['Updated', '150px']].map(([col]) => (
                  <th key={col} className="px-3 py-3 text-left">
                    <button className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] hover:text-[#1c1410] transition-colors">
                      {col} <ArrowUpDown className="w-3 h-3 opacity-50" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredLeads.length === 0 && (
                <tr><td colSpan={9} className="py-16 text-center">
                  <User className="w-8 h-8 text-[#c4b09e] mx-auto mb-2" />
                  <p className="text-[13px] text-[#7a6b5c]">No leads found</p>
                </td></tr>
              )}
              {filteredLeads.map((lead) => {
                const isSelected = selectedIds.includes(lead.id);
                const maskedPhone = showPhone ? lead.phone : lead.phone.replace(/\d(?=\d{4})/g, '*');
                const maskedEmail = showPhone ? lead.email : lead.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c);
                const initials = `${lead.firstName[0] ?? ''}${lead.lastName[0] ?? ''}`.toUpperCase();
                const pipeline = pipelines.find((p) => p.id === lead.pipelineId);
                return (
                  <tr key={lead.id} className={cn('hover:bg-[#faf8f6] transition-colors', isSelected && 'bg-primary/[0.03]')}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected}
                        onChange={() => setSelectedIds(isSelected ? selectedIds.filter((x) => x !== lead.id) : [...selectedIds, lead.id])}
                        className="w-4 h-4 accent-primary"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => setSelectedLeadId(lead.id)} className="text-primary font-semibold hover:underline text-[13px]">
                        {lead.firstName} {lead.lastName}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #c2410c, #ea580c)' }}>{initials}</div>
                        <button onClick={() => setSelectedLeadId(lead.id)} className="text-primary font-semibold hover:underline text-[13px] truncate max-w-[90px]">
                          {lead.firstName}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#3d3128] truncate max-w-[160px]">{maskedEmail}</span>
                        <button onClick={() => { copyToClipboard(lead.email); toast.success('Email copied'); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-primary font-medium">{maskedPhone}</span>
                        <button onClick={() => { copyToClipboard(lead.phone); toast.success('Phone copied'); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[#3d3128] truncate max-w-[170px]">{pipeline?.name ?? '—'}</td>
                    <td className="px-3 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-primary">{lead.stage}</span></td>
                    <td className="px-3 py-3 text-[#7a6b5c] whitespace-nowrap">{format(new Date(lead.createdAt), 'dd/MM/yyyy hh:mm aa')}</td>
                    <td className="px-3 py-3 text-[#7a6b5c] whitespace-nowrap">{format(new Date(lead.lastActivity), 'dd/MM/yyyy hh:mm aa')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {selectedIds.length > 0 && (
            <div className="px-5 py-2.5 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <p className="text-[12px] text-blue-600">
                {selectedIds.length} contact(s) selected.{' '}
                <button onClick={() => setShowWorkflow(true)} className="font-bold underline hover:text-blue-800">Trigger Workflow</button>
              </p>
            </div>
          )}
        </div>
      )}
      </div>{/* end flex-1 board wrapper */}

      {selectedLead && <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLeadId(null)} onLeadUpdated={(id, updates) => {
        if (apiLeads) {
          setApiLeads((prev) => prev?.map((l) => l.id === id ? { ...l, ...updates } : l) ?? null);
        }
      }} />}
      {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} />}
      {showNewPipeline && <NewPipelineModal onClose={() => setShowNewPipeline(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showWorkflow && <WorkflowModal leadIds={selectedIds.length > 0 ? selectedIds : filteredLeads.map((l) => l.id)} onClose={() => setShowWorkflow(false)} />}
      {quickEditLead && <EditLeadModal lead={quickEditLead} onClose={() => setQuickEditLead(null)} />}
      {quickNoteLead && <NoteModal leadId={quickNoteLead.id} onClose={() => setQuickNoteLead(null)} />}
      {quickFollowUpLead && <FollowUpModal leadId={quickFollowUpLead.id} onClose={() => setQuickFollowUpLead(null)} />}
      {quickAssignLead && <AssignModal lead={quickAssignLead} onClose={() => setQuickAssignLead(null)} />}
    </div>
  );
}
