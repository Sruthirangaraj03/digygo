import { useState } from 'react';
import { Shuffle, Plus, Trash2, GripVertical, ArrowLeft, Check, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { staff } from '@/data/mockData';

type AssignMethod = 'round-robin' | 'source' | 'stage' | 'manual';

interface AssignRule {
  id: string;
  name: string;
  method: AssignMethod;
  condition: string;
  assignTo: string;
  isActive: boolean;
}

const defaultRules: AssignRule[] = [
  { id: 'r1', name: 'Meta Forms → Ranjith', method: 'source', condition: 'Meta Forms', assignTo: 's1', isActive: true },
  { id: 'r2', name: 'WhatsApp → Priya', method: 'source', condition: 'WhatsApp', assignTo: 's2', isActive: true },
  { id: 'r3', name: 'Round-robin for Manual Leads', method: 'round-robin', condition: 'Manual', assignTo: '', isActive: true },
  { id: 'r4', name: 'Qualified Stage → Amit', method: 'stage', condition: 'Qualified', assignTo: 's3', isActive: false },
];

const SOURCES = ['Meta Forms', 'WhatsApp', 'Custom Form', 'Manual', 'Landing Page'];
const STAGES = ['New Leads', 'Contacted', 'Qualified', 'Proposal Sent', 'Closed Won'];

function RuleModal({ onClose, onSave }: { onClose: () => void; onSave: (r: Omit<AssignRule, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [method, setMethod] = useState<AssignMethod>('source');
  const [condition, setCondition] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const handleSave = () => {
    if (!name.trim()) { toast.error('Rule name is required'); return; }
    if (method !== 'round-robin' && !condition) { toast.error('Condition is required'); return; }
    onSave({ name: name.trim(), method, condition, assignTo, isActive: true });
  };

  const conditionOptions = method === 'source' ? SOURCES : method === 'stage' ? STAGES : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl border border-black/5 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="font-headline font-bold text-[#1c1410]">Add Assignment Rule</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5ede3]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Rule Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. WhatsApp Leads → Priya" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Assignment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {(['round-robin', 'source', 'stage', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn('p-2.5 rounded-xl border text-sm font-medium transition-all capitalize', method === m ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-[#f5ede3]')}
                >
                  {m.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
          {method !== 'round-robin' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">When {method === 'source' ? 'Source is' : 'Stage is'}</label>
              <select
                className="w-full border border-black/5 rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                <option value="">Select…</option>
                {conditionOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          )}
          {method !== 'round-robin' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Assign To</label>
              <select
                className="w-full border border-black/5 rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
              >
                <option value="">Select agent…</option>
                {staff.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {method === 'round-robin' && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-[11px] text-[#7a6b5c]">Leads matching this condition will be distributed evenly across all active agents.</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}><Check className="w-4 h-4 mr-1" /> Add Rule</Button>
        </div>
      </div>
    </div>
  );
}

export default function AssignmentRulesPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState(defaultRules);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const deleteRule = (id: string) => {
    const rule = rules.find((r) => r.id === id);
    setRules(rules.filter((r) => r.id !== id));
    toast.success(`Rule "${rule?.name}" deleted`);
  };

  const handleAdd = (data: Omit<AssignRule, 'id'>) => {
    setRules([...rules, { ...data, id: `r-${Date.now()}` }]);
    setShowModal(false);
    toast.success(`Rule "${data.name}" added`);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); toast.success('Assignment rules saved'); }, 800);
  };

  const methodBadge: Record<AssignMethod, string> = {
    'round-robin': 'bg-blue-100 text-blue-700',
    source: 'bg-purple-100 text-purple-700',
    stage: 'bg-yellow-100 text-yellow-700',
    manual: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/settings')} className="p-2 rounded-lg hover:bg-[#f5ede3] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Button className="ml-auto" onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-1" /> Add Rule</Button>
      </div>

      <div className="p-4 bg-muted/40 rounded-xl border border-black/5 text-[13px] text-[#7a6b5c]">
        Rules are evaluated in order. The first matching rule wins. Drag to reorder priority.
      </div>

      <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
        {rules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shuffle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No assignment rules yet</p>
            <p className="text-sm mt-1">Add rules to automate lead distribution</p>
          </div>
        ) : (
          rules.map((rule, i) => {
            const assignee = staff.find((s) => s.id === rule.assignTo);
            return (
              <div key={rule.id} className={cn('flex items-center gap-3 px-4 py-3.5 border-b border-black/5 last:border-0 hover:bg-[#faf8f6] transition-colors', !rule.isActive && 'opacity-60')}>
                <button className="cursor-grab text-muted-foreground"><GripVertical className="w-4 h-4" /></button>
                <span className="text-[11px] text-[#7a6b5c] w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{rule.name}</p>
                  <p className="text-[11px] text-[#7a6b5c] mt-0.5">
                    {rule.method === 'round-robin'
                      ? 'Distribute evenly across all agents'
                      : `${rule.method === 'source' ? 'Source' : 'Stage'}: ${rule.condition} → ${assignee?.name ?? 'Unassigned'}`}
                  </p>
                </div>
                <Badge className={cn('border-0 text-xs shrink-0 capitalize', methodBadge[rule.method])}>
                  {rule.method.replace('-', ' ')}
                </Badge>
                <Switch checked={rule.isActive} onCheckedChange={() => toggleRule(rule.id)} />
                <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : <><Check className="w-4 h-4 mr-1" /> Save Rules</>}
        </Button>
        <Button variant="outline" onClick={() => navigate('/settings')}>Cancel</Button>
      </div>

      {showModal && <RuleModal onClose={() => setShowModal(false)} onSave={handleAdd} />}
    </div>
  );
}
