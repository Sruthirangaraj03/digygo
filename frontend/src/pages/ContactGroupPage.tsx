import { useState, useMemo } from 'react';
import {
  Layers, Users, Plus, Search, X, Pencil, Trash2, UserPlus, UserMinus,
  ChevronRight, Check, Tag, FolderPlus,
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

const gradStyle  = { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' };
const shadowStyle = { ...gradStyle, boxShadow: '0 4px 14px rgba(234,88,12,0.28)' };

const GROUP_COLORS = ['#ea580c', '#ef4444', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#d97706'];

interface ContactGroup {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  color: string;
  createdAt: string;
}

const INIT_GROUPS: ContactGroup[] = [
  { id: 'g1', name: 'Hot Leads',            description: 'High-intent leads ready to convert',                 memberIds: ['l1', 'l2', 'l3'],             color: '#ef4444', createdAt: '2024-11-10' },
  { id: 'g2', name: 'Enterprise Prospects',  description: 'Large companies evaluating our platform',            memberIds: ['l4', 'l5'],                   color: '#8b5cf6', createdAt: '2024-11-15' },
  { id: 'g3', name: 'SMB Segment',          description: 'Small and medium business owners',                   memberIds: ['l1', 'l6', 'l7', 'l8', 'l9'], color: '#3b82f6', createdAt: '2024-11-20' },
  { id: 'g4', name: 'Demo Scheduled',       description: 'Contacts with upcoming demos',                       memberIds: ['l2', 'l10'],                  color: '#22c55e', createdAt: '2024-12-01' },
  { id: 'g5', name: 'Nurture List',         description: 'Long-term nurture contacts not yet ready to buy',    memberIds: [],                             color: '#f97316', createdAt: '2024-12-05' },
  { id: 'g6', name: 'VIP Clients',          description: 'High-value customers and key accounts',              memberIds: ['l3'],                         color: '#d97706', createdAt: '2024-12-10' },
];

export default function ContactGroupPage() {
  const { leads } = useCrmStore();
  const [groups, setGroups] = useState<ContactGroup[]>(INIT_GROUPS);
  const [search, setSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Create form
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createColor, setCreateColor] = useState(GROUP_COLORS[0]);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createSelectedLeads, setCreateSelectedLeads] = useState<string[]>([]);
  const [createSearch, setCreateSearch] = useState('');

  // Edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  const totalMembers = groups.reduce((s, g) => s + g.memberIds.length, 0);
  const emptyGroups = groups.filter((g) => g.memberIds.length === 0).length;

  const filtered = groups.filter((g) => {
    if (!search.trim()) return true;
    return g.name.toLowerCase().includes(search.toLowerCase()) || g.description.toLowerCase().includes(search.toLowerCase());
  });

  const getLeadName = (id: string) => {
    const l = leads.find((x) => x.id === id);
    return l ? `${l.firstName} ${l.lastName}` : id;
  };
  const getLeadEmail = (id: string) => leads.find((x) => x.id === id)?.email ?? '';
  const getLeadSource = (id: string) => leads.find((x) => x.id === id)?.source ?? '';

  const handleCreate = () => {
    if (!createName.trim()) { toast.error('Group name is required'); return; }
    const newGroup: ContactGroup = {
      id: `g-${Date.now()}`,
      name: createName.trim(),
      description: createDesc.trim(),
      memberIds: createSelectedLeads,
      color: createColor,
      createdAt: format(new Date(), 'yyyy-MM-dd'),
    };
    setGroups((p) => [...p, newGroup]);
    toast.success(`"${newGroup.name}" created with ${createSelectedLeads.length} member(s)`);
    resetCreate();
  };

  const resetCreate = () => {
    setShowCreate(false);
    setCreateStep(1);
    setCreateName('');
    setCreateDesc('');
    setCreateColor(GROUP_COLORS[0]);
    setCreateSelectedLeads([]);
    setCreateSearch('');
  };

  const removeMember = (groupId: string, leadId: string) => {
    setGroups((p) => p.map((g) => g.id === groupId ? { ...g, memberIds: g.memberIds.filter((m) => m !== leadId) } : g));
    toast.success('Member removed');
  };

  const addMembers = (groupId: string, leadIds: string[]) => {
    setGroups((p) => p.map((g) => g.id === groupId ? { ...g, memberIds: [...new Set([...g.memberIds, ...leadIds])] } : g));
    toast.success(`${leadIds.length} member(s) added`);
    setShowAddMembers(false);
    setMemberSearch('');
  };

  const deleteGroup = (id: string) => {
    if (!window.confirm('Delete this group? Members will not be deleted.')) return;
    setGroups((p) => p.filter((g) => g.id !== id));
    if (selectedGroupId === id) setSelectedGroupId(null);
    toast.success('Group deleted');
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) { toast.error('Name is required'); return; }
    setGroups((p) => p.map((g) => g.id === id ? { ...g, name: editName.trim(), description: editDesc.trim() } : g));
    setEditingId(null);
    toast.success('Group updated');
  };

  const filteredCreateLeads = leads.filter((l) => {
    if (!createSearch.trim()) return true;
    const q = createSearch.toLowerCase();
    return l.firstName.toLowerCase().includes(q) || l.lastName.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
  });

  const filteredAddLeads = leads.filter((l) => {
    if (selectedGroup?.memberIds.includes(l.id)) return false;
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return l.firstName.toLowerCase().includes(q) || l.lastName.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Groups', value: groups.length, icon: Layers, color: 'text-primary' },
          { label: 'Total Members', value: totalMembers, icon: Users, color: 'text-emerald-500' },
          { label: 'Empty Groups', value: emptyGroups, icon: FolderPlus, color: 'text-amber-500' },
          { label: 'All Contacts', value: leads.length, icon: Users, color: 'text-primary' },
        ].map((s, idx) => {
          const isHighlight = idx === 3;
          return isHighlight ? (
            <div key={s.label} className="rounded-2xl px-5 py-4 flex items-center gap-4 text-white hover:-translate-y-0.5 transition-all duration-300"
              style={{ ...gradStyle, boxShadow: '0 6px 24px rgba(234,88,12,0.25)' }}>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0"><s.icon className="w-5 h-5 text-white" /></div>
              <div><p className="text-[12px] opacity-80">{s.label}</p><h3 className="font-headline text-[22px] font-bold tracking-tight leading-tight">{s.value}</h3></div>
            </div>
          ) : (
            <div key={s.label} className="bg-white rounded-2xl px-5 py-4 border border-black/5 flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-300" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0"><s.icon className={cn('w-5 h-5', s.color)} /></div>
              <div><p className="text-[12px] text-[#7a6b5c]">{s.label}</p><h3 className="font-headline text-[22px] font-bold text-[#1c1410] tracking-tight leading-tight">{s.value}</h3></div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups..."
            className="w-full pl-9 pr-10 py-2.5 text-[13px] bg-white border border-black/10 rounded-full outline-none focus:border-primary/40 placeholder:text-gray-400 transition-all"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-black/5 flex items-center justify-center text-[#b09e8d]"><X className="w-3 h-3" /></button>}
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5"
          style={shadowStyle}>
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      {/* Main: groups list + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">

        {/* Groups list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-black/5 py-16 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Layers className="w-10 h-10 mx-auto text-[#c4b09e] mb-3" />
              <p className="text-[14px] font-semibold text-[#1c1410]">{search ? 'No groups match' : 'No groups yet'}</p>
              <p className="text-[12px] text-[#7a6b5c] mt-1">{search ? 'Try a different search.' : 'Create your first group to organize contacts.'}</p>
            </div>
          )}
          {filtered.map((g) => {
            const isActive = selectedGroupId === g.id;
            return (
              <div key={g.id} onClick={() => setSelectedGroupId(g.id)}
                className={cn('bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-sm',
                  isActive ? 'border-primary/40 shadow-sm ring-1 ring-primary/20' : 'border-black/[0.06] hover:border-black/10'
                )} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: g.color + '18' }}>
                    <Layers className="w-4 h-4" style={{ color: g.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === g.id ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="w-full text-[13px] font-semibold text-[#1c1410] border border-primary/30 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/50" />
                        <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description"
                          className="w-full text-[12px] text-[#7a6b5c] border border-black/10 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/30" />
                        <div className="flex gap-1.5">
                          <button onClick={() => saveEdit(g.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-primary hover:bg-primary/90"><Check className="w-3 h-3" /> Save</button>
                          <button onClick={() => setEditingId(null)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#7a6b5c] hover:bg-[#f5ede3]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[13px] font-bold text-[#1c1410] truncate">{g.name}</p>
                        <p className="text-[11px] text-[#7a6b5c] mt-0.5 line-clamp-1">{g.description || 'No description'}</p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-center">
                      <p className="font-headline text-[16px] font-bold text-[#1c1410] leading-tight">{g.memberIds.length}</p>
                      <p className="text-[9px] text-[#7a6b5c] uppercase tracking-wider">members</p>
                    </div>
                    <ChevronRight className={cn('w-4 h-4 transition-colors', isActive ? 'text-primary' : 'text-[#c4b09e]')} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {!selectedGroup ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-primary/50" />
              </div>
              <p className="text-[14px] font-semibold text-[#1c1410] mb-1">Select a group</p>
              <p className="text-[12px] text-[#7a6b5c] max-w-xs">Click on any group from the left to view and manage its members.</p>
            </div>
          ) : (
            <>
              {/* Group header */}
              <div className="px-6 py-5 border-b border-black/[0.04] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: selectedGroup.color + '18' }}>
                    <Layers className="w-5 h-5" style={{ color: selectedGroup.color }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-headline font-bold text-[16px] text-[#1c1410] truncate">{selectedGroup.name}</h3>
                    <p className="text-[12px] text-[#7a6b5c] mt-0.5">{selectedGroup.memberIds.length} members · Created {selectedGroup.createdAt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => { setEditingId(selectedGroup.id); setEditName(selectedGroup.name); setEditDesc(selectedGroup.description); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7a6b5c] hover:bg-[#f5ede3] hover:text-primary transition-colors" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowAddMembers(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-white transition-all hover:-translate-y-0.5" style={shadowStyle}>
                    <UserPlus className="w-3.5 h-3.5" /> Add
                  </button>
                  <button onClick={() => deleteGroup(selectedGroup.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#c4b09e] hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete group">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Members list */}
              {selectedGroup.memberIds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#f5ede3] flex items-center justify-center mb-3">
                    <UserPlus className="w-6 h-6 text-[#c4b09e]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#1c1410] mb-1">Empty group</p>
                  <p className="text-[12px] text-[#7a6b5c] mb-4">Add contacts to start using this group.</p>
                  <button onClick={() => setShowAddMembers(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white" style={shadowStyle}>
                    <UserPlus className="w-3.5 h-3.5" /> Add Members
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.04] max-h-[500px] overflow-y-auto scrollbar-hide">
                  {selectedGroup.memberIds.map((id) => {
                    const lead = leads.find((l) => l.id === id);
                    if (!lead) return null;
                    return (
                      <div key={id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-[#faf8f6] transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                          {lead.firstName[0]}{lead.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#1c1410] truncate">{lead.firstName} {lead.lastName}</p>
                          <p className="text-[11px] text-[#7a6b5c] truncate">{lead.email ? lead.email : <a href={`tel:${lead.phone}`} className="hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>{lead.phone}</a>}</p>
                        </div>
                        <span className="text-[11px] text-[#7a6b5c] bg-[#faf8f6] px-2 py-0.5 rounded-full hidden sm:block">{lead.source}</span>
                        <button onClick={() => removeMember(selectedGroup.id, id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#c4b09e] hover:bg-red-50 hover:text-red-500 transition-colors shrink-0" title="Remove">
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ CREATE GROUP MODAL — 2 steps ═══ */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <div>
                <h3 className="font-headline font-bold text-[16px] text-[#1c1410]">
                  {createStep === 1 ? 'Create Group' : 'Add Members'}
                </h3>
                <p className="text-[11px] text-[#7a6b5c] mt-0.5">Step {createStep} of 2 — {createStep === 1 ? 'Name & details' : 'Optional: add contacts now'}</p>
              </div>
              <button onClick={resetCreate} className="p-2 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c]"><X className="w-4 h-4" /></button>
            </div>

            {createStep === 1 ? (
              <div className="p-6 space-y-5">
                <div>
                  <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Group Name <span className="text-red-500">*</span></label>
                  <input autoFocus value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Hot Leads, VIP Clients..."
                    className="w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-primary/40 placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Description</label>
                  <input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="What is this group for?"
                    className="w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-primary/40 placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#1c1410] mb-2 block">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {GROUP_COLORS.map((c) => (
                      <button key={c} onClick={() => setCreateColor(c)}
                        className={cn('w-8 h-8 rounded-full transition-all', createColor === c ? 'ring-2 ring-offset-2 ring-[#1c1410] scale-110' : 'hover:scale-110')}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={resetCreate} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#f5ede3] transition-colors">Cancel</button>
                  <button onClick={() => { if (!createName.trim()) { toast.error('Name is required'); return; } setCreateStep(2); }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5" style={shadowStyle}>
                    Next — Add Members
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
                <div className="px-6 pt-4 pb-3 space-y-3 shrink-0">
                  <div className="flex items-center gap-2 p-3 bg-[#faf8f6] rounded-xl border border-black/[0.04]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: createColor + '18' }}>
                      <Layers className="w-3.5 h-3.5" style={{ color: createColor }} />
                    </div>
                    <span className="text-[13px] font-bold text-[#1c1410]">{createName}</span>
                    {createSelectedLeads.length > 0 && (
                      <span className="ml-auto text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{createSelectedLeads.length} selected</span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
                    <input value={createSearch} onChange={(e) => setCreateSearch(e.target.value)} placeholder="Search contacts to add..."
                      className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-white border border-black/10 rounded-xl outline-none focus:border-primary/40 placeholder:text-gray-400" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04] px-2">
                  {filteredCreateLeads.map((l) => {
                    const checked = createSelectedLeads.includes(l.id);
                    return (
                      <label key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf8f6] cursor-pointer rounded-xl transition-colors">
                        <input type="checkbox" checked={checked}
                          onChange={() => setCreateSelectedLeads((p) => checked ? p.filter((x) => x !== l.id) : [...p, l.id])}
                          className="w-4 h-4 accent-primary" />
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {l.firstName[0]}{l.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#1c1410] truncate">{l.firstName} {l.lastName}</p>
                          <p className="text-[11px] text-[#7a6b5c] truncate">{l.email ? l.email : <a href={`tel:${l.phone}`} className="hover:text-primary transition-colors">{l.phone}</a>}</p>
                        </div>
                        <span className="text-[10px] text-[#7a6b5c] bg-[#faf8f6] px-2 py-0.5 rounded-full">{l.source}</span>
                      </label>
                    );
                  })}
                  {filteredCreateLeads.length === 0 && <p className="text-center py-8 text-[13px] text-[#7a6b5c]">No contacts found.</p>}
                </div>
                <div className="px-6 py-4 border-t border-black/5 flex gap-3 shrink-0">
                  <button onClick={() => setCreateStep(1)} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#f5ede3] transition-colors">Back</button>
                  <button onClick={handleCreate}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5" style={shadowStyle}>
                    {createSelectedLeads.length > 0 ? `Create with ${createSelectedLeads.length} member(s)` : 'Create Empty Group'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ADD MEMBERS MODAL ═══ */}
      {showAddMembers && selectedGroup && (
        <AddMembersModal
          group={selectedGroup}
          leads={filteredAddLeads}
          search={memberSearch}
          onSearchChange={setMemberSearch}
          onAdd={(ids) => addMembers(selectedGroup.id, ids)}
          onClose={() => { setShowAddMembers(false); setMemberSearch(''); }}
        />
      )}
    </div>
  );
}

function AddMembersModal({ group, leads, search, onSearchChange, onAdd, onClose }: {
  group: ContactGroup; leads: { id: string; firstName: string; lastName: string; email: string; phone: string; source: string }[];
  search: string; onSearchChange: (v: string) => void; onAdd: (ids: string[]) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const shadowStyle = { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 4px 14px rgba(234,88,12,0.28)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0">
          <div>
            <h3 className="font-headline font-bold text-[15px] text-[#1c1410]">Add to "{group.name}"</h3>
            {selected.length > 0 && <p className="text-[11px] text-primary font-semibold mt-0.5">{selected.length} selected</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c]"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
            <input autoFocus value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search contacts..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-white border border-black/10 rounded-xl outline-none focus:border-primary/40 placeholder:text-gray-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04] px-2">
          {leads.map((l) => {
            const checked = selected.includes(l.id);
            return (
              <label key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf8f6] cursor-pointer rounded-xl transition-colors">
                <input type="checkbox" checked={checked} onChange={() => toggle(l.id)} className="w-4 h-4 accent-primary" />
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {l.firstName[0]}{l.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1c1410] truncate">{l.firstName} {l.lastName}</p>
                  <p className="text-[11px] text-[#7a6b5c] truncate">{l.email ? l.email : <a href={`tel:${l.phone}`} className="hover:text-primary transition-colors">{l.phone}</a>}</p>
                </div>
              </label>
            );
          })}
          {leads.length === 0 && <p className="text-center py-8 text-[13px] text-[#7a6b5c]">No contacts available to add.</p>}
        </div>
        <div className="px-6 py-4 border-t border-black/5 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#f5ede3] transition-colors">Cancel</button>
          <button onClick={() => { if (selected.length === 0) { toast.error('Select at least one contact'); return; } onAdd(selected); }}
            disabled={selected.length === 0}
            className={cn('flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all', selected.length > 0 ? 'hover:-translate-y-0.5' : 'opacity-50 cursor-not-allowed')}
            style={shadowStyle}>
            Add {selected.length > 0 ? `${selected.length} Member(s)` : 'Members'}
          </button>
        </div>
      </div>
    </div>
  );
}
