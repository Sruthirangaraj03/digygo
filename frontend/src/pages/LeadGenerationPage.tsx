import { useNavigate } from 'react-router-dom';
import { Facebook, FileText, Layout, MessageCircle, ArrowRight, Sparkles } from 'lucide-react';

const channels = [
  {
    label: 'Meta Forms',
    description: 'Sync leads directly from Facebook & Instagram ad forms. Connect your Meta Business account once — leads flow in automatically.',
    icon: Facebook,
    path: '/lead-generation/meta-forms',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    cta: 'Manage Meta Forms',
    count: '7 forms connected',
    available: true,
  },
  {
    label: 'Custom Forms',
    description: 'Build forms with drag-and-drop fields. Embed them on any website or share as a standalone link — leads land straight in your CRM.',
    icon: FileText,
    path: '/lead-generation/custom-forms',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    cta: 'Create a Form',
    count: '3 forms',
    available: true,
  },
  {
    label: 'Landing Pages',
    description: 'Design high-converting landing pages with built-in lead capture, analytics, and A/B testing — no code needed.',
    icon: Layout,
    path: '/lead-generation/landing-pages',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    cta: 'Build a Page',
    count: '0 pages',
    available: true,
  },
  {
    label: 'WhatsApp',
    description: 'Collect leads through WhatsApp click-to-chat links and automated conversational flows that pre-qualify prospects.',
    icon: MessageCircle,
    path: '/lead-generation/whatsapp',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    cta: 'Setup WhatsApp',
    count: null,
    available: false,
  },
];

export default function LeadGenerationPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">

      {/* Page intro */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-headline font-bold text-[#1c1410] text-[18px]">Choose a lead source</h2>
          <p className="text-[13px] text-[#7a6b5c] mt-1">Every form you create or connect automatically routes new leads into your CRM pipeline.</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-[12px] font-semibold shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          1,240 leads captured
        </div>
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {channels.map((item) => (
          <div
            key={item.label}
            onClick={() => item.available && navigate(item.path)}
            className={`group bg-white rounded-2xl border card-shadow p-6 flex flex-col gap-4 transition-all duration-200 ${
              item.available
                ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md border-black/5'
                : 'opacity-60 cursor-default border-black/5'
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div>
                  <h4 className="font-semibold text-[#1c1410] text-[14px]">{item.label}</h4>
                  {item.count ? (
                    <span className={`text-[11px] font-medium ${item.color}`}>{item.count}</span>
                  ) : (
                    <span className="text-[11px] text-[#b09e8d] bg-[#faf8f6] px-2 py-0.5 rounded-md border border-black/5">
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
              {item.available && (
                <ArrowRight className="w-4 h-4 text-[#c4b09e] group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              )}
            </div>

            {/* Description */}
            <p className="text-[12px] text-[#7a6b5c] leading-relaxed">{item.description}</p>

            {/* CTA */}
            {item.available && (
              <div className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${item.color} mt-auto`}>
                {item.cta}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
