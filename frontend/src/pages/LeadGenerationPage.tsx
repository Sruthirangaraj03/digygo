import { useNavigate } from 'react-router-dom';
import { Facebook, FileText, Layout, MessageCircle, ArrowRight, Link2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const statCards = [
  { label: 'Lead Sources', value: '4', icon: Link2, color: 'text-primary' },
  { label: 'Meta Forms', value: '7', icon: Facebook, color: 'text-blue-500' },
  { label: 'Custom Forms', value: '3', icon: FileText, color: 'text-primary' },
  { label: 'Total Leads', value: '1,240', icon: Users, color: 'text-primary' },
];

const channels = [
  {
    label: 'Meta Forms',
    description: 'Capture leads directly from Facebook & Instagram ads',
    icon: Facebook,
    path: '/lead-generation/meta-forms',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    label: 'Custom Forms',
    description: 'Build and embed forms on any website or landing page',
    icon: FileText,
    path: '/lead-generation/custom-forms',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    label: 'Landing Pages',
    description: 'Create high-converting pages to capture leads',
    icon: Layout,
    path: '/lead-generation/landing-pages',
    color: 'text-purple-500',
    bg: 'bg-purple-50',
  },
  {
    label: 'WhatsApp',
    description: 'Collect leads through WhatsApp click-to-chat links',
    icon: MessageCircle,
    path: '/lead-generation/whatsapp',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
  },
];

export default function LeadGenerationPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((s, idx) => {
          const isHighlight = idx === statCards.length - 1;
          return isHighlight ? (
            <div
              key={s.label}
              className="rounded-2xl px-6 py-5 flex flex-col justify-between text-white hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 8px 32px rgba(234,88,12,0.28)' }}
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[13px] opacity-80 mb-1">{s.label}</p>
                <h3 className="font-headline text-[28px] font-bold tracking-tight">{s.value}</h3>
              </div>
            </div>
          ) : (
            <div
              key={s.label}
              className="bg-white rounded-2xl px-6 py-5 card-shadow border border-black/5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <s.icon className={cn('w-5 h-5', s.color)} />
              </div>
              <div>
                <p className="text-[13px] text-[#7a6b5c] mb-1">{s.label}</p>
                <h3 className="font-headline text-[28px] font-bold text-[#1c1410] tracking-tight">{s.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Channel Cards */}
      <div>
        <h3 className="font-headline font-bold text-[#1c1410] text-[15px] mb-4">Lead Sources</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {channels.map((item) => (
            <div
              key={item.label}
              onClick={() => navigate(item.path)}
              className="group bg-white rounded-2xl border border-black/5 card-shadow p-5 cursor-pointer hover:-translate-y-1 transition-all duration-300 flex items-center gap-4"
            >
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[#1c1410] text-[13px]">{item.label}</h4>
                <p className="text-[11px] text-[#7a6b5c] mt-0.5 leading-relaxed">{item.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#c4b09e] group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
