import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Check, Eye, EyeOff, RefreshCw, Copy, ExternalLink, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function WhatsAppSetupPage() {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('+91 98765 43210');
  const [accessToken, setAccessToken] = useState('EAABwzLixnjYBO3zJ2GtM0p...');
  const [wabaId, setWabaId] = useState('234567891234567');
  const [phoneNumberId, setPhoneNumberId] = useState('109876543210987');
  const [webhookSecret, setWebhookSecret] = useState('whsec_8fKdm2xLpQnR3vT5yWzC');
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [autoAssign, setAutoAssign] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const webhookUrl = 'https://digygocrm.com/webhooks/whatsapp/inbound';

  const handleSave = () => {
    if (!phoneNumber || !accessToken || !wabaId || !phoneNumberId) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('WhatsApp configuration saved');
    }, 1200);
  };

  const handleTest = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast.success('Test message sent successfully');
    }, 1800);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/lead-generation')}
          className="p-2 rounded-xl hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-[#1c1410] transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Status Banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-800">WhatsApp Business Connected</p>
          <p className="text-xs text-green-700 mt-0.5">{phoneNumber} · 234 leads captured this month</p>
        </div>
        <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0">
          <Check className="w-3 h-3 mr-1" /> Active
        </Badge>
      </div>

      {/* WABA Credentials */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-headline font-bold text-[#1c1410]">WABA Credentials</h3>
          <Button variant="outline" size="sm" onClick={() => window.open('https://developers.facebook.com/docs/whatsapp', '_blank')}>
            <ExternalLink className="w-3 h-3 mr-1" /> Meta Docs
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Phone Number *</label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">WABA ID *</label>
            <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WhatsApp Business Account ID" className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Phone Number ID *</label>
            <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Phone Number ID from Meta" className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Access Token *</label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAABwzLix..."
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Webhook */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6 space-y-4">
        <h3 className="font-headline font-bold text-[#1c1410]">Webhook Configuration</h3>
        <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
          <p className="text-[11px] text-[#7a6b5c]">Add this webhook URL in your Meta App Dashboard under WhatsApp → Configuration.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Inbound Webhook URL</label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="flex-1 font-mono text-sm bg-[#faf8f6]" />
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copied'); }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Webhook Verify Token</label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Verify token"
              className="pr-20 font-mono text-sm"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(webhookSecret); toast.success('Copied'); }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Automation Settings */}
      <div className="bg-white rounded-2xl border border-black/5 card-shadow p-6 space-y-4">
        <h3 className="font-headline font-bold text-[#1c1410]">Automation Settings</h3>
        <div className="space-y-4">
          {[
            { label: 'Auto-create Lead', description: 'Create a new lead in CRM for every new WhatsApp contact', value: true, onChange: () => toast.info('This is always enabled') },
            { label: 'Auto-assign to Agent', description: 'Use assignment rules to route incoming WhatsApp leads', value: autoAssign, onChange: () => { setAutoAssign(!autoAssign); toast.success('Setting updated'); } },
            { label: 'Auto-reply on First Contact', description: 'Send a welcome message when a new contact messages you', value: autoReply, onChange: () => { setAutoReply(!autoReply); toast.success('Setting updated'); } },
          ].map((setting) => (
            <div key={setting.label} className="flex items-center justify-between py-3 border-b border-black/5 last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{setting.label}</p>
                <p className="text-[11px] text-[#7a6b5c] mt-0.5">{setting.description}</p>
              </div>
              <Switch checked={setting.value} onCheckedChange={setting.onChange} />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : <><Check className="w-4 h-4 mr-1" /> Save Configuration</>}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Testing…</> : 'Send Test Message'}
        </Button>
      </div>
    </div>
  );
}
