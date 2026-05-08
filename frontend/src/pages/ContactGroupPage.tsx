import { useState, useEffect, useMemo } from 'react';
import {
  Layers, Users, Plus, Search, X, Pencil, Trash2, UserPlus, UserMinus,
  ChevronRight, Check, FolderPlus, Filter, Loader2,
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { usePermission } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

const gradStyle   = { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' };
const shadowStyle = { ...gradStyle, boxShadow: '0 4px 14px rgba(234,88,12,0.28)' };

const GROUP_COLORS = ['#ea580c', '#ef4444', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#d97706'];

const SOURCES = [
  { value: 'Manual',           label: 'Manual' },
  { value: 'meta_form',        label: 'Meta Form' },
  { value: 'Custom Form',      label: 'Custom Form' },
  { value: 'WhatsApp',         label: 'WhatsApp' },
  { value: 'Import',           label: 'Import' },
  { value: 'landing_page',     label: 'Landing Page' },
  { value: 'calendar_booking', label: 'Calendar Booking' },
  { value: 'Referral',         label: 'Referral' },
  { value: 'Website',          label: 'Website' },
];

interface ContactGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  member_count: number;
  created_by_name: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  lead_id: string;
  added_by: string;
  added_at: string;
  lead_name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  tags: string[];
  pipeline_name: string;
  stage_name: string;
}

export default function ContactGroupPage() {
  const { leads, pipelines, tags: allTags } = useCrmStore();
  const canRead   = usePermission('contact_groups:read');
  const canManage = usePermission('contact_groups:manage');

  const [groups, setGroups]               = useState<ContactGroup[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers]             = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Create modal
  const [showCreate, setShowCreate]       = useState(false);
  const [createStep, setCreateStep]       = useState<1 | 2>(1);
  const [createName, setCreateName]       = useState('');
  const [createDesc, setCreateDesc]       = useState('');
  const [createColor, setCreateColor]     = useState(GROUP_COLORS[0]);
  const [createSearch, setCreateSearch]   = useState('');
  const [createSelected, setCreateSelected] = useState<string[]>([]);
  const [creating, setCreating]           = useState(false);

  // Edit inline
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editName, setEditName]           = useState('');
  const [editDesc, setEditDesc]           = useState('');

  // Add members modal
  const [showAddMembers, setShowAddMembers] = useState(false);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  // ── Fetch groups ────────────────────────────────────────────────────────────
  const fetchGroups = async () => {
    try {
      const data = await api.get<ContactGroup[]>('/api/contact-groups');
      setGroups(data);
    } catch {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  // ── Fetch members when group selected ──────────────────────────────────────
  useEffect(() => {
    if (!selectedGroupId) { setMembers([]); return; }
    setMembersLoading(true);
    api.get<GroupMember[]>(`/api/contact-groups/${selectedGroupId}/members`)
      .then(setMembers)
      .catch(() => toast.error('Failed to load members'))
      .finally(() => setMembersLoading(false));
  }, [selectedGroupId]);

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createName.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const group = await api.post<ContactGroup>('/api/contact-groups', {
        name: createName.trim(), description: createDesc.trim(), color: createColor,
      });
      if (createSelected.length > 0) {
        await api.post(`/api/contact-groups/${group.id}/members`, { lead_ids: createSelected });
        group.member_count = createSelected.length;
      }
      setGroups((p) => [{ ...group }, ...p]);
      toast.success(`"${group.name}" created with ${createSelected.length} member(s)`);
      resetCreate();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const resetCreate = () => {
    setShowCreate(false); setCreateStep(1); setCreateName(''); setCreateDesc('');
    setCreateColor(GROUP_COLORS[0]); setCreateSelected([]); setCreateSearch('');
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const saveEdit = async (id: string) => {
    if (!editName.trim()) { toast.error('Name is required'); return; }
    try {
      await api.patch(`/api/contact-groups/${id}`, { name: editName.trim(), description: editDesc.trim() });
      setGroups((p) => p.map((g) => g.id === id ? { ...g, name: editName.trim(), description: editDesc.trim() } : g));
      setEditingId(null);
      toast.success('Group updated');
    } catch { toast.error('Failed to update group'); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteGroup = async (id: string) => {
    if (!window.confirm('Delete this group? Members will not be deleted.')) return;
    try {
      await api.delete(`/api/contact-groups/${id}`);
      setGroups((p) => p.filter((g) => g.id !== id));
      if (selectedGroupId === id) setSelectedGroupId(null);
      toast.success('Group deleted');
    } catch { toast.error('Failed to delete group'); }
  };

  // ── Remove member ────────────────────────────────────────────────────────────
  const removeMember = async (groupId: string, leadId: string) => {
    try {
      await api.delete(`/api/contact-groups/${groupId}/members/${leadId}`);
      setMembers((p) => p.filter((m) => m.lead_id !== leadId));
      setGroups((p) => p.map((g) => g.id === groupId ? { ...g, member_count: g.member_count - 1 } : g));
      toast.success('Member removed');
    } catch { toast.error('Failed to remove member'); }
  };

  // ── After add members (refresh) ─────────────────────────────────────────────
  const handleMembersAdded = async (added: number) => {
    setShowAddMembers(false);
    if (!selectedGroupId) return;
    setGroups((p) => p.map((g) => g.id === selectedGroupId ? { ...g, member_count: g.member_count + added } : g));
    setMembersLoading(true);
    api.get<GroupMember[]>(`/api/contact-groups/${selectedGroupId}/members`)
      .then(setMembers)
      .catch(() => null)
      .finally(() => setMembersLoading(false));
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
  }, [groups, search]);

  const filteredCreateLeads = useMemo(() => {
    const q = createSearch.trim().toLowerCase();
    return leads.filter((l) => {
      if (!q) return true;
      return (`${l.firstName} ${l.lastName}`).toLowerCase().includes(q)
        || (l.email ?? '').toLowerCase().includes(q)
        || (l.phone ?? '').includes(q);
    });
  }, [leads, createSearch]);

  const totalMembers = groups.reduce((s, g) => s + g.member_count, 0);
  const emptyGroups  = groups.filter((g) => g.member_count === 0).length;

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Layers className="w-12 h-12 text-[#c4b09e] mb-3" />
        <p className="text-[15px] font-semibold text-[#1c1410]">No access</p>
        <p className="text-[13px] text-[#7a6b5c] mt-1">You don't have permission to view contact groups.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Groups',  value: groups.length,  icon: Layers,     color: 'text-primary' },
          { label: 'Total Members', value: totalMembers,   icon: Users,      color: 'text-emerald-500' },
          { label: 'Empty Groups',  value: emptyGroups,    icon: FolderPlus, color: 'text-amber-500' },
          { label: 'All Contacts',  value: leads.length,   icon: Users,      color: 'text-primary' },
        ].map((s, idx) => (
          idx === 3 ? (
            <div key={s.label} className="rounded-2xl px-5 py-4 flex items-center gap-4 text-white"
              style={{ ...gradStyle, boxShadow: '0 6px 24px rgba(234,88,12,0.25)' }}>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0"><s.icon className="w-5 h-5 text-white" /></div>
              <div><p className="text-[12px] opacity-80">{s.label}</p><h3 className="font-headline text-[22px] font-bold tracking-tight leading-tight">{s.value}</h3></div>
            </div>
          ) : (
            <div key={s.label} className="bg-white rounded-2xl px-5 py-4 border border-black/5 flex items-center gap-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0"><s.icon className={cn('w-5 h-5', s.color)} /></div>
              <div><p className="text-[12px] text-[#7a6b5c]">{s.label}</p><h3 className="font-headline text-[22px] font-bold text-[#1c1410] tracking-tight leading-tight">{s.value}</h3></div>
            </div>
          )
        ))}
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
        {canManage && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5"
            style={shadowStyle}>
            <Plus className="w-4 h-4" /> New Group
          </button>
        )}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">

        {/* Groups list */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary/40" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 py-16 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Layers className="w-10 h-10 mx-auto text-[#c4b09e] mb-3" />
              <p className="text-[14px] font-semibold text-[#1c1410]">{search ? 'No groups match' : 'No groups yet'}</p>
              <p className="text-[12px] text-[#7a6b5c] mt-1">{search ? 'Try a different search.' : 'Create your first group to get started.'}</p>
            </div>
          ) : filtered.map((g) => {
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
                          className="w-full text-[13px] font-semibold border border-primary/30 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/50" />
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
                      <p className="font-headline text-[16px] font-bold text-[#1c1410] leading-tight">{g.member_count}</p>
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
              <p className="text-[12px] text-[#7a6b5c] max-w-xs">Click a group on the left to view and manage its members.</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-5 border-b border-black/[0.04] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: selectedGroup.color + '18' }}>
                    <Layers className="w-5 h-5" style={{ color: selectedGroup.color }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-headline font-bold text-[16px] text-[#1c1410] truncate">{selectedGroup.name}</h3>
                    <p className="text-[12px] text-[#7a6b5c] mt-0.5">
                      {selectedGroup.member_count} members · Created {format(new Date(selectedGroup.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => { setEditingId(selectedGroup.id); setEditName(selectedGroup.name); setEditDesc(selectedGroup.description); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7a6b5c] hover:bg-[#f5ede3] hover:text-primary transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setShowAddMembers(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-white transition-all hover:-translate-y-0.5" style={shadowStyle}>
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </button>
                    <button onClick={() => deleteGroup(selectedGroup.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#c4b09e] hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {membersLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary/40" /></div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#f5ede3] flex items-center justify-center mb-3">
                    <UserPlus className="w-6 h-6 text-[#c4b09e]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#1c1410] mb-1">Empty group</p>
                  <p className="text-[12px] text-[#7a6b5c] mb-4">Add contacts manually or via automation.</p>
                  {canManage && (
                    <button onClick={() => setShowAddMembers(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white" style={shadowStyle}>
                      <UserPlus className="w-3.5 h-3.5" /> Add Members
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-black/[0.04] max-h-[500px] overflow-y-auto">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-[#faf8f6] transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                        {(m.lead_name ?? '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1c1410] truncate">{m.lead_name}</p>
                        <p className="text-[11px] text-[#7a6b5c] truncate">{m.email || m.phone}</p>
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                        {m.pipeline_name && <span className="text-[10px] text-[#7a6b5c] bg-[#faf8f6] px-2 py-0.5 rounded-full">{m.pipeline_name}</span>}
                        {m.stage_name    && <span className="text-[10px] text-primary/70 bg-primary/5 px-2 py-0.5 rounded-full">{m.stage_name}</span>}
                      </div>
                      <span className="text-[10px] text-[#9e8c7c] hidden md:block capitalize">{m.added_by}</span>
                      {canManage && (
                        <button onClick={() => removeMember(selectedGroup.id, m.lead_id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#c4b09e] hover:bg-red-50 hover:text-red-500 transition-colors shrink-0">
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── CREATE GROUP MODAL ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
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
                  <input autoFocus value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Batch 1, VIP Clients..."
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
                  <button onClick={resetCreate} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#f5ede3]">Cancel</button>
                  <button onClick={() => { if (!createName.trim()) { toast.error('Name is required'); return; } setCreateStep(2); }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5" style={shadowStyle}>
                    Next
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
                    {createSelected.length > 0 && (
                      <span className="ml-auto text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{createSelected.length} selected</span>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
                    <input value={createSearch} onChange={(e) => setCreateSearch(e.target.value)} placeholder="Search contacts..."
                      className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-white border border-black/10 rounded-xl outline-none focus:border-primary/40 placeholder:text-gray-400" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04] px-2">
                  {filteredCreateLeads.map((l) => {
                    const checked = createSelected.includes(l.id);
                    return (
                      <label key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf8f6] cursor-pointer rounded-xl transition-colors">
                        <input type="checkbox" checked={checked}
                          onChange={() => setCreateSelected((p) => checked ? p.filter((x) => x !== l.id) : [...p, l.id])}
                          className="w-4 h-4 accent-primary" />
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {l.firstName[0]}{l.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#1c1410] truncate">{l.firstName} {l.lastName}</p>
                          <p className="text-[11px] text-[#7a6b5c] truncate">{l.email || l.phone}</p>
                        </div>
                        <span className="text-[10px] text-[#7a6b5c] bg-[#faf8f6] px-2 py-0.5 rounded-full">{l.source}</span>
                      </label>
                    );
                  })}
                  {filteredCreateLeads.length === 0 && <p className="text-center py-8 text-[13px] text-[#7a6b5c]">No contacts found.</p>}
                </div>
                <div className="px-6 py-4 border-t border-black/5 flex gap-3 shrink-0">
                  <button onClick={() => setCreateStep(1)} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#f5ede3]">Back</button>
                  <button onClick={handleCreate} disabled={creating}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60" style={shadowStyle}>
                    {creating ? 'Creating...' : createSelected.length > 0 ? `Create with ${createSelected.length} member(s)` : 'Create Empty Group'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD MEMBERS MODAL ── */}
      {showAddMembers && selectedGroup && (
        <AddMembersModal
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          existingLeadIds={members.map((m) => m.lead_id)}
          leads={leads}
          pipelines={pipelines}
          allTags={allTags}
          onAdded={handleMembersAdded}
          onClose={() => setShowAddMembers(false)}
        />
      )}
    </div>
  );
}

// ── Add Members Modal ─────────────────────────────────────────────────────────
function AddMembersModal({ groupId, groupName, existingLeadIds, leads, pipelines, allTags, onAdded, onClose }: {
  groupId: string;
  groupName: string;
  existingLeadIds: string[];
  leads: any[];
  pipelines: any[];
  allTags: any[];
  onAdded: (added: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab]                     = useState<'search' | 'filter'>('search');
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState<string[]>([]);
  const [saving, setSaving]               = useState(false);

  // Filter tab state
  const [pipelineId, setPipelineId]       = useState('');
  const [stageId, setStageId]             = useState('');
  const [selectedTags, setSelectedTags]   = useState<string[]>([]);
  const [source, setSource]               = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [previewCount, setPreviewCount]   = useState<number | null>(null);
  const [previewing, setPreviewing]       = useState(false);

  const availableStages = pipelines.find((p: any) => p.id === pipelineId)?.stages ?? [];

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (existingLeadIds.includes(l.id)) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (`${l.firstName} ${l.lastName}`).toLowerCase().includes(q)
        || (l.email ?? '').toLowerCase().includes(q)
        || (l.phone ?? '').includes(q);
    });
  }, [leads, existingLeadIds, search]);

  const toggle = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleAddManual = async () => {
    if (selected.length === 0) { toast.error('Select at least one contact'); return; }
    setSaving(true);
    try {
      const res = await api.post<{ added: number }>(`/api/contact-groups/${groupId}/members`, { lead_ids: selected });
      toast.success(`${res.added} member(s) added`);
      onAdded(res.added);
    } catch { toast.error('Failed to add members'); }
    finally { setSaving(false); }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewCount(null);
    try {
      const res = await api.post<{ count: number }>(`/api/contact-groups/${groupId}/members/filter`, {
        pipeline_id: pipelineId || undefined,
        stage_id:    stageId    || undefined,
        tags:        selectedTags.length ? selectedTags : undefined,
        source:      source     || undefined,
        date_from:   dateFrom   || undefined,
        date_to:     dateTo     || undefined,
        preview: true,
      });
      setPreviewCount(res.count);
    } catch { toast.error('Preview failed'); }
    finally { setPreviewing(false); }
  };

  const handleAddFilter = async () => {
    setSaving(true);
    try {
      const res = await api.post<{ added: number; total: number }>(`/api/contact-groups/${groupId}/members/filter`, {
        pipeline_id: pipelineId || undefined,
        stage_id:    stageId    || undefined,
        tags:        selectedTags.length ? selectedTags : undefined,
        source:      source     || undefined,
        date_from:   dateFrom   || undefined,
        date_to:     dateTo     || undefined,
        preview: false,
      });
      toast.success(`${res.added} new member(s) added (${res.total} matched filter)`);
      onAdded(res.added);
    } catch { toast.error('Failed to add members'); }
    finally { setSaving(false); }
  };

  const tagNames = allTags.map((t: any) => (typeof t === 'string' ? t : t.name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0">
          <div>
            <h3 className="font-headline font-bold text-[15px] text-[#1c1410]">Add to "{groupName}"</h3>
            {tab === 'search' && selected.length > 0 && <p className="text-[11px] text-primary font-semibold mt-0.5">{selected.length} selected</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c]"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-black/5 shrink-0">
          {(['search', 'filter'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex-1 py-2.5 text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors',
                tab === t ? 'text-primary border-b-2 border-primary' : 'text-[#7a6b5c] hover:text-[#1c1410]'
              )}>
              {t === 'search' ? <><Search className="w-3.5 h-3.5" /> Search & Select</> : <><Filter className="w-3.5 h-3.5" /> From Filter</>}
            </button>
          ))}
        </div>

        {/* Tab: Search & Select */}
        {tab === 'search' && (<>
          <div className="px-6 pt-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone..."
                className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-white border border-black/10 rounded-xl outline-none focus:border-primary/40 placeholder:text-gray-400" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04] px-2">
            {filteredLeads.map((l) => {
              const checked = selected.includes(l.id);
              return (
                <label key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf8f6] cursor-pointer rounded-xl transition-colors">
                  <input type="checkbox" checked={checked} onChange={() => toggle(l.id)} className="w-4 h-4 accent-primary" />
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {l.firstName[0]}{l.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1c1410] truncate">{l.firstName} {l.lastName}</p>
                    <p className="text-[11px] text-[#7a6b5c] truncate">{l.email || l.phone}</p>
                  </div>
                  <span className="text-[10px] text-[#7a6b5c] bg-[#faf8f6] px-2 py-0.5 rounded-full">{l.source}</span>
                </label>
              );
            })}
            {filteredLeads.length === 0 && <p className="text-center py-8 text-[13px] text-[#7a6b5c]">No contacts available to add.</p>}
          </div>
          <div className="px-6 py-4 border-t border-black/5 flex gap-3 shrink-0">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#f5ede3]">Cancel</button>
            <button onClick={handleAddManual} disabled={selected.length === 0 || saving}
              className={cn('flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all', selected.length > 0 && !saving ? 'hover:-translate-y-0.5' : 'opacity-50 cursor-not-allowed')}
              style={shadowStyle}>
              {saving ? 'Adding...' : `Add ${selected.length > 0 ? `${selected.length} Member(s)` : 'Members'}`}
            </button>
          </div>
        </>)}

        {/* Tab: From Filter */}
        {tab === 'filter' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Pipeline */}
              <div>
                <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Pipeline</label>
                <select value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setStageId(''); setPreviewCount(null); }}
                  className="w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-primary/40 bg-white">
                  <option value="">Any pipeline</option>
                  {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {/* Stage */}
              <div>
                <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Stage</label>
                <select value={stageId} onChange={(e) => { setStageId(e.target.value); setPreviewCount(null); }}
                  disabled={!pipelineId}
                  className="w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-primary/40 bg-white disabled:opacity-50">
                  <option value="">Any stage</option>
                  {availableStages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {/* Tags */}
              <div>
                <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {tagNames.map((tag: string) => (
                    <button key={tag} onClick={() => { setSelectedTags((p) => p.includes(tag) ? p.filter((x) => x !== tag) : [...p, tag]); setPreviewCount(null); }}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                        selectedTags.includes(tag) ? 'bg-primary text-white border-primary' : 'bg-white text-[#7a6b5c] border-black/10 hover:border-primary/30'
                      )}>
                      {tag}
                    </button>
                  ))}
                  {tagNames.length === 0 && <p className="text-[12px] text-[#7a6b5c]">No tags available</p>}
                </div>
              </div>
              {/* Source */}
              <div>
                <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Source</label>
                <select value={source} onChange={(e) => { setSource(e.target.value); setPreviewCount(null); }}
                  className="w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-primary/40 bg-white">
                  <option value="">Any source</option>
                  {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Created From</label>
                  <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreviewCount(null); }}
                    className="w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-primary/40" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#1c1410] mb-1.5 block">Created To</label>
                  <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreviewCount(null); }}
                    className="w-full border border-black/10 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-primary/40" />
                </div>
              </div>

              {/* Preview result */}
              {previewCount !== null && (
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                  <Users className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-[13px] font-semibold text-primary">{previewCount} lead(s) match your filter</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-black/5 flex gap-3 shrink-0">
              <button onClick={handlePreview} disabled={previewing}
                className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 hover:bg-[#f5ede3] disabled:opacity-60 flex items-center justify-center gap-2">
                {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
                Preview Count
              </button>
              <button onClick={handleAddFilter} disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60" style={shadowStyle}>
                {saving ? 'Adding...' : previewCount !== null ? `Add ${previewCount} Lead(s)` : 'Add All Matches'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
