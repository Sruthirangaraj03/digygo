import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Shield, ShieldCheck, User, X, Check, MoreHorizontal,
  Mail, UserMinus, UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCrmStore } from '@/store/crmStore';
import { StaffMember } from '@/data/mockData';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const roleBadge: Record<string, string> = {
  admin: 'bg-primary/10 text-primary',
  manager: 'bg-purple-100 text-purple-700',
  agent: 'bg-muted text-muted-foreground',
};

const basePermissions: Record<string, string[]> = {
  Leads: ['view_all', 'view_own', 'create', 'edit', 'delete', 'export', 'import', 'assign'],
  Pipeline: ['manage'],
  Automation: ['view', 'manage'],
  Inbox: ['view_all', 'view_own', 'send'],
  Calendar: ['view_all', 'manage'],
  Staff: ['view', 'manage'],
  Settings: ['manage'],
  Reports: ['view'],
};

const defaultPerms = (role: string): Record<string, Record<string, boolean>> => {
  const result: Record<string, Record<string, boolean>> = {};
  Object.entries(basePermissions).forEach(([mod, perms]) => {
    result[mod] = {};
    perms.forEach((p) => {
      result[mod][p] = role === 'admin' || (role === 'manager' && p !== 'delete' && mod !== 'Settings');
    });
  });
  return result;
};

// ── Invite / Edit Staff Modal ──────────────────────────────────────────────────

interface StaffModalProps {
  initial?: StaffMember | null;
  onClose: () => void;
  onSave: (data: { name: string; email: string; role: StaffMember['role'] }) => void;
}

function StaffModal({ initial, onClose, onSave }: StaffModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [role, setRole] = useState<StaffMember['role']>(initial?.role ?? 'agent');

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!email.trim() || !email.includes('@')) { toast.error('Valid email is required'); return; }
    onSave({ name: name.trim(), email: email.trim(), role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="font-headline font-bold text-[#1c1410]">{initial ? 'Edit Staff Member' : 'Invite Staff'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5ede3]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ranjith Kumar" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ranjith@company.com" className="pl-9" type="email" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'manager', 'agent'] as const).map((r) => {
                const Icon = r === 'admin' ? ShieldCheck : r === 'manager' ? Shield : User;
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all capitalize', role === r ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-[#f5ede3]')}
                  >
                    <Icon className="w-5 h-5" />
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
          {!initial && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-[11px] text-[#7a6b5c]">An invitation email will be sent to the provided address. The staff member can set their own password via the invite link.</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}><Check className="w-4 h-4 mr-1" /> {initial ? 'Save Changes' : 'Send Invite'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Role Modal ──────────────────────────────────────────────────────────

function CustomRoleModal({ onClose }: { onClose: () => void }) {
  const [roleName, setRoleName] = useState('');

  const handleCreate = () => {
    if (!roleName.trim()) { toast.error('Role name is required'); return; }
    toast.success(`Custom role "${roleName}" created`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="font-headline font-bold text-[#1c1410]">Create Custom Role</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5ede3]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Role Name *</label>
            <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Sales Lead, Support Tier 2" />
          </div>
          <p className="text-[11px] text-[#7a6b5c]">After creating the role, you can configure its specific permissions in the Roles & Permissions tab.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> Create Role</Button>
        </div>
      </div>
    </div>
  );
}

// ── Deactivate Confirm ─────────────────────────────────────────────────────────

function DeactivateDialog({ member, onClose, onConfirm }: { member: StaffMember; onClose: () => void; onConfirm: () => void }) {
  const isActive = member.status === 'active';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 w-full max-w-sm shadow-2xl p-6">
        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4', isActive ? 'bg-red-100' : 'bg-green-100')}>
          {isActive ? <UserMinus className="w-5 h-5 text-destructive" /> : <UserCheck className="w-5 h-5 text-success" />}
        </div>
        <h3 className="font-headline font-bold text-[#1c1410] text-center mb-2">{isActive ? 'Deactivate' : 'Reactivate'} {member.name}?</h3>
        <p className="text-[13px] text-[#7a6b5c] text-center mb-6">
          {isActive
            ? 'This member will lose access to the CRM immediately. Their data and lead assignments will be preserved.'
            : 'This member will regain access to the CRM with their previous role and permissions.'}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant={isActive ? 'destructive' : 'default'} className="flex-1" onClick={onConfirm}>
            {isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { staff, addStaff, updateStaff, deactivateStaff } = useCrmStore();
  const [searchParams] = useSearchParams();
  const tab = (searchParams.get('tab') ?? 'team') as 'team' | 'roles' | 'performance';
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [deactivateMember, setDeactivateMember] = useState<StaffMember | null>(null);
  const [showCustomRoleModal, setShowCustomRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [permissions, setPermissions] = useState<Record<string, Record<string, Record<string, boolean>>>>({
    admin: defaultPerms('admin'),
    manager: defaultPerms('manager'),
    agent: defaultPerms('agent'),
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Stable performance data — no Math.random() in render
  const perfData = useMemo(() => {
    return staff.filter((s) => s.status === 'active').map((s, i) => ({
      id: s.id,
      name: s.name,
      leadsHandled: s.leadsAssigned,
      converted: Math.floor(s.leadsAssigned * 0.3),
      avgResponse: [8, 12, 5, 22, 15, 9, 18, 11][i % 8],
      conversations: [87, 64, 110, 42, 95, 73, 58, 102][i % 8],
      followUps: [28, 19, 35, 12, 41, 22, 16, 31][i % 8],
    }));
  }, [staff]);

  const handleInvite = (data: { name: string; email: string; role: StaffMember['role'] }) => {
    const initials = data.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    addStaff({
      id: `s-${Date.now()}`,
      name: data.name,
      email: data.email,
      role: data.role,
      status: 'active',
      leadsAssigned: 0,
      lastActive: new Date().toISOString(),
      avatar: initials,
    });
    setShowInviteModal(false);
    toast.success(`Invite sent to ${data.email}`);
  };

  const handleEdit = (data: { name: string; email: string; role: StaffMember['role'] }) => {
    if (!editMember) return;
    const initials = data.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    updateStaff(editMember.id, { name: data.name, email: data.email, role: data.role, avatar: initials });
    setEditMember(null);
    toast.success('Staff member updated');
  };

  const handleDeactivate = () => {
    if (!deactivateMember) return;
    if (deactivateMember.status === 'active') {
      deactivateStaff(deactivateMember.id);
      toast.success(`${deactivateMember.name} deactivated`);
    } else {
      updateStaff(deactivateMember.id, { status: 'active' });
      toast.success(`${deactivateMember.name} reactivated`);
    }
    setDeactivateMember(null);
  };

  const togglePerm = (module: string, perm: string) => {
    setPermissions((prev) => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [module]: {
          ...prev[selectedRole]?.[module],
          [perm]: !prev[selectedRole]?.[module]?.[perm],
        },
      },
    }));
  };

  return (
    <div className="space-y-8">
      {tab === 'team' && (
        <div className="flex justify-end">
          <Button className="btn-hover" onClick={() => setShowInviteModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Invite Staff
          </Button>
        </div>
      )}

      {/* Team Tab */}
      {tab === 'team' && (
        <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/5 bg-[#faf8f6]">
                  {['Member', 'Role', 'Status', 'Leads', 'Last Active', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-black/5 last:border-0 hover:bg-[#faf8f6] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0', s.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                          {s.avatar}
                        </div>
                        <div>
                          <p className={cn('text-sm font-medium', s.status === 'inactive' && 'text-muted-foreground')}>{s.name}</p>
                          <p className="text-[11px] text-[#7a6b5c]">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('border-0 text-xs', roleBadge[s.role])}>{s.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', s.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground')} />
                        <span className="text-sm text-foreground capitalize">{s.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{s.leadsAssigned}</td>
                    <td className="px-4 py-3 text-[13px] text-[#7a6b5c] whitespace-nowrap">{formatDistanceToNow(new Date(s.lastActive), { addSuffix: true })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 relative">
                        <button
                          onClick={() => setEditMember(s)}
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                            className="p-1.5 rounded-md hover:bg-[#f5ede3] text-muted-foreground hover:text-foreground transition-colors"
                            title="More actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenuId === s.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-9 bg-card border border-black/5 rounded-xl shadow-xl z-50 w-44 py-1">
                                <button
                                  onClick={() => { setDeactivateMember(s); setOpenMenuId(null); }}
                                  className={cn('w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors', s.status === 'active' ? 'hover:bg-red-50 text-destructive' : 'hover:bg-green-50 text-green-700')}
                                >
                                  {s.status === 'active' ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                  {s.status === 'active' ? 'Deactivate' : 'Reactivate'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-black/5 bg-[#faf8f6] flex items-center justify-between">
            <p className="text-[11px] text-[#7a6b5c]">{staff.filter((s) => s.status === 'active').length} active · {staff.filter((s) => s.status === 'inactive').length} inactive</p>
          </div>
        </div>
      )}

      {/* Roles & Permissions Tab */}
      {tab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl border border-black/5 card-shadow p-4 space-y-1">
            {['admin', 'manager', 'agent'].map((role) => {
              const Icon = role === 'admin' ? ShieldCheck : role === 'manager' ? Shield : User;
              const count = staff.filter((s) => s.role === role && s.status === 'active').length;
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={cn('w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors', selectedRole === role ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-[#f5ede3]')}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left capitalize">{role}</span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
                </button>
              );
            })}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setShowCustomRoleModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Custom Role
            </Button>
          </div>

          <div className="lg:col-span-3 bg-white rounded-2xl border border-black/5 card-shadow p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-headline font-bold text-[#1c1410] capitalize">{selectedRole} Permissions</h3>
              <Button size="sm" onClick={() => toast.success('Permissions saved')}>
                <Check className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
            <div className="space-y-8">
              {Object.entries(basePermissions).map(([module, perms]) => (
                <div key={module}>
                  <h4 className="text-sm font-headline font-bold text-[#1c1410] mb-3">{module}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {perms.map((perm) => (
                      <div key={perm} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#faf8f6] border border-black/5/50">
                        <span className="text-xs text-foreground">{perm.replace(/_/g, ' ')}</span>
                        <Switch
                          checked={permissions[selectedRole]?.[module]?.[perm] ?? false}
                          onCheckedChange={() => togglePerm(module, perm)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {tab === 'performance' && (
        <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/5 bg-[#faf8f6]">
                  {['Name', 'Leads Handled', 'Converted', 'Conv. Rate', 'Avg Response', 'Conversations', 'Follow-ups'].map((h) => (
                    <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perfData.map((p) => {
                  const convRate = Math.round((p.converted / p.leadsHandled) * 100);
                  return (
                    <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-[#faf8f6] transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{p.leadsHandled}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{p.converted}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${convRate}%` }} />
                          </div>
                          <span className="text-[11px] text-[#7a6b5c]">{convRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#7a6b5c]">{p.avgResponse} min</td>
                      <td className="px-4 py-3 text-sm text-foreground">{p.conversations}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{p.followUps}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showInviteModal && <StaffModal onClose={() => setShowInviteModal(false)} onSave={handleInvite} />}
      {editMember && <StaffModal initial={editMember} onClose={() => setEditMember(null)} onSave={handleEdit} />}
      {deactivateMember && <DeactivateDialog member={deactivateMember} onClose={() => setDeactivateMember(null)} onConfirm={handleDeactivate} />}
      {showCustomRoleModal && <CustomRoleModal onClose={() => setShowCustomRoleModal(false)} />}
    </div>
  );
}
