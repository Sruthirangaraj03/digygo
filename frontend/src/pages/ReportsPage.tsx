import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, Layers, GitMerge, Target, DollarSign, Users, BarChart2, Zap, RefreshCw, PieChart as PieIcon,
} from 'lucide-react';

const BRAND  = '#ea580c';
const GREEN  = '#10b981';
const AMBER  = '#f59e0b';
const MULTI  = ['#ea580c','#3b82f6','#8b5cf6','#10b981','#f59e0b','#f43f5e','#06b6d4','#84cc16'];

const QUALITY_COLORS: Record<string, string> = {
  hot:         '#ea580c',
  warm:        '#f59e0b',
  cold:        '#3b82f6',
  unqualified: '#9e8e7e',
  unknown:     '#e5d5c5',
};

const RANGES = [
  { id: 'this_week',    label: 'This Week' },
  { id: 'this_month',   label: 'This Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'this_year',    label: 'This Year' },
];

const PA_RANGES = [
  { id: 'today',      label: 'Today' },
  { id: 'yesterday',  label: 'Yesterday' },
  { id: 'this_week',  label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'custom',     label: 'Custom' },
  { id: 'all_time',   label: 'All Time' },
];

const TABS = [
  { id: 'pipeline_analytics', label: 'Pipeline Analytics', icon: PieIcon },
  { id: 'acquisition',        label: 'Lead Acquisition',   icon: TrendingUp },
  { id: 'pipeline',           label: 'Pipeline Health',    icon: Layers },
  { id: 'funnel',             label: 'Conversion Funnel',  icon: GitMerge },
  { id: 'source_roi',         label: 'Source ROI',         icon: Target },
  { id: 'revenue',            label: 'Revenue',            icon: DollarSign },
  { id: 'team',               label: 'Team Performance',   icon: Users },
  { id: 'growth',             label: 'Growth Trend',       icon: BarChart2 },
  { id: 'automation',         label: 'Automation',         icon: Zap },
];

// ── Shared mini-components ────────────────────────────────────────────────────

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#9e8e7e]">{label}</p>
      <p className="text-[26px] font-bold mt-1 leading-none" style={{ color: color ?? '#1c1410' }}>{value}</p>
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

// ── Tab: Pipeline Analytics ───────────────────────────────────────────────────
function PipelineAnalyticsTab() {
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [paRange, setPaRange]       = useState('this_month');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [plLoading, setPlLoading]   = useState(true);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/api/reports/pipelines')
      .then((rows) => {
        setPipelines(rows);
        if (rows.length > 0) setPipelineId(rows[0].id);
      })
      .catch(() => toast.error('Failed to load pipelines'))
      .finally(() => setPlLoading(false));
  }, []);

  useEffect(() => {
    if (!pipelineId) return;
    if (paRange === 'custom' && (!fromDate || !toDate)) return;
    setLoading(true);
    setData(null);
    const params = new URLSearchParams({ pipeline_id: pipelineId, range: paRange });
    if (paRange === 'custom') { params.set('from', fromDate); params.set('to', toDate); }
    api.get<any>(`/api/reports/pipeline-analytics?${params}`)
      .then(setData)
      .catch(() => toast.error('Failed to load pipeline analytics'))
      .finally(() => setLoading(false));
  }, [pipelineId, paRange, fromDate, toDate]);

  if (plLoading) return <Loading />;
  if (!pipelines.length) return (
    <div className="text-center py-16 text-[#9e8e7e] text-sm">No pipelines found. Create a pipeline first.</div>
  );

  return (
    <div className="space-y-5">

      {/* Pipeline selector */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#9e8e7e] mb-2">Select Pipeline</p>
        <div className="flex flex-wrap gap-2">
          {pipelines.map((pl) => (
            <button
              key={pl.id}
              onClick={() => setPipelineId(pl.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
                pipelineId === pl.id
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-[#6b4f30] border-black/10 hover:border-primary/40 hover:bg-[#fdf8f5]'
              }`}
            >
              {pl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-1 bg-white border border-black/5 rounded-xl p-1">
        {PA_RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setPaRange(r.id)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors whitespace-nowrap ${
              paRange === r.id ? 'bg-primary text-white' : 'text-[#7a6b5c] hover:bg-[#f5ede3]'
            }`}
          >
            {r.label}
          </button>
        ))}
        {paRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="border border-black/10 rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/30" />
            <span className="text-[12px] text-[#9e8e7e]">to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="border border-black/10 rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
        )}
      </div>

      {loading && <Loading />}

      {!loading && !data && pipelineId && <Empty />}

      {data && (
        <div className="space-y-5">

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI label="Total Leads"       value={data.kpi.total_leads ?? 0} />
            <KPI label="Won"               value={data.kpi.won ?? 0}         color={GREEN} />
            <KPI label="Active"            value={data.kpi.active ?? 0}       color="#3b82f6" />
            <KPI label="Conversion Rate"   value={`${data.kpi.conv_pct ?? 0}%`} />
            <KPI label="Avg Days to Close" value={`${data.kpi.avg_days_to_close ?? 0}d`} />
          </div>

          {/* ── Lead Flow + Stage Funnel ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.lead_flow.length > 0 ? (
              <Card title="Lead Flow (by Day)">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.lead_flow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill={BRAND} radius={[3,3,0,0]} name="New Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            ) : (
              <Card title="Lead Flow (by Day)"><Empty /></Card>
            )}

            {data.stages.length > 0 && (
              <Card title="Stage Funnel">
                <div className="space-y-2">
                  {data.stages.map((s: any, i: number) => {
                    const maxCount = Math.max(...data.stages.map((x: any) => x.lead_count), 1);
                    const barW = Math.max(Math.round(s.lead_count / maxCount * 100), 2);
                    const color = s.is_won ? GREEN : MULTI[i % MULTI.length];
                    return (
                      <div key={s.stage_name} className="flex items-center gap-2">
                        <span className="text-[11px] text-[#7a6b5c] w-24 shrink-0 truncate">{s.stage_name}</span>
                        <div className="flex-1 bg-[#f5ede3] rounded-full h-5 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${barW}%`, background: color }} />
                        </div>
                        <span className="text-[12px] font-bold w-6 text-right">{s.lead_count}</span>
                        <span className="text-[10px] text-[#9e8e7e] w-12 text-right shrink-0">{s.avg_days}d avg</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* ── Source Intelligence + Lead Quality ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.sources.length > 0 && (
              <Card title="Source Intelligence">
                <div className="flex gap-4 items-center mb-3">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={data.sources} dataKey="total" nameKey="source"
                        cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={2}>
                        {data.sources.map((_: any, i: number) => (
                          <Cell key={i} fill={MULTI[i % MULTI.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, n: string) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-black/5">
                          <Th>Source</Th><Th right>Leads</Th><Th right>Won</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.sources.slice(0, 5).map((s: any, i: number) => (
                          <tr key={s.source} className="border-b border-black/[0.04] last:border-0">
                            <Td>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: MULTI[i % MULTI.length] }} />
                                <span className="truncate max-w-[90px] text-[12px]">{s.source}</span>
                              </div>
                            </Td>
                            <Td right>{s.total}</Td>
                            <Td right color={GREEN}>{s.won}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <table className="w-full border-t border-black/5 pt-2">
                  <thead>
                    <tr className="border-b border-black/5">
                      <Th>Source</Th><Th right>Contacted</Th><Th right>Conv%</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.slice(0, 5).map((s: any) => (
                      <tr key={s.source} className="border-b border-black/[0.04] last:border-0">
                        <Td>{s.source}</Td>
                        <Td right>{s.contacted}</Td>
                        <Td right bold>{s.conv_pct}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {data.quality.length > 0 && (
              <Card title="Lead Quality Breakdown">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data.quality} dataKey="count" nameKey="quality"
                      cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {data.quality.map((q: any, i: number) => (
                        <Cell key={i} fill={QUALITY_COLORS[q.quality?.toLowerCase()] ?? MULTI[i % MULTI.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      formatter={(value) => (
                        <span className="text-[11px] capitalize">{value === 'unknown' ? 'Not Set' : value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {data.quality.map((q: any, i: number) => (
                    <div key={q.quality} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#faf8f6] border border-black/5">
                      <div className="w-2 h-2 rounded-full" style={{ background: QUALITY_COLORS[q.quality?.toLowerCase()] ?? MULTI[i % MULTI.length] }} />
                      <span className="text-[11px] font-semibold capitalize">{q.quality === 'unknown' ? 'Not Set' : q.quality}</span>
                      <span className="text-[11px] text-[#9e8e7e]">{q.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* ── Win Trend ── */}
          {data.win_loss.length > 1 && (
            <Card title="Win Trend by Month">
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={data.win_loss}>
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
          )}

          {/* ── Staff Performance ── */}
          {data.staff.filter((s: any) => s.assigned > 0).length > 0 && (
            <Card title="Staff Performance">
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.staff.filter((s: any) => s.assigned > 0).slice(0, 8).map((s: any) => ({
                    name: s.name.split(' ')[0], assigned: s.assigned, won: s.won,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="assigned" name="Assigned" fill="#f0ebe5" stroke="#e5d5c5" strokeWidth={1} radius={[3,3,0,0]} />
                    <Bar dataKey="won"      name="Won"      fill={GREEN}  radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5">
                    <Th>Staff</Th><Th right>Assigned</Th><Th right>Contacted</Th>
                    <Th right>Contact%</Th><Th right>Follow-ups</Th><Th right>Won</Th><Th right>Conv%</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.staff.filter((s: any) => s.assigned > 0).map((s: any) => (
                    <tr key={s.id} className="border-b border-black/[0.04] last:border-0">
                      <Td bold>{s.name}</Td>
                      <Td right>{s.assigned}</Td>
                      <Td right>{s.contacted}</Td>
                      <Td right color={AMBER}>{s.contact_pct}%</Td>
                      <Td right>{s.followups}</Td>
                      <Td right color={GREEN}>{s.won}</Td>
                      <Td right bold>{s.conv_pct}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* ── Follow-up Activity + Automation Activity ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Follow-up Activity">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#f5ede3] rounded-xl p-3 text-center">
                  <p className="text-[22px] font-bold text-[#1c1410]">{data.followups.total ?? 0}</p>
                  <p className="text-[10px] text-[#9e8e7e] font-bold uppercase tracking-wide mt-0.5">Total</p>
                </div>
                <div className="bg-[#dcfce7] rounded-xl p-3 text-center">
                  <p className="text-[22px] font-bold text-[#10b981]">{data.followups.completed ?? 0}</p>
                  <p className="text-[10px] text-[#9e8e7e] font-bold uppercase tracking-wide mt-0.5">Completed</p>
                </div>
                <div className="bg-[#fef9c3] rounded-xl p-3 text-center">
                  <p className="text-[22px] font-bold text-[#ca8a04]">{data.followups.pending ?? 0}</p>
                  <p className="text-[10px] text-[#9e8e7e] font-bold uppercase tracking-wide mt-0.5">Pending</p>
                </div>
                <div className="bg-[#fee2e2] rounded-xl p-3 text-center">
                  <p className="text-[22px] font-bold text-[#ef4444]">{data.followups.overdue ?? 0}</p>
                  <p className="text-[10px] text-[#9e8e7e] font-bold uppercase tracking-wide mt-0.5">Overdue</p>
                </div>
              </div>
              {(data.followups.overdue_list?.length ?? 0) > 0 && (
                <>
                  <p className="text-[11px] font-bold text-[#9e8e7e] uppercase tracking-wide mb-2">Top Overdue</p>
                  <div className="space-y-1.5">
                    {data.followups.overdue_list.slice(0, 5).map((o: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-[#1c1410] truncate max-w-[160px]">{o.lead_name}</span>
                        <span className="text-[#ef4444] font-semibold shrink-0 ml-2">{o.overdue_days}d overdue</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            <Card title="Automation Activity">
              {data.automation.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black/5">
                      <Th>Workflow</Th><Th right>Runs</Th><Th right>OK</Th><Th right>Fail</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.automation.slice(0, 8).map((w: any) => (
                      <tr key={w.id} className="border-b border-black/[0.04] last:border-0">
                        <Td bold>{w.name.length > 22 ? w.name.slice(0, 21) + '…' : w.name}</Td>
                        <Td right>{w.total}</Td>
                        <Td right color={GREEN}>{w.completed}</Td>
                        <Td right color={w.failed > 0 ? '#ef4444' : undefined}>{w.failed}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[13px] text-[#9e8e7e] text-center py-8">No workflow activity in this period.</p>
              )}
            </Card>
          </div>

          {/* ── Stale / At-Risk Leads ── */}
          {(data.stale.stale_count ?? 0) > 0 && (
            <Card title={`Stale / At-Risk Leads — ${data.stale.stale_count} leads not updated in 7+ days`}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5">
                    <Th>Lead</Th><Th>Stage</Th><Th>Assigned To</Th><Th right>Days Stuck</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.stale.list.map((l: any) => (
                    <tr key={l.id} className="border-b border-black/[0.04] last:border-0">
                      <Td bold>{l.name}</Td>
                      <Td>{l.stage_name ?? '—'}</Td>
                      <Td>{l.assigned_name ?? 'Unassigned'}</Td>
                      <Td right color={l.days_stale > 14 ? '#ef4444' : AMBER}>{l.days_stale}d</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* ── Tag Intelligence ── */}
          {data.tags.length > 0 && (
            <Card title="Tag Intelligence">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.tags} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="total" name="Leads" radius={[0,3,3,0]}>
                      {data.tags.map((_: any, i: number) => (
                        <Cell key={i} fill={MULTI[i % MULTI.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black/5">
                      <Th>Tag</Th><Th right>Leads</Th><Th right>Won</Th><Th right>Conv%</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tags.map((t: any, i: number) => (
                      <tr key={t.name} className="border-b border-black/[0.04] last:border-0">
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: t.color || MULTI[i % MULTI.length] }} />
                            {t.name}
                          </div>
                        </Td>
                        <Td right>{t.total}</Td>
                        <Td right color={GREEN}>{t.won}</Td>
                        <Td right bold>{t.conv_pct}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </div>
      )}
    </div>
  );
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
  const [tab, setTab]     = useState('pipeline_analytics');
  const [range, setRange] = useState('this_month');

  const showRange = tab !== 'pipeline_analytics' && tab !== 'pipeline' && tab !== 'growth';

  return (
    <div className="space-y-4 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-headline font-bold text-[17px] text-[#1c1410]">Reports & Analytics</h2>
          <p className="text-[12px] text-[#9e8e7e]">Business analytics — owner view</p>
        </div>

        {/* Range selector — hidden on pipeline analytics / health / growth tabs */}
        {showRange && (
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
        )}
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
      {tab === 'pipeline_analytics' && <PipelineAnalyticsTab />}
      {tab === 'acquisition'        && <AcquisitionTab range={range} />}
      {tab === 'pipeline'           && <PipelineTab />}
      {tab === 'funnel'             && <FunnelTab range={range} />}
      {tab === 'source_roi'         && <SourceROITab range={range} />}
      {tab === 'revenue'            && <RevenueTab range={range} />}
      {tab === 'team'               && <TeamTab range={range} />}
      {tab === 'growth'             && <GrowthTab />}
      {tab === 'automation'         && <AutomationTab range={range} />}
    </div>
  );
}
