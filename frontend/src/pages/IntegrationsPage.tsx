import { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, RefreshCw, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

type IntegStatus = 'connected' | 'available' | 'coming_soon';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegStatus;
  iconBg: string;
  iconText: string;
  apiKeyField?: string;
}

const integrations: Integration[] = [
  { id: 'meta', name: 'Meta (Facebook & Instagram)', description: 'Lead ads, form sync, and audience management', category: 'Lead Capture', status: 'connected', iconBg: 'bg-blue-100 text-blue-600', iconText: 'f' },
  { id: 'whatsapp', name: 'WhatsApp Business API', description: 'Two-way messaging, lead capture, and templates', category: 'Lead Capture', status: 'connected', iconBg: 'bg-green-100 text-green-600', iconText: 'W' },
  { id: 'gmail', name: 'Gmail', description: 'Sync email threads with leads in CRM', category: 'Email', status: 'available', iconBg: 'bg-red-100 text-red-600', iconText: 'G', apiKeyField: 'OAuth' },
  { id: 'outlook', name: 'Outlook / Office 365', description: 'Connect your Microsoft email account', category: 'Email', status: 'coming_soon', iconBg: 'bg-blue-100 text-blue-700', iconText: 'O' },
  { id: 'slack', name: 'Slack', description: 'Get CRM notifications in Slack channels', category: 'Notifications', status: 'available', iconBg: 'bg-purple-100 text-purple-600', iconText: 'S', apiKeyField: 'Webhook URL' },
  { id: 'razorpay', name: 'Razorpay', description: 'Track payments and link to lead deals', category: 'Payments', status: 'available', iconBg: 'bg-indigo-100 text-indigo-600', iconText: 'R', apiKeyField: 'API Key' },
  { id: 'stripe', name: 'Stripe', description: 'Connect Stripe to track deal payments', category: 'Payments', status: 'coming_soon', iconBg: 'bg-violet-100 text-violet-600', iconText: 'S' },
  { id: 'zapier', name: 'Zapier', description: 'Connect NexCRM to 5000+ apps via Zapier', category: 'Automation', status: 'available', iconBg: 'bg-orange-100 text-orange-600', iconText: 'Z', apiKeyField: 'API Key' },
  { id: 'n8n', name: 'n8n', description: 'Open-source workflow automation platform', category: 'Automation', status: 'available', iconBg: 'bg-pink-100 text-pink-600', iconText: 'n', apiKeyField: 'Webhook URL' },
];

const categories = ['All', ...Array.from(new Set(integrations.map((i) => i.category)))];

function ConnectModal({ integ, onClose }: { integ: Integration; onClose: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!apiKey.trim()) { toast.error(`${integ.apiKeyField ?? 'API Key'} is required`); return; }
    setConnecting(true);
    try {
      const payload = integ.apiKeyField === 'Webhook URL'
        ? { webhook_url: apiKey.trim() }
        : { api_key: apiKey.trim() };
      await api.post(`/api/integrations/configs/${integ.id}`, payload);
      toast.success(`${integ.name} connected!`);
      onClose();
    } catch {
      toast.error(`Failed to connect ${integ.name}`);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <p className="text-[15px] font-bold text-[#1c1410]">Connect {integ.name}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#7a6b5c] transition-colors"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#faf8f6]">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0', integ.iconBg)}>{integ.iconText}</div>
            <div>
              <p className="text-[13px] font-semibold text-[#1c1410]">{integ.name}</p>
              <p className="text-[11px] text-[#7a6b5c]">{integ.description}</p>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#5c5245] mb-1.5 ml-1">{integ.apiKeyField ?? 'API Key'} *</label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={`Enter your ${integ.apiKeyField ?? 'API Key'}`} type={integ.apiKeyField === 'Webhook URL' ? 'url' : 'text'} />
          </div>
          <p className="text-[11px] text-[#7a6b5c]">Your credentials are encrypted and stored securely. They are never shared with third parties.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/5 bg-[#faf8f6]">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Connecting…</> : <><Check className="w-4 h-4 mr-1" /> Connect</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [connectInteg, setConnectInteg] = useState<Integration | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load real connection status for Meta
    api.get<{ connected: boolean }>('/api/integrations/meta/status')
      .then((r) => {
        setConnected((prev) => {
          const next = new Set(prev);
          if (r.connected) next.add('meta'); else next.delete('meta');
          return next;
        });
      }).catch(() => {});

    // Load generic integration configs
    api.get<Record<string, { is_active: boolean }>>('/api/integrations/configs')
      .then((configs) => {
        setConnected((prev) => {
          const next = new Set(prev);
          Object.entries(configs).forEach(([id, cfg]) => {
            if (cfg.is_active) next.add(id); else next.delete(id);
          });
          return next;
        });
      }).catch(() => {});
  }, []);

  const filtered = integrations.filter((i) => filter === 'All' || i.category === filter);
  const isConnected = (id: string) => connected.has(id);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-[#1c1410] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-xl whitespace-nowrap transition-all duration-200',
              filter === cat
                ? 'bg-[#fde8d5] text-primary font-semibold'
                : 'text-[#7a6b5c] hover:bg-[#f5ede3] hover:text-primary'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((integ) => {
          const conn = isConnected(integ.id);
          const isComingSoon = integ.status === 'coming_soon';
          return (
            <div key={integ.id} className="bg-white rounded-2xl border border-black/5 card-shadow p-5 flex flex-col gap-4 hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0', integ.iconBg)}>{integ.iconText}</div>
                  <div>
                    <p className="text-[13px] font-bold text-[#1c1410]">{integ.name}</p>
                    <p className="text-[11px] text-[#7a6b5c]">{integ.category}</p>
                  </div>
                </div>
                <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0',
                  conn && !isComingSoon ? 'bg-emerald-500/10 text-emerald-600' :
                  isComingSoon ? 'bg-yellow-100 text-yellow-700' :
                  'bg-muted text-[#7a6b5c]'
                )}>
                  {conn && !isComingSoon ? <><Check className="w-2.5 h-2.5 inline mr-0.5" />Connected</> :
                   isComingSoon ? 'Soon' : 'Available'}
                </span>
              </div>
              <p className="text-[12px] text-[#7a6b5c] flex-1">{integ.description}</p>
              <div className="flex gap-2">
                {isComingSoon ? (
                  <Button variant="outline" size="sm" disabled className="flex-1">Coming Soon</Button>
                ) : conn ? (
                  <>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                      if (integ.id === 'meta') navigate('/lead-generation/meta-forms');
                      else toast.info(`Configure ${integ.name}`);
                    }}>Configure</Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-red-50" onClick={async () => {
                      try {
                        if (integ.id === 'meta') await api.delete('/api/integrations/meta/disconnect');
                        else await api.delete(`/api/integrations/configs/${integ.id}`);
                        setConnected((prev) => { const next = new Set(prev); next.delete(integ.id); return next; });
                        toast.success(`${integ.name} disconnected`);
                      } catch { toast.error('Failed to disconnect'); }
                    }}>Disconnect</Button>
                  </>
                ) : (
                  <Button size="sm" className="flex-1" onClick={() => {
                    if (integ.id === 'meta') navigate('/lead-generation/meta-forms');
                    else setConnectInteg(integ);
                  }}>
                    <Plug className="w-3.5 h-3.5 mr-1" /> Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {connectInteg && (
        <ConnectModal integ={connectInteg} onClose={() => {
          setConnected((prev) => { const next = new Set(prev); next.add(connectInteg.id); return next; });
          setConnectInteg(null);
        }} />
      )}
    </div>
  );
}
