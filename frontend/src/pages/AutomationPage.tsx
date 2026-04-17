import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrmStore } from '@/store/crmStore';
import {
  Search, Plus, Zap, MoreVertical, FileText, X, CheckCircle2,
  Clock, Users, Activity, Pencil, Copy, Trash2, ChevronDown, ToggleLeft,
  Folder, FolderOpen, ChevronRight, Layout, FolderInput, PowerOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface WFFolder {
  id: string;
  name: string;
  workflowIds: string[];
}

export interface WFNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay';
  actionType: string;
  label: string;
  config: Record<string, string | string[] | boolean>;
  branches?: {
    yes: WFNode[];
    no: WFNode[];
  };
}

export interface WFRecord {
  id: string;
  name: string;
  description: string;
  allowReentry: boolean;
  totalContacts: number;
  completed: number;
  completedNodes: number;
  lastUpdated: string;
  status: 'active' | 'inactive';
  nodes: WFNode[];
}

interface LogRow {
  id: string;
  contactName: string;
  outcome: string;
  enrolledAt: string;
  appointmentDate?: string;
  completedAction: string;
  completedAt: string;
  nextAction: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const initialWorkflows: WFRecord[] = [
  {
    id: 'wf-1', name: 'Show Up Automation',
    description: 'Trigger fired when an appointment is shown up',
    allowReentry: false, totalContacts: 3, completed: 3, completedNodes: 2,
    lastUpdated: '3 months ago', status: 'active',
    nodes: [
      { id: 'n1', type: 'trigger', actionType: 'appointment_booked', label: 'Appointment Booked', config: {} },
      { id: 'n2', type: 'action', actionType: 'add_to_crm', label: 'Add/Update to CRM', config: {} },
    ],
  },
  {
    id: 'wf-2', name: 'Stage Change Notifier',
    description: "Triggers when a contact's stage changes in selected pipeline",
    allowReentry: false, totalContacts: 1, completed: 1, completedNodes: 2,
    lastUpdated: '3 months ago', status: 'active',
    nodes: [
      { id: 'n1', type: 'trigger', actionType: 'stage_changed', label: 'Stage Changed', config: {} },
      { id: 'n2', type: 'action', actionType: 'send_whatsapp', label: 'Send WhatsApp', config: {} },
    ],
  },
  {
    id: 'wf-3', name: 'Manual Staff Assignment',
    description: "Assigns staff when a contact's stage is updated",
    allowReentry: false, totalContacts: 1, completed: 1, completedNodes: 1,
    lastUpdated: '3 months ago', status: 'inactive',
    nodes: [
      { id: 'n1', type: 'trigger', actionType: 'stage_changed', label: 'Stage Changed', config: {} },
      { id: 'n2', type: 'action', actionType: 'assign_staff', label: 'Assign To Staff', config: {} },
    ],
  },
  {
    id: 'wf-4', name: 'New Lead Welcome',
    description: 'Fires when a contact is added to the selected pipeline',
    allowReentry: false, totalContacts: 12, completed: 10, completedNodes: 2,
    lastUpdated: '1 week ago', status: 'active',
    nodes: [
      { id: 'n1', type: 'trigger', actionType: 'lead_created', label: 'Lead Created', config: {} },
      { id: 'n2', type: 'action', actionType: 'add_to_crm', label: 'Add/Update to CRM', config: {} },
      { id: 'n3', type: 'action', actionType: 'send_whatsapp', label: 'Send WhatsApp', config: {} },
    ],
  },
];

const mockLogs: LogRow[] = [
  { id: 'l1', contactName: '!!Possibly Deleted!!', outcome: 'Appointment Confirmed', enrolledAt: 'Dec 30th, 2025, 07:34:24 pm', appointmentDate: 'Dec 31st, 2025, 09:00 am', completedAction: 'Add/Update to CRM', completedAt: 'Dec 30th, 2025, 07:37:16 pm', nextAction: 'Completed on Dec 30th, 2025, 07:37:16 pm' },
  { id: 'l2', contactName: '!!Possibly Deleted!!', outcome: 'Appointment Confirmed', enrolledAt: 'Dec 30th, 2025, 07:32:40 pm', appointmentDate: 'Dec 31st, 2025, 09:00 am', completedAction: 'Add/Update to CRM', completedAt: 'Dec 30th, 2025, 07:35:38 pm', nextAction: 'Completed on Dec 30th, 2025, 07:35:38 pm' },
  { id: 'l3', contactName: '!!Possibly Deleted!!', outcome: 'Appointment Confirmed', enrolledAt: 'Dec 30th, 2025, 07:32:26 pm', appointmentDate: 'Dec 31st, 2025, 09:00 am', completedAction: 'Add/Update to CRM', completedAt: 'Dec 30th, 2025, 07:35:43 pm', nextAction: 'Completed on Dec 30th, 2025, 07:35:43 pm' },
];

const NODE_TYPE_COLORS: Record<string, string> = {
  trigger:   'bg-purple-100 text-purple-700',
  action:    'bg-blue-100 text-blue-700',
  condition: 'bg-amber-100 text-amber-700',
  delay:     'bg-gray-100 text-gray-600',
};

// ── Logs Modal ─────────────────────────────────────────────────────────────────
function LogsModal({ workflow, onClose }: { workflow: WFRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0">
          <div>
            <h3 className="font-headline font-bold text-[#1c1410] text-[16px]">
              Execution Logs — <span className="text-primary">{workflow.name}</span>
            </h3>
            <p className="text-[12px] text-[#7a6b5c] mt-0.5">{mockLogs.length} execution records</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-black/5 bg-[#faf8f6]">
                <th className="w-10 px-4 py-3"><input type="checkbox" className="w-4 h-4 accent-primary" /></th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Contact</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Completed Action / Time</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Next Action</th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {mockLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#faf8f6] transition-colors align-top">
                  <td className="px-4 py-4"><input type="checkbox" className="w-4 h-4 accent-primary mt-1" /></td>
                  <td className="px-4 py-4 space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Completed</span>
                    <p className="font-semibold text-red-500">{log.contactName}</p>
                    <p className="text-[11px] text-[#7a6b5c]"><span className="font-medium text-[#1c1410]">Enrolled:</span> {log.enrolledAt}</p>
                    <p className="text-[11px] text-[#7a6b5c]"><span className="font-medium text-[#1c1410]">Outcome:</span> {log.outcome}</p>
                    {log.appointmentDate && (
                      <p className="text-[11px] text-[#7a6b5c] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {log.appointmentDate}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-[#1c1410]">{log.completedAction}</p>
                    <p className="text-[11px] text-[#7a6b5c] mt-0.5">{log.completedAt}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-50 text-green-700 max-w-[180px] leading-snug">{log.nextAction}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 bg-gray-100 text-[#7a6b5c] text-[11px] font-bold px-3 py-1.5 rounded-lg w-fit">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> COMPLETED
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-t border-black/5 bg-[#faf8f6] shrink-0">
          <div className="flex items-center gap-2">
            <select className="border border-gray-200 rounded-lg px-2 py-1 text-[12px] outline-none bg-white">
              <option>10</option><option>25</option><option>50</option>
            </select>
            <span className="text-[11px] text-[#7a6b5c]">rows per page</span>
          </div>
          <p className="text-[11px] text-[#7a6b5c]">Showing 1–{mockLogs.length} of {mockLogs.length} records</p>
        </div>
      </div>
    </div>
  );
}

// ── Create Folder Modal ────────────────────────────────────────────────────────
function CreateFolderModal({
  workflows,
  onClose,
  onConfirm,
}: {
  workflows: WFRecord[];
  onClose: () => void;
  onConfirm: (name: string, workflowIds: string[]) => void;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const toggleWF = (id: string) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleConfirm = () => {
    if (!name.trim()) { toast.error('Folder name is required'); return; }
    onConfirm(name.trim(), selected);
  };

  const gradientStyle = { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-black/5 shrink-0">
          <div>
            <h3 className="font-headline font-bold text-[#1c1410] text-[17px]">Create Folder</h3>
            <p className="text-[12px] text-[#7a6b5c] mt-0.5">Folder will help to organize Automation</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#7a6b5c] transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Folder Name */}
          <div>
            <label className="text-[12px] font-semibold text-[#7a6b5c] mb-1.5 block">
              Folder Name <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] text-[#1c1410] outline-none focus:border-primary/40 placeholder:text-gray-300 transition-colors"
              placeholder="Folder Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Assign Workflows (optional) */}
          {workflows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-semibold text-[#7a6b5c]">
                  Add Workflows <span className="text-[#b09e8d] font-normal">(optional)</span>
                </label>
                {selected.length > 0 && (
                  <span className="text-[11px] text-primary font-semibold">{selected.length} selected</span>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {workflows.map((wf) => (
                  <label key={wf.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#faf8f6] transition-colors">
                    <input
                      type="checkbox"
                      checked={selected.includes(wf.id)}
                      onChange={() => toggleWF(wf.id)}
                      className="w-4 h-4 accent-primary shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#1c1410] truncate">{wf.name}</p>
                      <p className="text-[11px] text-[#7a6b5c] truncate">{wf.description}</p>
                    </div>
                    <span className={cn('ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', wf.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                      {wf.status}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/5 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold text-[#7a6b5c] hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5"
            style={{ ...gradientStyle, boxShadow: '0 4px 14px rgba(234,88,12,0.3)' }}
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toggle Switch ──────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn('relative w-10 h-5.5 rounded-full transition-all duration-200 shrink-0', checked ? 'bg-emerald-400' : 'bg-gray-200')}
      style={{ height: '22px' }}
    >
      <span
        className={cn('absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all duration-200', checked ? 'left-[calc(100%-20px)]' : 'left-0.5')}
        style={{ width: '18px', height: '18px' }}
      />
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AutomationPage() {
  const navigate = useNavigate();

  // ── Zustand store (persists across navigation) ──
  const { wfRecords: storedWFs, wfFolders: folders, addWfRecord, updateWfRecord, deleteWfRecord, addWfFolder, deleteWfFolder, moveWfToFolder } = useCrmStore();

  // Merge mock initial workflows with any user-created ones from the store
  const workflows = useMemo(() => {
    const storeIds = new Set(storedWFs.map((w) => w.id));
    const base = initialWorkflows.filter((w) => !storeIds.has(w.id));
    return [...storedWFs, ...base];
  }, [storedWFs]);

  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [logsWorkflow, setLogsWorkflow] = useState<WFRecord | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    let list = [...workflows];
    if (search) list = list.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter === 'Active') list = list.filter((w) => w.status === 'active');
    if (statusFilter === 'Inactive') list = list.filter((w) => w.status === 'inactive');
    return list;
  }, [workflows, search, statusFilter]);

  const stats = useMemo(() => ({
    total: workflows.length,
    active: workflows.filter((w) => w.status === 'active').length,
    inactive: workflows.filter((w) => w.status === 'inactive').length,
    contacts: workflows.reduce((s, w) => s + w.totalContacts, 0),
  }), [workflows]);

  const toggleStatus = (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    const newStatus = wf.status === 'active' ? 'inactive' as const : 'active' as const;
    if (storedWFs.find((w) => w.id === id)) {
      updateWfRecord(id, { status: newStatus });
    } else {
      addWfRecord({ ...wf, status: newStatus });
    }
  };

  const deleteWorkflow = (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    deleteWfRecord(id);
    toast.success(`"${wf?.name}" deleted`);
    setOpenMenu(null);
  };

  const duplicateWorkflow = (wf: WFRecord) => {
    const copy: WFRecord = { ...wf, id: `wf-${Date.now()}`, name: `${wf.name} (Copy)`, totalContacts: 0, completed: 0, completedNodes: 0, status: 'inactive' };
    addWfRecord(copy);
    toast.success('Workflow duplicated');
    setOpenMenu(null);
  };

  const setWorkflowsLocal = (updater: (prev: WFRecord[]) => WFRecord[]) => {
    // Used for inline checkbox changes (allowReentry) — update store
    const updated = updater(workflows);
    updated.forEach((w) => {
      const orig = workflows.find((o) => o.id === w.id);
      if (orig && JSON.stringify(orig) !== JSON.stringify(w)) {
        updateWfRecord(w.id, w);
        if (!storedWFs.find((s) => s.id === w.id)) addWfRecord(w);
      }
    });
  };

  const toggleSelect = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleSelectAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((w) => w.id));

  const createFolder = (name: string, workflowIds: string[]) => {
    const newFolder: WFFolder = { id: `folder-${Date.now()}`, name, workflowIds };
    addWfFolder(newFolder);
    setExpandedFolders((prev) => [...prev, newFolder.id]);
    setShowFolderModal(false);
    toast.success(`Folder "${name}" created`);
  };

  const toggleFolder = (id: string) =>
    setExpandedFolders((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const deleteFolder = (id: string) => {
    const folder = folders.find((f) => f.id === id);
    deleteWfFolder(id);
    toast.success(`Folder "${folder?.name}" deleted`);
  };

  // Workflows NOT inside any folder
  const folderWorkflowIds = new Set(folders.flatMap((f) => f.workflowIds));
  const standaloneFiltered = filtered.filter((w) => !folderWorkflowIds.has(w.id));

  const handleNew = () => {
    const id = `wf-${Date.now()}`;
    const newWF: WFRecord = {
      id, name: 'Untitled Automation', description: 'New workflow',
      allowReentry: false, totalContacts: 0, completed: 0, completedNodes: 0,
      lastUpdated: 'just now', status: 'inactive',
      nodes: [{ id: 'n1', type: 'trigger', actionType: '', label: 'Select Trigger', config: {} }],
    };
    addWfRecord(newWF);
    navigate(`/automation/editor/${id}`, { state: { workflow: newWF } });
  };

  const gradientStyle = { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' };
  const shadowStyle = { ...gradientStyle, boxShadow: '0 4px 14px rgba(234,88,12,0.3)' };

  const statCards = [
    { label: 'Total Workflows', value: stats.total, icon: Zap, accent: false },
    { label: 'Active', value: stats.active, icon: Activity, accent: false },
    { label: 'Inactive', value: stats.inactive, icon: ToggleLeft, accent: false },
    { label: 'Contacts Enrolled', value: stats.contacts, icon: Users, accent: true },
  ];

  return (
    <div className="flex flex-col flex-1 animate-fade-in">

      {/* ── Action ── */}
      <div className="flex justify-end pb-3">
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 shrink-0"
          style={shadowStyle}
        >
          <Plus className="w-4 h-4" /> Create Workflow
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 pb-5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-white border border-black/10 rounded-xl outline-none focus:border-primary/40 placeholder:text-gray-400 transition-all"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center bg-white rounded-xl border border-black/10 p-1 gap-0.5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {(['All', 'Active', 'Inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors',
                statusFilter === s ? 'bg-primary text-white shadow-sm' : 'text-[#7a6b5c] hover:text-[#1c1410]'
              )}
            >
              {s === 'Inactive' ? 'Paused' : s}
              <span className={cn('ml-1.5 text-[10px]', statusFilter === s ? 'opacity-75' : 'opacity-50')}>
                {s === 'All' ? workflows.length : s === 'Active' ? stats.active : stats.inactive}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Workflow grid ── */}
      {filtered.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-[16px] font-bold text-[#1c1410] mb-1.5">
            {search ? 'No workflows match your search' : 'No workflows yet'}
          </h3>
          <p className="text-[13px] text-[#7a6b5c] mb-5 max-w-sm">
            {search ? 'Try a different search or clear the filters.' : 'Create your first workflow to automate actions on leads.'}
          </p>
          {!search && (
            <button onClick={handleNew} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white" style={shadowStyle}>
              <Plus className="w-4 h-4" /> Create your first workflow
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {filtered.map((wf) => (
            <WorkflowCard
              key={wf.id}
              wf={wf}
              onOpen={() => navigate(`/automation/editor/${wf.id}`, { state: { workflow: wf } })}
              onToggle={() => toggleStatus(wf.id)}
              onDuplicate={() => duplicateWorkflow(wf)}
              onDelete={() => { if (window.confirm(`Delete "${wf.name}"? This cannot be undone.`)) deleteWorkflow(wf.id); }}
              onLogs={() => setLogsWorkflow(wf)}
              menuOpen={openMenu === wf.id}
              onToggleMenu={() => setOpenMenu(openMenu === wf.id ? null : wf.id)}
            />
          ))}
        </div>
      )}

      {/* ── Logs Modal ── */}
      {logsWorkflow && <LogsModal workflow={logsWorkflow} onClose={() => setLogsWorkflow(null)} />}
    </div>
  );
}

// ─── Workflow Row (simple one-liner) ──────────────────────────────────────────
function WorkflowCard({ wf, onOpen, onToggle, onDuplicate, onDelete, onLogs, menuOpen, onToggleMenu }: {
  wf: WFRecord;
  onOpen: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLogs: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  return (
    <div
      onClick={onOpen}
      className="group flex items-center gap-3 px-4 py-3 bg-white border-b border-black/[0.04] hover:bg-[#faf8f6] cursor-pointer transition-colors"
    >
      {/* Status dot */}
      <div className={cn('w-2 h-2 rounded-full shrink-0', wf.status === 'active' ? 'bg-green-500' : 'bg-gray-300')} />

      {/* Name */}
      <p className="font-semibold text-[14px] text-[#1c1410] flex-1 min-w-0 truncate">{wf.name}</p>

      {/* Enrolled count */}
      <span className="text-[12px] text-[#7a6b5c] shrink-0 hidden sm:inline">
        <span className="font-semibold text-[#1c1410]">{wf.totalContacts}</span> enrolled
      </span>

      {/* Status toggle */}
      <button
        onClick={stop(onToggle)}
        title={wf.status === 'active' ? 'Pause' : 'Activate'}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors shrink-0',
          wf.status === 'active' ? 'bg-primary' : 'bg-gray-200'
        )}
      >
        <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
          wf.status === 'active' ? 'translate-x-[18px]' : 'translate-x-0.5'
        )} />
      </button>

      {/* More menu */}
      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={stop(onToggleMenu)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7a6b5c] hover:bg-white hover:text-primary transition-colors"
          title="More"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={stop(onToggleMenu)} />
            <div className="absolute right-0 top-9 z-40 w-44 bg-white rounded-xl border border-black/5 shadow-xl py-1 overflow-hidden">
              <button onClick={stop(onOpen)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors text-left">
                <Pencil className="w-3.5 h-3.5 text-[#7a6b5c]" /> Edit
              </button>
              <button onClick={stop(onLogs)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors text-left">
                <Activity className="w-3.5 h-3.5 text-[#7a6b5c]" /> Execution Logs
              </button>
              <button onClick={stop(onDuplicate)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors text-left">
                <Copy className="w-3.5 h-3.5 text-[#7a6b5c]" /> Duplicate
              </button>
              <div className="border-t border-black/5 my-1" />
              <button onClick={stop(onDelete)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors text-left">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
