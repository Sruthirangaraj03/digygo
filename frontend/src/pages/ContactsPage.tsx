import { useState, useMemo } from 'react';
import {
  Users, UserCheck, UserPlus, Phone, Search, Mail, MoreVertical, User,
  MessageCircle, Pencil, Trash2, ArrowRightLeft, Filter, X, Download,
  ChevronDown, Tag,
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const SOURCE_COLORS: Record<string, string> = {
  'Meta Forms':   'bg-blue-50 text-blue-600 border border-blue-200',
  'WhatsApp':     'bg-green-50 text-green-600 border border-green-200',
  'Custom Form':  'bg-purple-50 text-purple-600 border border-purple-200',
  'Manual':       'bg-gray-100 text-gray-600 border border-gray-200',
  'Landing Page': 'bg-amber-50 text-amber-600 border border-amber-200',
};

const TYPE_OPTIONS = ['All', 'Lead', 'Customer'] as const;
const DATE_OPTIONS = ['All time', 'Today', 'This week', 'This month', 'Last 30 days'] as const;

export default function ContactsPage() {
  const { leads, updateLead, deleteLead } = useCrmStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState<typeof TYPE_OPTIONS[number]>('All');
  const [tagFilter, setTagFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<typeof DATE_OPTIONS[number]>('All time');
  const [showFilters, setShowFilters] = useState(false);

  const allSources = useMemo(() => ['All', ...Array.from(new Set(leads.map((l) => l.source)))], [leads]);
  const allTags = useMemo(() => ['All', ...Array.from(new Set(leads.flatMap((l) => l.tags)))], [leads]);

  const totalContacts = leads.length;
  const activeContacts = leads.filter((l) => l.stage !== 'Closed Won').length;
  const newThisMonth = leads.filter((l) => {
    const created = new Date(l.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;
  const whatsappContacts = leads.filter((l) => l.source === 'WhatsApp').length;

  const statCards = [
    { label: 'Total Contacts', value: totalContacts, icon: Users, color: 'text-primary' },
    { label: 'Active', value: activeContacts, icon: UserCheck, color: 'text-emerald-500' },
    { label: 'New This Month', value: newThisMonth, icon: UserPlus, color: 'text-purple-500' },
    { label: 'Via WhatsApp', value: whatsappContacts, icon: Phone, color: 'text-primary' },
  ];

  const filtered = useMemo(() => {
    const now = new Date();
    return leads.filter((l) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(l.firstName.toLowerCase().includes(q) || l.lastName.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.toLowerCase().includes(q))) return false;
      }
      if (sourceFilter !== 'All' && l.source !== sourceFilter) return false;
      if (typeFilter === 'Customer' && l.stage !== 'Closed Won') return false;
      if (typeFilter === 'Lead' && l.stage === 'Closed Won') return false;
      if (tagFilter !== 'All' && !l.tags.includes(tagFilter)) return false;
      if (dateFilter !== 'All time') {
        const created = new Date(l.createdAt);
        if (dateFilter === 'Today' && created.toDateString() !== now.toDateString()) return false;
        if (dateFilter === 'This week') {
          const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
          if (created < weekAgo) return false;
        }
        if (dateFilter === 'This month' && (created.getMonth() !== now.getMonth() || created.getFullYear() !== now.getFullYear())) return false;
        if (dateFilter === 'Last 30 days') {
          const d30 = new Date(now); d30.setDate(now.getDate() - 30);
          if (created < d30) return false;
        }
      }
      return true;
    });
  }, [leads, search, sourceFilter, typeFilter, tagFilter, dateFilter]);

  const activeFiltersCount = [sourceFilter !== 'All', typeFilter !== 'All', tagFilter !== 'All', dateFilter !== 'All time'].filter(Boolean).length;

  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((l) => l.id));
  const toggleOne = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const clearFilters = () => { setSourceFilter('All'); setTypeFilter('All'); setTagFilter('All'); setDateFilter('All time'); };

  const bulkDelete = () => {
    if (!window.confirm(`Delete ${selected.length} contact(s)? This cannot be undone.`)) return;
    selected.forEach((id) => deleteLead(id));
    toast.success(`${selected.length} contact(s) deleted`);
    setSelected([]);
  };

  const selectCls = 'appearance-none pl-3 pr-8 py-2 bg-white border border-black/10 rounded-xl text-[13px] font-medium text-[#1c1410] outline-none hover:border-primary/40 focus:border-primary/40 cursor-pointer';

  return (
    <div className="space-y-5">

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, idx) => {
          const isHighlight = idx === statCards.length - 1;
          return isHighlight ? (
            <div key={s.label}
              className="rounded-2xl px-5 py-4 flex items-center gap-4 text-white hover:-translate-y-0.5 transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)', boxShadow: '0 6px 24px rgba(234,88,12,0.25)' }}>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[12px] opacity-80">{s.label}</p>
                <h3 className="font-headline text-[22px] font-bold tracking-tight leading-tight">{s.value}</h3>
              </div>
            </div>
          ) : (
            <div key={s.label}
              className="bg-white rounded-2xl px-5 py-4 card-shadow border border-black/5 flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-300">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <s.icon className={cn('w-5 h-5', s.color)} />
              </div>
              <div>
                <p className="text-[12px] text-[#7a6b5c]">{s.label}</p>
                <h3 className="font-headline text-[22px] font-bold text-[#1c1410] tracking-tight leading-tight">{s.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone..."
            className="w-full pl-9 pr-10 py-2.5 text-[13px] bg-white border border-black/10 rounded-full outline-none focus:border-primary/40 placeholder:text-gray-400 transition-all"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-black/5 flex items-center justify-center text-[#b09e8d]">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Type pills */}
        <div className="flex items-center bg-white rounded-xl border border-black/10 p-1 gap-0.5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {TYPE_OPTIONS.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors',
                typeFilter === t ? 'bg-primary text-white shadow-sm' : 'text-[#7a6b5c] hover:text-[#1c1410]'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn('flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-[13px] font-medium transition-all',
            showFilters || activeFiltersCount > 0 ? 'border-primary/40 bg-orange-50 text-primary' : 'border-black/10 bg-white text-[#7a6b5c] hover:border-primary/30 hover:text-primary'
          )}
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{activeFiltersCount}</span>
          )}
        </button>

        {/* Export */}
        <button
          onClick={() => toast.info('Export coming soon')}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-[13px] font-medium text-[#7a6b5c] hover:border-primary/30 hover:text-primary transition-all"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Filter dropdowns row */}
      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap animate-fade-in">
          <div className="relative">
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selectCls} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {allSources.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Sources' : s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9a8a7a] pointer-events-none" />
          </div>
          <div className="relative">
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={selectCls} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {allTags.map((t) => <option key={t} value={t}>{t === 'All' ? 'All Tags' : t}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9a8a7a] pointer-events-none" />
          </div>
          <div className="relative">
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className={selectCls} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {DATE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9a8a7a] pointer-events-none" />
          </div>
          {activeFiltersCount > 0 && (
            <button onClick={clearFilters} className="text-[12px] text-red-500 font-semibold hover:underline">Clear all</button>
          )}
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 animate-fade-in"
          style={{ background: 'linear-gradient(to right, #faf0e8, #fff)', boxShadow: '0 2px 8px rgba(234,88,12,0.08)' }}
        >
          <div className="flex items-center gap-2 pr-3 border-r border-primary/20">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">{selected.length}</div>
            <span className="text-[12px] font-semibold text-[#1c1410]">selected</span>
          </div>
          <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <div className="flex-1" />
          <button onClick={() => setSelected([])} className="p-1.5 rounded-lg hover:bg-white transition-colors text-[#7a6b5c]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Result count */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.04]">
          <p className="text-[12px] text-[#7a6b5c]">
            Showing <span className="font-semibold text-[#1c1410]">{filtered.length}</span> of {totalContacts} contacts
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-black/5 bg-[#faf8f6]">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox"
                    checked={filtered.length > 0 && selected.length === filtered.length}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-primary"
                  />
                </th>
                {['Contact', 'Source', 'Stage', 'Tags', 'Type', 'Created', 'Last Activity', ''].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#7a6b5c] whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-[#f5ede3] flex items-center justify-center">
                        <Users className="w-6 h-6 text-[#c4b09e]" />
                      </div>
                      <p className="text-[13px] font-semibold text-[#1c1410]">No contacts found</p>
                      <p className="text-[12px] text-[#7a6b5c]">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((lead) => {
                const isSelected = selected.includes(lead.id);
                const isCustomer = lead.stage === 'Closed Won';
                return (
                  <tr key={lead.id} className={cn('hover:bg-[#faf8f6] transition-colors', isSelected && 'bg-primary/[0.03]')}>

                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(lead.id)} className="w-4 h-4 accent-primary" />
                    </td>

                    {/* Contact — name + email + phone stacked */}
                    <td className="px-4 py-3.5 min-w-[240px]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                          {lead.firstName[0]}{lead.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[13px] text-[#1c1410] truncate">{lead.firstName} {lead.lastName}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {lead.email && <span className="text-[11px] text-[#7a6b5c] truncate max-w-[160px]">{lead.email}</span>}
                            <span className="text-[11px] text-[#7a6b5c]">{lead.phone}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3.5">
                      <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap', SOURCE_COLORS[lead.source] ?? 'bg-gray-100 text-gray-600 border border-gray-200')}>
                        {lead.source}
                      </span>
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3.5">
                      <span className="text-[12px] font-medium text-[#1c1410]">{lead.stage}</span>
                    </td>

                    {/* Tags */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.length === 0
                          ? <span className="text-[#c4b09e] text-[11px]">—</span>
                          : lead.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{tag}</span>
                            ))
                        }
                        {lead.tags.length > 2 && <span className="text-[10px] text-[#7a6b5c]">+{lead.tags.length - 2}</span>}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                        isCustomer ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-[#7a6b5c]'
                      )}>
                        {isCustomer ? 'Customer' : 'Lead'}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-[12px] text-[#1c1410]">{format(new Date(lead.createdAt), 'dd MMM yyyy')}</p>
                    </td>

                    {/* Last Activity */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-[12px] text-[#7a6b5c]">{format(new Date(lead.lastActivity), 'dd MMM yyyy')}</p>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === lead.id ? null : lead.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#7a6b5c] hover:bg-[#f5ede3] hover:text-primary transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenu === lead.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 top-9 z-40 bg-white rounded-xl border border-black/5 shadow-xl w-44 py-1 overflow-hidden">
                              <button
                                onClick={() => { toast.info('Opening conversation…'); setOpenMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-[#7a6b5c]" /> Message
                              </button>
                              <button
                                onClick={() => { toast.info('Edit coming soon'); setOpenMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#7a6b5c]" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  updateLead(lead.id, { stage: isCustomer ? 'Contacted' : 'Closed Won' });
                                  toast.success(isCustomer ? 'Converted to Lead' : 'Converted to Customer');
                                  setOpenMenu(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[#1c1410] hover:bg-[#faf0e8] transition-colors"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-[#7a6b5c]" />
                                {isCustomer ? 'Convert to Lead' : 'Convert to Customer'}
                              </button>
                              <div className="border-t border-black/5 my-1" />
                              <button
                                onClick={() => { deleteLead(lead.id); toast.success('Contact deleted'); setOpenMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
