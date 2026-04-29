import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Facebook, FileText, ArrowRight, Users, Calendar, Zap } from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const getSourceLabel = (source: string) => {
  if (!source) return 'Unknown';
  const s = source.toLowerCase();
  if (s.includes('meta') || s.includes('facebook') || s.includes('instagram')) return 'Meta';
  if (s.includes('form') || s.includes('custom')) return 'Custom Form';
  if (s.includes('whatsapp')) return 'WhatsApp';
  return source;
};

const getSourceColor = (source: string) => {
  const s = getSourceLabel(source);
  if (s === 'Meta') return 'bg-blue-50 text-blue-600';
  if (s === 'Custom Form') return 'bg-primary/10 text-primary';
  if (s === 'WhatsApp') return 'bg-emerald-50 text-emerald-600';
  return 'bg-gray-100 text-gray-500';
};

export default function LeadGenerationPage() {
  const navigate = useNavigate();
  const { leads } = useCrmStore();
  const [formCount, setFormCount] = useState<number | null>(null);

  useEffect(() => {
    api.get<any[]>('/api/forms').then((f) => setFormCount(Array.isArray(f) ? f.length : 0)).catch(() => setFormCount(0));
  }, []);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const metaLeads   = leads.filter((l) => getSourceLabel(l.source ?? '') === 'Meta');
  const formLeads   = leads.filter((l) => getSourceLabel(l.source ?? '') === 'Custom Form');
  const thisMonth   = leads.filter((l) => new Date(l.createdAt) >= monthStart);
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  const statCards = [
    { label: 'Total Leads',   value: leads.length,    Icon: Users,     color: 'text-primary',      bg: 'bg-primary/10' },
    { label: 'From Meta',     value: metaLeads.length, Icon: Facebook,  color: 'text-blue-600',     bg: 'bg-blue-50' },
    { label: 'From Forms',    value: formLeads.length, Icon: FileText,  color: 'text-purple-600',   bg: 'bg-purple-50' },
    { label: 'This Month',    value: thisMonth.length, Icon: Calendar,  color: 'text-emerald-600',  bg: 'bg-emerald-50' },
  ];

  const channels = [
    {
      label: 'Meta Forms',
      description: 'Sync leads from Facebook & Instagram ad forms. Connect once — leads flow in automatically.',
      icon: Facebook,
      path: '/lead-generation/meta-forms',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      cta: 'Manage Meta Forms',
      badge: metaLeads.length > 0 ? `${metaLeads.length} leads` : null,
    },
    {
      label: 'Custom Forms',
      description: 'Build forms with drag-and-drop fields. Embed on any website or share as a link.',
      icon: FileText,
      path: '/lead-generation/custom-forms',
      color: 'text-primary',
      bg: 'bg-primary/10',
      cta: formCount != null && formCount > 0 ? `${formCount} form${formCount > 1 ? 's' : ''} active` : 'Create a Form',
      badge: formLeads.length > 0 ? `${formLeads.length} leads` : null,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-black/5 card-shadow p-4 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <div>
              <p className="text-[11px] text-[#7a6b5c] font-medium leading-none mb-1">{label}</p>
              <p className={cn('text-[20px] font-bold leading-none', color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Channel cards */}
      <div>
        <h3 className="text-[12px] font-bold text-[#7a6b5c] uppercase tracking-wider mb-3">Channels</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {channels.map((item) => (
            <div
              key={item.label}
              onClick={() => navigate(item.path)}
              className="group bg-white rounded-2xl border border-black/5 card-shadow p-5 flex flex-col gap-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', item.bg)}>
                    <item.icon className={cn('w-5 h-5', item.color)} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1c1410] text-[14px]">{item.label}</h4>
                    {item.badge && <span className={cn('text-[11px] font-medium', item.color)}>{item.badge}</span>}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#c4b09e] group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <p className="text-[12px] text-[#7a6b5c] leading-relaxed">{item.description}</p>
              <div className={cn('inline-flex items-center gap-1.5 text-[12px] font-semibold mt-auto', item.color)}>
                {item.cta} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent leads */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-bold text-[#7a6b5c] uppercase tracking-wider">Recent Leads</h3>
          <button onClick={() => navigate('/leads')} className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-black/5 card-shadow overflow-hidden">
          {recentLeads.length === 0 ? (
            <div className="py-10 text-center">
              <Zap className="w-8 h-8 text-[#e8d5c4] mx-auto mb-2" />
              <p className="text-[13px] text-[#b09e8d]">No leads yet — connect a form to start capturing.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#faf8f6] transition-colors cursor-pointer" onClick={() => navigate('/leads')}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)' }}>
                    {(lead.firstName ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1c1410] truncate">{lead.firstName} {lead.lastName}</p>
                    <p className="text-[11px] text-[#7a6b5c] truncate">{lead.phone}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', getSourceColor(lead.source ?? ''))}>
                      {getSourceLabel(lead.source ?? '')}
                    </span>
                    <span className="text-[11px] text-[#b09e8d]">
                      {format(new Date(lead.createdAt), 'dd MMM')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
