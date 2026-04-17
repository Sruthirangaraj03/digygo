import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Copy, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const gradStyle  = { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 55%, #f97316 100%)' };
const shadowStyle = { ...gradStyle, boxShadow: '0 4px 14px rgba(234,88,12,0.28)' };

interface TimeSlot   { start: string; end: string; }
interface DaySchedule { enabled: boolean; slots: TimeSlot[]; }
interface FormField  { id: string; label: string; required: boolean; enabled: boolean; }
export interface EventType {
  id: string; name: string; duration: number; description: string; slug: string;
  staffType: 'single' | 'multi'; assignmentMode: 'round-robin' | 'priority';
  staffEmails: string[]; meetingType: string;
  schedulingType: 'days' | 'range' | 'indefinite'; daysInFuture: number;
  timeZone: string; schedule: Record<string, DaySchedule>; bufferTime: number;
  isActive: boolean; formFields: FormField[];
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = {
  Sun: { enabled: true,  slots: [{ start: '09:30', end: '10:00' }, { start: '11:00', end: '11:30' }, { start: '16:00', end: '16:30' }] },
  Mon: { enabled: true,  slots: [{ start: '09:30', end: '10:00' }, { start: '11:00', end: '11:30' }, { start: '16:00', end: '16:30' }] },
  Tue: { enabled: true,  slots: [{ start: '09:00', end: '09:30' }, { start: '12:00', end: '12:30' }, { start: '16:00', end: '16:30' }] },
  Wed: { enabled: true,  slots: [{ start: '09:30', end: '10:00' }, { start: '11:00', end: '11:30' }, { start: '16:00', end: '16:30' }] },
  Thu: { enabled: true,  slots: [{ start: '09:30', end: '10:00' }, { start: '11:00', end: '11:30' }, { start: '16:00', end: '16:30' }] },
  Fri: { enabled: true,  slots: [{ start: '09:30', end: '10:00' }, { start: '11:00', end: '11:30' }, { start: '16:00', end: '16:30' }] },
  Sat: { enabled: false, slots: [] },
};
const DEFAULT_FIELDS: FormField[] = [
  { id: 'ff1', label: 'Name',         required: true,  enabled: true  },
  { id: 'ff2', label: 'Email',        required: true,  enabled: true  },
  { id: 'ff3', label: 'Phone',        required: true,  enabled: true  },
  { id: 'ff4', label: 'Custom Field', required: false, enabled: false },
];

function BlueToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative rounded-full transition-colors duration-200 shrink-0"
      style={{ width: 40, height: 22, background: on ? '#3b82f6' : '#d1d5db' }}>
      <span className="absolute top-[2px] rounded-full bg-white shadow-sm transition-all duration-200"
        style={{ width: 18, height: 18, left: on ? 20 : 2 }} />
    </button>
  );
}

export default function CalendarEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const et = location.state?.eventType as EventType | undefined;
  const isEdit = !!et;

  const [section, setSection] = useState<'details' | 'availability' | 'fields'>('details');
  const [form, setForm] = useState<EventType>(et ? JSON.parse(JSON.stringify(et)) : {
    id: `et-${Date.now()}`, name: '', duration: 30, description: '', slug: '',
    staffType: 'single', assignmentMode: 'round-robin',
    staffEmails: ['sruthirangaraj1212@gmail.com', 'rosinirangaraj@gmail.com'],
    meetingType: 'Google Meet', schedulingType: 'days', daysInFuture: 40,
    timeZone: 'Asia/Kolkata', schedule: JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)),
    bufferTime: 0, isActive: true, formFields: JSON.parse(JSON.stringify(DEFAULT_FIELDS)),
  });
  const [bookingsPerSlot, setBookingsPerSlot] = useState(1);
  const [minNotice, setMinNotice] = useState(2);
  const [minNoticeUnit, setMinNoticeUnit] = useState('days');

  const upd = (k: keyof EventType, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const toggleDay  = (day: string) => setForm((p) => ({ ...p, schedule: { ...p.schedule, [day]: { ...p.schedule[day], enabled: !p.schedule[day].enabled } } }));
  const addSlot    = (day: string) => setForm((p) => ({ ...p, schedule: { ...p.schedule, [day]: { ...p.schedule[day], slots: [...p.schedule[day].slots, { start: '09:00', end: '09:30' }] } } }));
  const removeSlot = (day: string, i: number) => setForm((p) => ({ ...p, schedule: { ...p.schedule, [day]: { ...p.schedule[day], slots: p.schedule[day].slots.filter((_, si) => si !== i) } } }));
  const updateSlot = (day: string, i: number, f: 'start' | 'end', v: string) => setForm((p) => ({ ...p, schedule: { ...p.schedule, [day]: { ...p.schedule[day], slots: p.schedule[day].slots.map((s, si) => si === i ? { ...s, [f]: v } : s) } } }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Calendar name is required'); return; }
    const saved = { ...form, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') };
    toast.success(isEdit ? 'Calendar updated' : 'Calendar created');
    navigate('/calendar', { state: { savedEventType: saved } });
  };

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-primary/40 bg-white transition-colors';

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/calendar')}
            className="p-2 rounded-xl hover:bg-[#f5ede3] text-[#7a6b5c] hover:text-[#1c1410] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-headline text-[18px] font-bold text-[#1c1410]">
            {isEdit ? form.name || 'Edit Calendar' : 'New Calendar'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/calendar')}
            className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6b5c] border border-black/10 bg-white hover:bg-[#f5ede3] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:-translate-y-0.5"
            style={shadowStyle}>
            <Check className="w-4 h-4" /> {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-black/5">
        {(['details', 'availability', 'fields'] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)}
            className={cn('px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors',
              section === s ? 'border-primary text-primary' : 'border-transparent text-[#7a6b5c] hover:text-[#1c1410]')}>
            {s === 'details' ? 'Details' : s === 'availability' ? 'Availability' : 'Form Fields'}
          </button>
        ))}
      </div>

      {/* ── DETAILS ── */}
      {section === 'details' && (
        <div className="bg-white rounded-2xl border border-black/5 p-8 space-y-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
            <div className="space-y-5">
              <div>
                <label className="text-[13px] font-semibold text-[#1c1410] mb-1.5 block">Calendar name <span className="text-red-500">*</span></label>
                <input className={inp} placeholder="DigyGoSlotBooking" value={form.name} onChange={(e) => upd('name', e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#1c1410] mb-2 block">Assign Staff</label>
                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {form.staffEmails.map((email, i) => (
                    <label key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf8f6] cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary rounded" />
                      <span className="text-[13px] text-[#1c1410]">{email}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#1c1410] mb-1.5 block">Description</label>
                <textarea className={cn(inp, 'resize-none min-h-[120px]')} placeholder="Describe this calendar..." value={form.description} onChange={(e) => upd('description', e.target.value)} />
              </div>
            </div>
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className={cn('text-[13px] font-medium', form.staffType === 'single' ? 'text-[#1c1410]' : 'text-[#b09e8d]')}>Single Staff</span>
                <button onClick={() => upd('staffType', form.staffType === 'single' ? 'multi' : 'single')}
                  className="relative rounded-full transition-colors duration-200 shrink-0"
                  style={{ width: 44, height: 24, background: form.staffType === 'multi' ? '#1c1410' : '#d1d5db' }}>
                  <span className="absolute top-[3px] rounded-full bg-white shadow transition-all duration-200"
                    style={{ width: 18, height: 18, left: form.staffType === 'multi' ? 23 : 3 }} />
                </button>
                <span className={cn('text-[13px] font-medium', form.staffType === 'multi' ? 'text-[#1c1410]' : 'text-[#b09e8d]')}>Multi Staff</span>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#1c1410] mb-2 block">Location <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3 py-2.5 mb-2 bg-white">
                  <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ background: 'linear-gradient(135deg,#4285F4 0%,#0F9D58 50%,#EA4335 100%)' }}>
                    <span className="text-white text-[8px] font-extrabold">G</span>
                  </div>
                  <span className="text-[13px] text-[#1c1410] flex-1">Google Meet</span>
                  <button onClick={() => upd('meetingType', '')} className="text-[#b09e8d] hover:text-[#7a6b5c]"><X className="w-4 h-4" /></button>
                </div>
                <div className="relative">
                  <select className={cn(inp, 'appearance-none pr-8')} onChange={(e) => { if (e.target.value) upd('meetingType', e.target.value); }}>
                    <option value="">Add a location</option>
                    {['Google Meet', 'Zoom', 'Microsoft Teams', 'Phone Call', 'In-Person'].map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b09e8d] pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#1c1410] mb-1.5 block">Duration (min)</label>
                <select className={inp} value={form.duration} onChange={(e) => upd('duration', Number(e.target.value))}>
                  {[15, 20, 30, 45, 60, 90, 120].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#1c1410] mb-1.5 block">Bookings Per Slot</label>
                <input type="number" min={1} className={inp} value={bookingsPerSlot} onChange={(e) => setBookingsPerSlot(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="border-t border-black/[0.04] pt-6 grid grid-cols-2 gap-8">
            <div>
              <label className="text-[13px] font-semibold text-[#1c1410] mb-1.5 block">Minimum Scheduling Notice</label>
              <div className="flex items-center gap-2">
                <input type="number" className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-primary/40" value={minNotice} onChange={(e) => setMinNotice(Number(e.target.value))} />
                <div className="relative">
                  <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none appearance-none pr-8 bg-white" value={minNoticeUnit} onChange={(e) => setMinNoticeUnit(e.target.value)}>
                    {['minutes', 'hours', 'days'].map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b09e8d] pointer-events-none" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-[13px] font-semibold text-[#1c1410] mb-1.5 block">Time Zone</label>
              <select className={inp} value={form.timeZone} onChange={(e) => upd('timeZone', e.target.value)}>
                {['Asia/Kolkata','UTC','America/New_York','Europe/London','Asia/Singapore'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between py-3 border-t border-black/[0.04]">
            <div>
              <p className="text-[13px] font-semibold text-[#1c1410]">Active</p>
              <p className="text-[11px] text-[#7a6b5c]">Allow invitees to book this calendar</p>
            </div>
            <BlueToggle on={form.isActive} onChange={() => upd('isActive', !form.isActive)} />
          </div>
        </div>
      )}

      {/* ── AVAILABILITY ── */}
      {section === 'availability' && (
        <div className="bg-white rounded-2xl border border-black/5 p-8" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
            <div>
              <p className="text-[14px] font-bold text-[#1c1410] mb-5">Set your weekly hours</p>
              <div className="space-y-0 divide-y divide-black/[0.04]">
                {DAYS_SHORT.map((day) => {
                  const ds = form.schedule[day];
                  return (
                    <div key={day} className="py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 w-20 shrink-0 pt-0.5">
                          <input type="checkbox" checked={ds.enabled} onChange={() => toggleDay(day)} className="w-4 h-4 accent-primary cursor-pointer" />
                          <span className={cn('text-[13px] font-bold', ds.enabled ? 'text-[#1c1410]' : 'text-[#b09e8d]')}>{day}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {!ds.enabled ? (
                            <span className="text-[13px] text-[#b09e8d]">Unavailable</span>
                          ) : (
                            <div className="space-y-1.5">
                              {ds.slots.map((slot, si) => (
                                <div key={si} className="flex items-center gap-2">
                                  <input type="time" value={slot.start} onChange={(e) => updateSlot(day, si, 'start', e.target.value)}
                                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-primary/40 w-28" />
                                  <span className="text-[12px] text-[#b09e8d]">-</span>
                                  <input type="time" value={slot.end} onChange={(e) => updateSlot(day, si, 'end', e.target.value)}
                                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-primary/40 w-28" />
                                  <button onClick={() => removeSlot(day, si)} className="p-1 rounded hover:bg-red-50 text-[#c4b09e] hover:text-red-400 transition-colors ml-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {ds.enabled && (
                          <div className="flex items-center gap-1 shrink-0 pt-0.5">
                            <button onClick={() => addSlot(day)} className="p-1.5 rounded hover:bg-[#f5ede3] text-[#b09e8d] hover:text-primary transition-colors" title="Add slot">
                              <Plus className="w-4 h-4" />
                            </button>
                            <button onClick={() => {
                              const src = form.schedule[day].slots;
                              DAYS_SHORT.filter((d) => d !== day && form.schedule[d].enabled).forEach((d) => {
                                setForm((p) => ({ ...p, schedule: { ...p.schedule, [d]: { ...p.schedule[d], slots: JSON.parse(JSON.stringify(src)) } } }));
                              });
                              toast.success(`Copied ${day} slots to all active days`);
                            }} className="p-1.5 rounded hover:bg-[#f5ede3] text-[#b09e8d] hover:text-primary transition-colors" title="Copy to all days">
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border-l border-black/[0.04] pl-8 pt-8">
              <p className="text-[13px] font-bold text-[#1c1410] mb-1">Add date overrides</p>
              <p className="text-[12px] text-[#7a6b5c] mb-4 leading-relaxed">Add dates when your availability changes from your weekly hours.</p>
              <button className="w-full border border-gray-200 rounded-xl py-2.5 text-[13px] text-[#7a6b5c] hover:bg-[#faf8f6] transition-colors flex items-center justify-center gap-1.5">
                Add a date override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM FIELDS ── */}
      {section === 'fields' && (
        <div className="bg-white rounded-2xl border border-black/5 p-8 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p className="text-[13px] text-[#7a6b5c] mb-4">Customize the fields shown to invitees on the booking form.</p>
          {form.formFields.map((f) => (
            <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 bg-[#faf8f6] rounded-xl border border-black/[0.04]">
              <BlueToggle on={f.enabled} onChange={() => setForm((p) => ({ ...p, formFields: p.formFields.map((ff) => ff.id === f.id ? { ...ff, enabled: !ff.enabled } : ff) }))} />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#1c1410]">{f.label}</p>
              </div>
              {f.enabled && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setForm((p) => ({ ...p, formFields: p.formFields.map((ff) => ff.id === f.id ? { ...ff, required: !ff.required } : ff) }))}
                    className="relative rounded-full transition-colors duration-200"
                    style={{ width: 34, height: 19, background: f.required ? '#ea580c' : '#d1d5db' }}>
                    <span className="absolute top-[2.5px] rounded-full bg-white shadow transition-all duration-200" style={{ width: 14, height: 14, left: f.required ? 17 : 2.5 }} />
                  </button>
                  <span className="text-[12px] text-[#7a6b5c]">Required</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
