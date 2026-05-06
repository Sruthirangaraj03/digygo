import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import {
  TrendingUp, Layers, GitMerge, Target, DollarSign, Users, BarChart2, Zap, RefreshCw,
} from 'lucide-react';

const BRAND   = '#ea580c';
const GREEN   = '#10b981';
const AMBER   = '#f59e0b';

const RANGES = [
  { id: 'this_week',    label: 'This Week' },
  { id: 'this_month',   label: 'This Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'this_year',    label: 'This Year' },
];

const TABS = [
  { id: 'acquisition', label: 'Lead Acquisition', icon: TrendingUp },
  { id: 'pipeline',    label: 'Pipeline Health',   icon: Layers },
  { id: 'funnel',      label: 'Conversion Funnel', icon: GitMerge },
  { id: 'source_roi',  label: 'Source ROI',        icon: Target },
  { id: 'revenue',     label: 'Revenue',            icon: DollarSign },
  { id: 'team',        label: 'Team Performance',   icon: Users },
  { id: 'growth',      label: 'Growth Trend',       icon: BarChart2 },
  { id: 'automation',  label: 'Automation',          icon: Zap },
];

// ── Shared mini-components ────────────────────────────────────────────────────

function KPI({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#9e8e7e]">{label}</p>
      <p className="text-[26px] font-bold text-[#1c1410] mt-1 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#9e8e7e] mt-1">{sub}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-black/5">
        <h3 className="text-[13px] font-bold text-[#1c1410]">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`pb-2.5 text-[11px] font-bold uppercase tracking-wide text-[#9e8e7e] ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Td({ children, right, bold, color }: { children: React.ReactNode; right?: boolean; bold?: boolean; color?: string }) {
  return (
    <td className={`py-2.5 text-[13px] ${right ? 'text-right' : ''} ${bold ? 'font-semibold' : ''}`} style={color ? { color } : undefined}>
      {children}
    </td>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-44 text-[#9e8e7e] text-sm">
      <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
    </div>
  );
}

function Empty() {
  return <p className="text-center text-[13px] text-[#9e8e7e] py-12">No data for this period.</p>;
}

// ── Tab: Lead Acquisition ─────────────────────────────────────────────────────
function AcquisitionTab({ range }: { range: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/api/reports/lead-acquisition?range=${range}`)
      .then(setData).catch(() => toast.error('Failed to load acquisition report'))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <Loading />;
  if (!data) return <Empty />;

  const total = data.by_source.reduce((s: number, r: any) => s + r.total, 0);
  const won   = data.by_source.reduce((s: number, r: any) => s + r.won, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KPI label="New Leads"  value={total} />
        <KPI label="Won"        value={won} />
        <KPI label="Conversion" value={total > 0 ? `${Math.round(won / total * 100)}%` : '0%'} />
      </div>

      {data.by_day.length > 0 && (
        <Card title="Leads Per Day">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.by_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {data.by_source.length > 0 && (
        <Card title="By Source">
          <table className="w-full">
            <thead><tr className="border-b border-black/5"><Th>Source</Th><Th right>Leads</Th><Th right>Won</Th><Th right>Conv%</Th></tr></thead>
            <tbody>
              {data.by_source.map((r: any) => (
                <tr key={r.source} className="border-b border-black/[0.04] last:border-0">
                  <Td>{r.source}</Td>
                  <Td right bold>{r.total}</Td>
                  <Td right color={GREEN}>{r.won}</Td>
                  <Td right>{r.total > 0 ? `${Math.round(r.won / r.total * 100)}%` : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Pipeline Health ──────────────────────────────────────────────────────
function PipelineTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>('/api/reports/pipeline-health')
      .then(setData).catch(() => toast.error('Failed to load pipeline report'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data || !data.pipelines.length) return <Empty />;

  return (
    <div className="space-y-4">
      {data.pipelines.map((pipeline: any) => (
        <Card key={pipeline.id} title={pipeline.name}>
          <div className="space-y-2">
            {pipeline.stages.map((stage: any) => {
              const maxCount = Math.max(...pipeline.stages.map((s: any) => s.count), 1);
              const barW = Math.round((stage.count / maxCount) * 100);
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <span className="text-[12px] text-[#7a6b5c] w-28 shrink-0 truncate">{stage.name}</span>
                  <div className="flex-1 bg-[#f5ede3] rounded-full h-6 overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${Math.max(barW, 2)}%`, background: stage.is_won ? GREEN : BRAND }}>
                      {barW > 15 && <span className="text-[10px] font-bold text-white">{stage.count}</span>}
                    </div>
                  </div>
                  <span className="text-[12px] font-bold text-[#1c1410] w-6 text-right">{stage.count}</span>
                  <span className="text-[11px] text-[#9e8e7e] w-16 text-right shrink-0">{stage.avg_days}d avg</span>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Tab: Conversion Funnel ────────────────────────────────────────────────────
function FunnelTab({ range }: { range: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/api/reports/conversion-funnel?range=${range}`)
      .then(setData).catch(() => toast.error('Failed to load funnel report'))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <Loading />;
  if (!data) return <Empty />;

  const colors = [BRAND, AMBER, GREEN];

  return (
    <Card title="Conversion Funnel">
      <div className="space-y-4 max-w-xl mx-auto">
        {data.stages.map((stage: any, i: number) => (
          <div key={stage.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[14px] font-semibold text-[#1c1410]">{stage.name}</span>
              <span className="text-[14px] font-bold" style={{ color: colors[i] }}>
                {stage.count.toLocaleString()} <span className="text-[12px] font-normal text-[#9e8e7e]">({stage.pct}%)</span>
              </span>
            </div>
            <div className="bg-[#f5ede3] rounded-full h-8 overflow-hidden">
              <div className="h-full rounded-full transition-all flex items-center pl-3"
                style={{ width: `${Math.max(stage.pct, 1)}%`, background: colors[i] }}>
                {stage.pct > 10 && <span className="text-[11px] font-bold text-white">{stage.pct}%</span>}
              </div>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-[#9e8e7e] text-center pt-2">
          "Contacted" = lead has at least one follow-up. "Won" = lead is in a Won stage.
        </p>
      </div>
    </Card>
  );
}

// ── Tab: Source ROI ───────────────────────────────────────────────────────────
function SourceROITab({ range }: { range: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/api/reports/source-roi?range=${range}`)
      .then(setData).catch(() => toast.error('Failed to load source ROI report'))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <Loading />;
  if (!data || !data.sources.length) return <Empty />;

  const chartData = data.sources.slice(0, 8).map((s: any) => ({
    name: s.source.length > 12 ? s.source.slice(0, 11) + '…' : s.source,
    contact: s.contact_pct,
    conv: s.conv_pct,
  }));

  return (
    <div className="space-y-4">
      <Card title="Contact & Conversion Rate by Source">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Legend />
            <Bar dataKey="contact" name="Contact%" fill={AMBER} radius={[3, 3, 0, 0]} />
            <Bar dataKey="conv"    name="Conv%"    fill={GREEN} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Source Breakdown">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/5">
              <Th>Source</Th><Th right>Leads</Th><Th right>Contacted</Th>
              <Th right>Contact%</Th><Th right>Won</Th><Th right>Conv%</Th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((r: any) => (
              <tr key={r.source} className="border-b border-black/[0.04] last:border-0">
                <Td>{r.source}</Td>
                <Td right>{r.total}</Td>
                <Td right>{r.contacted}</Td>
                <Td right bold color={AMBER}>{r.contact_pct}%</Td>
                <Td right color={GREEN}>{r.won}</Td>
                <Td right bold>{r.conv_pct}%</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Tab: Revenue ──────────────────────────────────────────────────────────────
function RevenueTab({ range }: { range: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/api/reports/revenue?range=${range}`)
      .then(setData).catch(() => toast.error('Failed to load revenue report'))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <Loading />;
  if (!data) return <Empty />;

  const fmt = (n: number) => {
    if (!n) return '₹0';
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
    return `₹${Number(n).toLocaleString('en-IN')}`;
  };
  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Won Value"      value={fmt(Number(s.won_value))}      sub={`${s.won_count} deals closed`} />
        <KPI label="Avg Deal Size"  value={fmt(Number(s.avg_deal))} />
        <KPI label="Pipeline Value" value={fmt(Number(s.pipeline_value))} sub="All open leads combined" />
        <KPI label="Deals Won"      value={s.won_count} />
      </div>

      {data.trend.length > 0 && (
        <Card title="Monthly Trend — Last 12 Months">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="leads" orientation="left"  tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis yAxisId="value" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} width={60} />
              <Tooltip formatter={(v: any, name: string) => name === 'Won Value' ? fmt(Number(v)) : v} />
              <Legend />
              <Bar   yAxisId="leads" dataKey="new_leads"  name="New Leads" fill="#f5ede3" radius={[3,3,0,0]} />
              <Line  yAxisId="value" type="monotone" dataKey="won_value" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} name="Won Value" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-[#9e8e7e] mt-2 text-center">
            Won value is based on the "lead_value" custom field. Set it on leads to track revenue.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Team Performance ─────────────────────────────────────────────────────
function TeamTab({ range }: { range: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/api/reports/team-performance?range=${range}`)
      .then(setData).catch(() => toast.error('Failed to load team report'))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <Loading />;
  if (!data || !data.staff.length) return <Empty />;

  const active = data.staff.filter((s: any) => s.assigned > 0);

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <Card title="Wins by Staff Member">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={active.map((s: any) => ({ name: s.name.split(' ')[0], assigned: s.assigned, won: s.won }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="assigned" name="Assigned" fill="#f5ede3" stroke="#e5d5c5" strokeWidth={1} radius={[3,3,0,0]} />
              <Bar dataKey="won"      name="Won"       fill={BRAND}  radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="Staff Detail">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/5">
              <Th>Staff</Th><Th right>Assigned</Th><Th right>Contacted</Th>
              <Th right>Follow-ups</Th><Th right>Notes</Th><Th right>Won</Th><Th right>Conv%</Th>
            </tr>
          </thead>
          <tbody>
            {data.staff.map((r: any) => (
              <tr key={r.id} className="border-b border-black/[0.04] last:border-0">
                <Td bold>{r.name}</Td>
                <Td right>{r.assigned}</Td>
                <Td right>{r.contacted}</Td>
                <Td right>{r.followups}</Td>
                <Td right>{r.notes}</Td>
                <Td right bold color={GREEN}>{r.won}</Td>
                <Td right>{r.conv_pct ?? 0}%</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Tab: Growth Trend ─────────────────────────────────────────────────────────
function GrowthTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>('/api/reports/growth')
      .then(setData).catch(() => toast.error('Failed to load growth report'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data || !data.months.length) return <Empty />;

  return (
    <div className="space-y-4">
      <Card title="New Leads & Wins — Last 12 Months">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.months}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="new_leads" stroke={BRAND}  strokeWidth={2} dot={{ r: 3 }} name="New Leads" />
            <Line type="monotone" dataKey="won"        stroke={GREEN}  strokeWidth={2} dot={{ r: 3 }} name="Won" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Monthly Breakdown">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/5">
              <Th>Month</Th><Th right>New Leads</Th><Th right>Won</Th><Th right>Conv%</Th>
            </tr>
          </thead>
          <tbody>
            {[...data.months].reverse().map((r: any) => (
              <tr key={r.month} className="border-b border-black/[0.04] last:border-0">
                <Td bold>{r.month}</Td>
                <Td right>{r.new_leads}</Td>
                <Td right color={GREEN}>{r.won}</Td>
                <Td right>{r.new_leads > 0 ? `${Math.round(r.won / r.new_leads * 100)}%` : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Tab: Automation ───────────────────────────────────────────────────────────
function AutomationTab({ range }: { range: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/api/reports/automation?range=${range}`)
      .then(setData).catch(() => toast.error('Failed to load automation report'))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <Loading />;
  if (!data || !data.workflows.length) return <Empty />;

  const totalExec  = data.workflows.reduce((s: number, w: any) => s + w.total, 0);
  const totalFail  = data.workflows.reduce((s: number, w: any) => s + w.failed, 0);
  const totalLeads = data.workflows.reduce((s: number, w: any) => s + w.leads_enrolled, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Total Executions" value={totalExec} />
        <KPI label="Failed"           value={totalFail}  sub={totalExec > 0 ? `${Math.round(totalFail / totalExec * 100)}% failure rate` : undefined} />
        <KPI label="Leads Enrolled"   value={totalLeads} />
      </div>

      <Card title="Workflow Effectiveness">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/5">
              <Th>Workflow</Th><Th right>Runs</Th><Th right>Completed</Th>
              <Th right>Failed</Th><Th right>Leads</Th><Th right>Success%</Th>
            </tr>
          </thead>
          <tbody>
            {data.workflows.map((w: any) => (
              <tr key={w.id} className="border-b border-black/[0.04] last:border-0">
                <Td bold>{w.name}</Td>
                <Td right>{w.total}</Td>
                <Td right color={GREEN}>{w.completed}</Td>
                <Td right color={w.failed > 0 ? '#ef4444' : undefined}>{w.failed}</Td>
                <Td right>{w.leads_enrolled}</Td>
                <Td right bold>{w.total > 0 ? `${Math.round(w.completed / w.total * 100)}%` : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab]     = useState('acquisition');
  const [range, setRange] = useState('this_month');

  return (
    <div className="space-y-4 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-headline font-bold text-[17px] text-[#1c1410]">Reports</h2>
          <p className="text-[12px] text-[#9e8e7e]">Business analytics — owner view</p>
        </div>

        {/* Range selector */}
        <div className="flex gap-1 bg-white border border-black/5 rounded-xl p-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                range === r.id ? 'bg-primary text-white' : 'text-[#7a6b5c] hover:bg-[#f5ede3]'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto bg-white border border-black/5 rounded-xl p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
                tab === t.id ? 'bg-primary/10 text-primary' : 'text-[#7a6b5c] hover:bg-[#f5ede3]'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'acquisition' && <AcquisitionTab range={range} />}
      {tab === 'pipeline'    && <PipelineTab />}
      {tab === 'funnel'      && <FunnelTab range={range} />}
      {tab === 'source_roi'  && <SourceROITab range={range} />}
      {tab === 'revenue'     && <RevenueTab range={range} />}
      {tab === 'team'        && <TeamTab range={range} />}
      {tab === 'growth'      && <GrowthTab />}
      {tab === 'automation'  && <AutomationTab range={range} />}
    </div>
  );
}
