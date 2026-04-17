import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useCrmStore } from '@/store/crmStore';
import { staff } from '@/data/mockData';
import {
  ChevronLeft, ChevronRight, Plus, Video, Phone as PhoneIcon, Users, Clock,
  ExternalLink, Copy, Trash2, Settings2, ChevronDown,
  RotateCcw, UserCheck, Ban, CalendarDays, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, getDay,
  parseISO,
} from 'date-fns';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/data/mockData';
import type { EventType } from './CalendarEditPage';

const gradStyle  = { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' };
const shadowStyle = { ...gradStyle, boxShadow: '0 4px 14px rgba(234,88,12,0.28)' };

const typeColors: Record<string, string> = { meeting: 'bg-primary', demo: 'bg-purple-500', call: 'bg-green-500' };
const typeIcons: Record<string, React.ElementType> = { meeting: Users, demo: Video, call: PhoneIcon };
const statusStyles: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
  rescheduled: 'bg-yellow-100 text-yellow-700',
  'no-show':   'bg-gray-100 text-gray-700',
};

interface Appointment {
  id: string; eventTypeName: string; leadName: string; email: string;
  date: string; startTime: string; endTime: string;
  status: 'booked' | 'cancelled' | 'show-up' | 'no-show'; timezone: string;
}

const fmt12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const DOT_COLOR: Record<string, string>   = { booked: 'bg-blue-500', cancelled: 'bg-red-500', 'show-up': 'bg-green-500', 'no-show': 'bg-amber-400' };
const STATUS_LBL: Record<string, string>  = { booked: 'Booked', cancelled: 'Cancelled', 'show-up': 'Show Up', 'no-show': 'No Show' };
const STATUS_BADGE: Record<string, string> = { booked: 'bg-blue-50 text-blue-700 border-blue-200', cancelled: 'bg-red-50 text-red-600 border-red-200', 'show-up': 'bg-green-50 text-green-700 border-green-200', 'no-show': 'bg-amber-50 text-amber-700 border-amber-200' };

const INIT_EVENT_TYPES: EventType[] = [
  { id: 'et1', name: 'DigyGo-SlotBooking',     duration: 30, description: 'DigyGo Consultation provides expert guidance.', slug: 'slot-booking',    staffType: 'single', assignmentMode: 'round-robin', staffEmails: ['sruthirangaraj1212@gmail.com', 'rosinirangaraj@gmail.com'], meetingType: 'Google Meet', schedulingType: 'days', daysInFuture: 40, timeZone: 'Asia/Kolkata', schedule: {} as any, bufferTime: 2, isActive: true, formFields: [] },
  { id: 'et2', name: 'Personal 1 to 1 Funnel', duration: 30, description: 'Personal 1 to 1 Funnel session.',              slug: 'personal-1-to-1', staffType: 'single', assignmentMode: 'round-robin', staffEmails: ['sruthirangaraj1212@gmail.com'],                        meetingType: 'Google Meet', schedulingType: 'days', daysInFuture: 30, timeZone: 'Asia/Kolkata', schedule: {} as any, bufferTime: 5, isActive: true, formFields: [] },
  { id: 'et3', name: 'VSL Calendar',           duration: 15, description: 'VSL Calendar for quick follow-up sessions.',    slug: 'vsl-calendar',    staffType: 'single', assignmentMode: 'round-robin', staffEmails: ['sruthirangaraj1212@gmail.com'],                        meetingType: 'Google Meet', schedulingType: 'indefinite', daysInFuture: 0, timeZone: 'Asia/Kolkata', schedule: {} as any, bufferTime: 0, isActive: true, formFields: [] },
];

const INIT_APPOINTMENTS: Appointment[] = [
  { id: 'apt1', eventTypeName: 'VSL Calendar',           leadName: 'sruthi rangaraj', email: 'sruthirangaraj03@gmail.com', date: '2025-12-31', startTime: '09:00', endTime: '09:15', status: 'show-up',   timezone: 'Asia/Calcutta' },
  { id: 'apt2', eventTypeName: 'DigyGo-SlotBooking',     leadName: 'Rosin Irangaraj', email: 'rosinirangaraj@gmail.com',   date: '2026-04-20', startTime: '10:00', endTime: '10:30', status: 'booked',    timezone: 'Asia/Calcutta' },
  { id: 'apt3', eventTypeName: 'Personal 1 to 1 Funnel', leadName: 'Sivaraj K',       email: 'sivaraj@digygo.com',         date: '2026-03-15', startTime: '11:00', endTime: '11:30', status: 'cancelled', timezone: 'Asia/Calcutta' },
  { id: 'apt4', eventTypeName: 'VSL Calendar',           leadName: 'Karthik M',        email: 'karthik@example.com',        date: '2026-02-10', startTime: '14:00', endTime: '14:15', status: 'no-show',   timezone: 'Asia/Calcutta' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { calendarEvents, updateEventStatus, availabilitySlots, addCalendarEvent } = useCrmStore();

  const [searchParams] = useSearchParams();
  const tab = (searchParams.get('tab') ?? 'dashboard') as 'dashboard' | 'create-edit' | 'appointments' | 'availability';

  // Calendar height sync
  const calRef = useRef<HTMLDivElement>(null);
  const [calHeight, setCalHeight] = useState(0);
  useEffect(() => {
    if (!calRef.current) return;
    const ro = new ResizeObserver(([e]) => setCalHeight(e.target.getBoundingClientRect().height));
    ro.observe(calRef.current);
    return () => ro.disconnect();
  }, [tab]);

  // Dashboard state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [calendarFilter, setCalendarFilter] = useState<string>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');

  // Create/Edit state
  const [eventTypes, setEventTypes] = useState<EventType[]>(INIT_EVENT_TYPES);

  // Handle saved event type from CalendarEditPage
  React.useEffect(() => {
    if (location.state?.savedEventType) {
      const saved = location.state.savedEventType as EventType;
      setEventTypes((p) => p.some((e) => e.id === saved.id) ? p.map((e) => e.id === saved.id ? saved : e) : [...p, saved]);
      navigate('/calendar?tab=create-edit', { replace: true });
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>(INIT_APPOINTMENTS);
  const [apptFilter, setApptFilter] = useState<'all' | 'booked' | 'show-up' | 'no-show' | 'cancelled'>('all');

  // Availability state
  const [availDate, setAvailDate] = useState(new Date());
  const [bookingSlot, setBookingSlot] = useState<{ staffId: string; time: string } | null>(null);
  const [bookForm, setBookForm] = useState<{ leadName: string; type: 'meeting' | 'demo' | 'call'; duration: number }>({ leadName: '', type: 'call', duration: 30 });

  // Dashboard computations
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end   = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });
    const padding = Array.from({ length: getDay(start) }, () => null as null);
    return [...padding, ...allDays];
  }, [currentMonth]);

  const matchFilters = (e: CalendarEvent) =>
    (calendarFilter === 'all' || e.type === calendarFilter) &&
    (staffFilter === 'all' || e.assignedTo === staffFilter);
  const eventsForDate = (d: Date) => calendarEvents.filter((e) => isSameDay(new Date(e.date), d) && matchFilters(e));
  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  const statusActions = [
    { label: 'Completed', value: 'completed' as const, color: 'text-green-600 hover:bg-green-50', Icon: CheckCircle2 },
    { label: 'Cancelled', value: 'cancelled' as const, color: 'text-red-600 hover:bg-red-50', Icon: XCircle },
    { label: 'No Show',   value: 'no-show' as const,   color: 'text-amber-600 hover:bg-amber-50', Icon: AlertTriangle },
  ];

  // Dashboard stats
  const totalEvents = calendarEvents.length;
  const scheduledCount = calendarEvents.filter((e) => e.status === 'scheduled').length;
  const completedCount = calendarEvents.filter((e) => e.status === 'completed').length;
  const totalAppts = appointments.length;

  // Appointments computations
  const filteredApts = useMemo(() => {
    if (apptFilter === 'all') return appointments;
    return appointments.filter((a) => a.status === apptFilter);
  }, [appointments, apptFilter]);

  const groupedApts = useMemo(() => {
    const groups: Record<string, Appointment[]> = {};
    [...filteredApts].sort((a, b) => b.date.localeCompare(a.date)).forEach((a) => { (groups[a.date] ??= []).push(a); });
    return groups;
  }, [filteredApts]);

  const apptStats = useMemo(() => ({
    total: appointments.length,
    booked: appointments.filter((a) => a.status === 'booked').length,
    showUp: appointments.filter((a) => a.status === 'show-up').length,
    noShow: appointments.filter((a) => a.status === 'no-show').length,
    cancelled: appointments.filter((a) => a.status === 'cancelled').length,
  }), [appointments]);

  // Availability helpers
  const AVAIL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const AVAIL_SLOTS = AVAIL_HOURS.flatMap((h) => [
    `${String(h).padStart(2, '0')}:00`,
    `${String(h).padStart(2, '0')}:30`,
  ]);

  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  const isWorking = (memberId: string, slot: string) => {
    const dow = getDay(availDate);
    const s = availabilitySlots.find((a) => a.userId === memberId && a.dayOfWeek === dow && a.isActive);
    if (!s) return false;
    return toMins(slot) >= toMins(s.startTime) && toMins(slot) < toMins(s.endTime);
  };

  const getBookedEvent = (memberId: string, slot: string) => {
    const dateStr = format(availDate, 'yyyy-MM-dd');
    return calendarEvents.find((e) => {
      if (e.assignedTo !== memberId || e.date !== dateStr || e.status === 'cancelled') return false;
      const slotM = toMins(slot);
      return slotM >= toMins(e.time) && slotM < toMins(e.time) + e.duration;
    }) ?? null;
  };

  const handleBookSlot = () => {
    if (!bookingSlot || !bookForm.leadName.trim()) return;
    const member = staff.find((s) => s.id === bookingSlot.staffId);
    addCalendarEvent({
      id: `evt-${Date.now()}`,
      title: `${bookForm.type === 'demo' ? 'Demo Call' : bookForm.type === 'meeting' ? 'Meeting' : 'Follow-up Call'} – ${bookForm.leadName}`,
      type: bookForm.type,
      leadName: bookForm.leadName,
      assignedTo: bookingSlot.staffId,
      date: format(availDate, 'yyyy-MM-dd'),
      time: bookingSlot.time,
      duration: bookForm.duration,
      status: 'scheduled',
    });
    toast.success(`Booked with ${member?.name} at ${fmt12(bookingSlot.time)}`);
    setBookingSlot(null);
    setBookForm({ leadName: '', type: 'call', duration: 30 });
  };

  return (
    <div className="space-y-4">

      {/* ═══════════ DASHBOARD TAB ═══════════ */}
      {tab === 'dashboard' && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Events', value: totalEvents, icon: CalendarDays, color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Scheduled', value: scheduledCount, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
              { label: 'Appointments', value: totalAppts, icon: Users, color: 'text-orange-500', bg: 'bg-orange-50' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl px-4 py-3.5 border border-black/5 flex items-center gap-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
                  <s.icon className={cn('w-4 h-4', s.color)} />
                </div>
                <div>
                  <p className="text-[11px] text-[#b09e8d]">{s.label}</p>
                  <p className="text-[20px] font-semibold text-[#1c1410] leading-tight">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters + Add Event */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select value={calendarFilter} onChange={(e) => setCalendarFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-black/10 rounded-xl text-[13px] font-semibold text-[#1c1410] outline-none hover:border-primary/40 focus:border-primary/40 cursor-pointer min-w-[160px]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <option value="all">All Calendars</option>
                <option value="demo">Demos</option>
                <option value="meeting">Meetings</option>
                <option value="call">Calls</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6b5c] pointer-events-none" />
            </div>
            <div className="relative">
              <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
                className={cn('appearance-none pl-4 pr-10 py-2.5 bg-white border border-black/10 rounded-xl text-[13px] font-semibold outline-none hover:border-primary/40 focus:border-primary/40 cursor-pointer min-w-[160px]',
                  staffFilter === 'all' ? 'text-[#b09e8d]' : 'text-[#1c1410]'
                )} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <option value="all">All Staff</option>
                {staff.filter((s) => s.status === 'active').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6b5c] pointer-events-none" />
            </div>
            <Button className="ml-auto" onClick={() => navigate('/calendar/edit/new')}>
              <Plus className="w-4 h-4 mr-1" /> Add Event
            </Button>
          </div>

          {/* Calendar + Events */}
          <div className="flex gap-5 items-start" style={{ minHeight: 0 }}>
            {/* Month grid — natural size */}
            <div ref={calRef} className="flex-[2] bg-white rounded-2xl border border-black/5 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-headline text-[17px] font-semibold text-[#1c1410]">{format(currentMonth, 'MMMM yyyy')}</h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="w-8 h-8 rounded-lg hover:bg-[#f5ede3] flex items-center justify-center text-[#7a6b5c]"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }} className="px-3 py-1.5 rounded-lg hover:bg-[#f5ede3] text-[12px] font-semibold text-[#1c1410]">Today</button>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="w-8 h-8 rounded-lg hover:bg-[#f5ede3] flex items-center justify-center text-[#7a6b5c]"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS_OF_WEEK.map((d) => <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-[#7a6b5c] pb-1.5">{d}</div>)}
                  {days.map((day, i) => {
                    if (!day) return <div key={`pad-${i}`} className="min-h-[50px]" />;
                    const events = eventsForDate(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date()) && !isSelected;
                    return (
                      <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
                        className={cn('rounded-lg min-h-[50px] flex flex-col items-center justify-center gap-1 transition-colors',
                          isSelected ? 'bg-primary text-white shadow-sm' :
                          isToday ? 'bg-[#faf0e8] text-[#1c1410]' :
                          'hover:bg-[#faf8f6] text-[#1c1410]',
                          !isSameMonth(day, currentMonth) && 'opacity-40'
                        )}>
                        <span className="font-semibold text-[13px] tabular-nums">{format(day, 'd')}</span>
                        {events.length > 0 && (
                          <div className="flex gap-0.5">
                            {events.slice(0, 3).map((e) => <div key={e.id} className={cn('w-1 h-1 rounded-full', isSelected ? 'bg-white/90' : typeColors[e.type])} />)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Events panel — exact same height as calendar, scrolls internally */}
            <div className="flex-1 bg-white rounded-2xl border border-black/5 flex flex-col" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: calHeight > 0 ? calHeight : undefined, maxHeight: calHeight > 0 ? calHeight : 600 }}>
              <div className="px-4 pt-4 pb-2.5 shrink-0 border-b border-black/[0.04]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[13px] text-[#1c1410]">{selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a date'}</h3>
                  {selectedEvents.length > 0 && <span className="text-[11px] font-medium text-[#7a6b5c] bg-black/[0.06] rounded-full px-2 py-0.5">{selectedEvents.length}</span>}
                </div>
              </div>
              {selectedEvents.length === 0 ? (
                <div className="text-center py-10 flex-1">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-[#c4b09e] opacity-40" />
                  <p className="text-[13px] text-[#7a6b5c]">No events</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pt-2 pb-1 space-y-2">
                  {selectedEvents.map((event) => {
                    const Icon = typeIcons[event.type] || Users;
                    const assignedName = staff.find((s) => s.id === event.assignedTo)?.name;
                    return (
                      <div key={event.id} className="p-3 rounded-xl border border-black/5 hover:shadow-sm transition-shadow">
                        <div className="flex items-start gap-2.5">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0', typeColors[event.type])}><Icon className="w-3.5 h-3.5" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <p className="font-semibold text-[12px] text-[#1c1410] leading-tight">{event.title}</p>
                              <Badge className={cn('text-[9px] border-0 font-medium shrink-0 ml-1', statusStyles[event.status])}>{event.status}</Badge>
                            </div>
                            <p className="text-[10px] text-[#7a6b5c] mt-0.5">{event.time} · {event.duration}min{assignedName ? ` · ${assignedName}` : ''}</p>
                            <p className="text-[10px] text-[#7a6b5c]">{event.leadName}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {event.meetingLink && <a href={event.meetingLink} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="text-[10px] text-primary flex items-center gap-0.5 hover:underline font-semibold"><ExternalLink className="w-2.5 h-2.5" /> Join</a>}
                              {event.status === 'scheduled' && statusActions.map((action) => (
                                <button key={action.value} onClick={(e) => { e.stopPropagation(); updateEventStatus(event.id, action.value); toast.success(`Marked ${action.label}`); }}
                                  className={cn('flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border border-black/10 transition-colors', action.color)}>
                                  <action.Icon className="w-2.5 h-2.5" /> {action.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </>
      )}

      {/* ═══════════ CREATE / EDIT TAB ═══════════ */}
      {tab === 'create-edit' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => navigate('/calendar/edit/new')}>
              <Plus className="w-4 h-4 mr-1" /> New Calendar
            </Button>
          </div>
          {eventTypes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 py-20 flex flex-col items-center gap-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <CalendarDays className="w-10 h-10 text-[#c4b09e]" />
              <p className="text-[14px] font-semibold text-[#1c1410]">No calendars yet</p>
              <button onClick={() => navigate('/calendar/edit/new')} className="mt-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white" style={shadowStyle}><Plus className="w-4 h-4 inline mr-1" /> New Calendar</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {eventTypes.map((et) => {
                const url = `https://admin.digygocrm.com/u/${et.slug}`;
                return (
                  <div key={et.id}
                    onClick={() => navigate(`/calendar/edit/${et.id}`, { state: { eventType: et } })}
                    className="bg-white rounded-2xl border border-black/[0.06] flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div className="h-[3px] w-full bg-gradient-to-r from-orange-400 to-orange-300" />
                    <div className="p-5 flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline font-bold text-[15px] text-[#1c1410] mb-0.5">{et.name}</h3>
                          <p className="text-[13px] text-[#7a6b5c]">{et.duration} min</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/calendar/edit/${et.id}`, { state: { eventType: et } }); }}
                          className="p-1.5 rounded-lg hover:bg-[#f5ede3] text-[#b09e8d] hover:text-primary transition-colors" title="Edit">
                          <Settings2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[12px] text-[#7a6b5c] line-clamp-2 mb-3">{et.description}</p>
                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(url); toast.success('Link copied!'); }}
                        className="text-[12px] text-[#7a6b5c] font-medium flex items-center gap-1 hover:text-primary transition-colors">
                        <Copy className="w-3 h-3" /> Copy booking link
                      </button>
                    </div>
                    <div className="px-5 py-3 border-t border-black/[0.04] bg-[#faf8f6] flex items-center justify-between">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setEventTypes((p) => p.map((x) => x.id === et.id ? { ...x, isActive: !x.isActive } : x));
                          toast.success(et.isActive ? 'Set to Inactive' : 'Set to Active');
                        }}
                          className="relative rounded-full transition-colors duration-200 shrink-0"
                          style={{ width: 36, height: 20, background: et.isActive ? '#22c55e' : '#d1d5db' }}>
                          <span className="absolute top-[2px] rounded-full bg-white shadow-sm transition-all duration-200"
                            style={{ width: 16, height: 16, left: et.isActive ? 18 : 2 }} />
                        </button>
                        <span className={cn('text-[12px] font-semibold', et.isActive ? 'text-green-600' : 'text-[#b09e8d]')}>{et.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setEventTypes((p) => p.filter((x) => x.id !== et.id)); toast.success('Deleted'); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#c4b09e] hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ APPOINTMENTS TAB ═══════════ */}
      {tab === 'appointments' && (
        <div className="space-y-5">
          {/* Stat pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'all', label: 'All', count: apptStats.total },
              { key: 'booked', label: 'Booked', count: apptStats.booked },
              { key: 'show-up', label: 'Show Up', count: apptStats.showUp },
              { key: 'no-show', label: 'No Show', count: apptStats.noShow },
              { key: 'cancelled', label: 'Cancelled', count: apptStats.cancelled },
            ] as const).map((f) => (
              <button key={f.key} onClick={() => setApptFilter(f.key)}
                className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold border transition-all',
                  apptFilter === f.key ? 'text-white border-transparent' : 'text-[#7a6b5c] border-black/10 bg-white hover:bg-[#faf8f6]'
                )}
                style={apptFilter === f.key ? shadowStyle : { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {f.label}
                <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold',
                  apptFilter === f.key ? 'bg-white/20' : 'bg-black/[0.06] text-[#7a6b5c]'
                )}>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Appointment cards */}
          {Object.keys(groupedApts).length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 py-20 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Clock className="w-10 h-10 mx-auto text-[#c4b09e] mb-3" />
              <p className="text-[14px] font-semibold text-[#1c1410]">No appointments</p>
              <p className="text-[13px] text-[#7a6b5c] mt-1">No {apptFilter === 'all' ? '' : apptFilter} appointments found.</p>
            </div>
          ) : (
            Object.entries(groupedApts).map(([date, apts]) => (
              <div key={date}>
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#7a6b5c] mb-2 px-1">{format(parseISO(date), 'EEEE, MMMM d, yyyy')}</p>
                <div className="space-y-3">
                  {apts.map((apt) => (
                    <div key={apt.id} className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div className="px-6 py-4 flex items-center gap-5">
                        <div className={cn('w-3 h-3 rounded-full shrink-0', DOT_COLOR[apt.status])} />
                        <div className="flex-1 min-w-0 flex items-center gap-6 flex-wrap">
                          <div className="min-w-[180px]">
                            <p className="text-[14px] font-bold text-[#1c1410]">{apt.leadName}</p>
                            <p className="text-[12px] text-[#7a6b5c]">{apt.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-[#7a6b5c]">
                            <Clock className="w-3.5 h-3.5" /> {fmt12(apt.startTime)} - {fmt12(apt.endTime)}
                          </div>
                          <span className="text-[12px] text-primary font-semibold">{apt.eventTypeName}</span>
                          <span className="text-[11px] text-[#b09e8d]">{apt.timezone}</span>
                        </div>
                        <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0', STATUS_BADGE[apt.status])}>
                          {STATUS_LBL[apt.status]}
                        </span>
                      </div>
                      {apt.status === 'booked' && (
                        <div className="px-6 py-3 border-t border-black/[0.04] bg-[#faf8f6] flex items-center gap-2">
                          <button onClick={() => { setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, status: 'booked' } : a)); toast.success('Rescheduled'); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" /> Reschedule
                          </button>
                          <button onClick={() => { setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, status: 'show-up' } : a)); toast.success('Marked Show Up'); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
                            <UserCheck className="w-3.5 h-3.5" /> Show Up
                          </button>
                          <button onClick={() => { setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, status: 'no-show' } : a)); toast.success('Marked No Show'); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
                            <AlertTriangle className="w-3.5 h-3.5" /> No Show
                          </button>
                          <button onClick={() => { setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, status: 'cancelled' } : a)); toast.success('Cancelled'); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                            <Ban className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {/* ═══════════ AVAILABILITY TAB ═══════════ */}
      {tab === 'availability' && (
        <div className="space-y-4">
          {/* Date navigation */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-black/10 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <button onClick={() => setAvailDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })}
                className="px-3 py-2 hover:bg-[#faf8f6] text-[#7a6b5c] border-r border-black/[0.06]"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-4 text-[13px] font-medium text-[#1c1410]">{format(availDate, 'EEEE, MMMM d, yyyy')}</span>
              <button onClick={() => setAvailDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}
                className="px-3 py-2 hover:bg-[#faf8f6] text-[#7a6b5c] border-l border-black/[0.06]"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <button onClick={() => setAvailDate(new Date())}
              className="px-3 py-2 rounded-xl text-[12px] font-bold text-[#7a6b5c] bg-white border border-black/10 hover:bg-[#faf8f6]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>Today</button>
            <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 inline-block" /> Free</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-200 inline-block" /> Booked</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100 inline-block border border-black/[0.06]" /> Off</span>
            </div>
          </div>

          {/* Timeline grid */}
          <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Hour ruler header */}
            <div className="flex border-b border-black/[0.06] bg-[#faf8f6]">
              <div className="w-44 shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#b09e8d]">Staff</div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${AVAIL_SLOTS.length}, 1fr)` }}>
                {AVAIL_SLOTS.map((slot, i) => (
                  <div key={slot} className={cn('py-2 text-center text-[9px] font-bold text-[#7a6b5c] border-l border-black/[0.05]', i % 2 !== 0 && 'text-transparent')}>
                    {i % 2 === 0 ? fmt12(slot).replace(':00 ', '') : '·'}
                  </div>
                ))}
              </div>
            </div>

            {/* Staff rows */}
            {staff.filter((s) => s.status === 'active').map((member, idx) => (
              <div key={member.id} className={cn('flex items-stretch', idx > 0 && 'border-t border-black/[0.04]')}>
                {/* Staff name */}
                <div className="w-44 shrink-0 flex items-center gap-2.5 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">{member.avatar}</div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[#1c1410] truncate">{member.name}</p>
                    <p className="text-[10px] text-[#b09e8d] capitalize">{member.role}</p>
                  </div>
                </div>

                {/* Time slots */}
                <div className="flex-1 grid py-2.5 gap-px" style={{ gridTemplateColumns: `repeat(${AVAIL_SLOTS.length}, 1fr)` }}>
                  {AVAIL_SLOTS.map((slot) => {
                    const working = isWorking(member.id, slot);
                    const booked = getBookedEvent(member.id, slot);
                    const isSelected = bookingSlot?.staffId === member.id && bookingSlot?.time === slot;
                    return (
                      <div key={slot}
                        title={booked ? `${booked.title} (${fmt12(booked.time)}, ${booked.duration}min)` : working ? 'Click to book appointment' : ''}
                        onClick={() => { if (working && !booked) setBookingSlot({ staffId: member.id, time: slot }); }}
                        className={cn(
                          'h-9 rounded transition-all relative',
                          isSelected ? 'ring-2 ring-primary ring-inset z-10' :
                          booked ? 'bg-orange-100 cursor-default' :
                          working ? 'bg-green-50 hover:bg-green-100 cursor-pointer' :
                          'bg-gray-50 cursor-default'
                        )}>
                        {booked && (
                          <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-0.5">
                            <span className="text-[8px] font-bold text-orange-700 truncate leading-tight text-center">{booked.leadName.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Hint */}
          <p className="text-[11px] text-[#b09e8d] text-center">Click any green slot to book an appointment for that staff member.</p>
        </div>
      )}

      {/* ═══════════ BOOKING MODAL ═══════════ */}
      {bookingSlot && (() => {
        const member = staff.find((s) => s.id === bookingSlot.staffId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setBookingSlot(null); }}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between" style={gradStyle}>
                <div>
                  <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider">Book Appointment</p>
                  <h3 className="text-white font-headline font-semibold text-[16px] mt-0.5">{member?.name}</h3>
                </div>
                <button onClick={() => setBookingSlot(null)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Pre-filled info */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#faf8f6] rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-[#b09e8d] font-semibold uppercase tracking-wider">Date</p>
                    <p className="text-[13px] font-medium text-[#1c1410] mt-0.5">{format(availDate, 'MMM d, yyyy')}</p>
                  </div>
                  <div className="flex-1 bg-[#faf8f6] rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-[#b09e8d] font-medium uppercase tracking-wider">Time</p>
                    <p className="text-[13px] font-medium text-[#1c1410] mt-0.5">{fmt12(bookingSlot.time)}</p>
                  </div>
                </div>

                {/* Lead name */}
                <div>
                  <label className="text-[11px] font-bold text-[#7a6b5c] uppercase tracking-wider block mb-1.5">Lead Name</label>
                  <input value={bookForm.leadName} onChange={(e) => setBookForm((f) => ({ ...f, leadName: e.target.value }))}
                    placeholder="e.g. Rohan Mehta"
                    className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-[13px] text-[#1c1410] outline-none focus:border-primary/40 placeholder:text-[#c4b09e]" />
                </div>

                {/* Event type */}
                <div>
                  <label className="text-[11px] font-bold text-[#7a6b5c] uppercase tracking-wider block mb-1.5">Type</label>
                  <div className="flex gap-2">
                    {(['call', 'demo', 'meeting'] as const).map((t) => (
                      <button key={t} onClick={() => setBookForm((f) => ({ ...f, type: t }))}
                        className={cn('flex-1 py-2 rounded-xl text-[12px] font-bold border capitalize transition-all',
                          bookForm.type === t ? 'text-white border-transparent' : 'text-[#7a6b5c] border-black/10 bg-white hover:bg-[#faf8f6]'
                        )}
                        style={bookForm.type === t ? shadowStyle : {}}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-[11px] font-bold text-[#7a6b5c] uppercase tracking-wider block mb-1.5">Duration</label>
                  <div className="flex gap-2">
                    {[15, 30, 60].map((d) => (
                      <button key={d} onClick={() => setBookForm((f) => ({ ...f, duration: d }))}
                        className={cn('flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all',
                          bookForm.duration === d ? 'text-white border-transparent' : 'text-[#7a6b5c] border-black/10 bg-white hover:bg-[#faf8f6]'
                        )}
                        style={bookForm.duration === d ? shadowStyle : {}}>
                        {d}min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setBookingSlot(null)}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-[#7a6b5c] border border-black/10 bg-white hover:bg-[#faf8f6]">
                    Cancel
                  </button>
                  <button onClick={handleBookSlot} disabled={!bookForm.leadName.trim()}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-opacity disabled:opacity-40"
                    style={shadowStyle}>
                    Confirm Booking
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
