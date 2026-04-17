import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, Zap, Plus, X, ChevronDown, Check, Search,
  Play, Settings, Save, AlertCircle, Trash2, Clock, Pencil,
  ClipboardList, FolderOpen, User, Calendar, Inbox, MessageCircle,
  Banknote, GraduationCap, Terminal, ZoomIn, ZoomOut, Lock, Maximize2,
  FolderPlus, Bot, UserCheck, CalendarCheck, Star, ArrowLeftRight, Tag,
  Mail, Smartphone, Bell, Timer, GitBranch, CalendarPlus, FileText,
  Camera, ThumbsUp, Globe, Code, MessageSquare,
  Package, ClipboardPen, Infinity as InfinityIcon, Network, History,
  FilePlus, UserPlus, UserCog, BookMarked, CalendarX, CalendarOff,
  ListChecks, Code2, CalendarDays, CalendarClock, CalendarRange, ArrowRight,
  UserMinus, UserX, FolderX, PlayCircle, LogOut, SquareMinus, Users, UserRoundCog,
  RotateCcw, ChevronRight, Copy, Power, Info, ExternalLink,
} from 'lucide-react';
import type { ElementType } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { WFNode, WFRecord } from './AutomationPage';

// ── Trigger Categories ─────────────────────────────────────────────────────────
interface TriggerItem { id: string; label: string; Icon: ElementType; sourceId: string }
interface TriggerCategory { id: string; label: string; items: TriggerItem[] }

const TRIGGER_CATEGORIES: TriggerCategory[] = [
  {
    id: 'forms', label: 'Forms',
    items: [
      { id: 'product_enquired', label: 'Product Enquired', Icon: Package, sourceId: 'forms' },
      { id: 'opt_in_form', label: 'Opt-In Form', Icon: ClipboardPen, sourceId: 'forms' },
      { id: 'meta_form', label: 'Meta Form', Icon: InfinityIcon, sourceId: 'forms' },
    ],
  },
  {
    id: 'crm', label: 'CRM',
    items: [
      { id: 'lead_created', label: 'Added to Pipeline', Icon: Network, sourceId: 'crm' },
      { id: 'stage_changed', label: 'Stage Changed', Icon: ArrowLeftRight, sourceId: 'crm' },
      { id: 'follow_up', label: 'Follow Up', Icon: History, sourceId: 'crm' },
      { id: 'notes_added', label: 'Notes Added', Icon: FilePlus, sourceId: 'crm' },
    ],
  },
  {
    id: 'contact', label: 'Contact',
    items: [
      { id: 'contact_created', label: 'Contact Source', Icon: UserPlus, sourceId: 'contact' },
      { id: 'contact_updated', label: 'Contact Updated', Icon: UserCog, sourceId: 'contact' },
      { id: 'contact_tagged', label: 'Contact Tagged', Icon: BookMarked, sourceId: 'contact' },
    ],
  },
  {
    id: 'calendar', label: 'Calendar',
    items: [
      { id: 'appointment_booked', label: 'Appointment Booked', Icon: CalendarCheck, sourceId: 'calendar' },
      { id: 'appointment_cancelled', label: 'Appointment Cancelled', Icon: CalendarX, sourceId: 'calendar' },
      { id: 'appointment_rescheduled', label: 'Appointment Rescheduled', Icon: CalendarClock, sourceId: 'calendar' },
      { id: 'appointment_noshow', label: 'No-Show Appointment', Icon: CalendarOff, sourceId: 'calendar' },
      { id: 'appointment_showup', label: 'Show Up Appointment', Icon: ListChecks, sourceId: 'calendar' },
    ],
  },
  {
    id: 'api', label: 'External API',
    items: [
      { id: 'webhook_inbound', label: 'API 1.0', Icon: Code2, sourceId: 'api' },
    ],
  },
  {
    id: 'schedule', label: 'Schedule',
    items: [
      { id: 'specific_date', label: 'Specific date', Icon: CalendarDays, sourceId: 'schedule' },
      { id: 'weekly_recurring', label: 'Weekly recurring', Icon: CalendarRange, sourceId: 'schedule' },
      { id: 'monthly_recurring', label: 'Monthly recurring', Icon: CalendarRange, sourceId: 'schedule' },
      { id: 'event_date', label: 'Event Date', Icon: CalendarClock, sourceId: 'schedule' },
    ],
  },
  {
    id: 'inbox', label: 'Inbox',
    items: [
      { id: 'inbox_message', label: 'New Message', Icon: Inbox, sourceId: 'inbox' },
    ],
  },
  {
    id: 'comments', label: 'Comments / DM',
    items: [
      { id: 'comment_received', label: 'Comment Received', Icon: MessageCircle, sourceId: 'comments' },
      { id: 'dm_received', label: 'DM Received', Icon: MessageSquare, sourceId: 'comments' },
    ],
  },
  {
    id: 'finance', label: 'Finance',
    items: [
      { id: 'payment_received', label: 'Payment Received', Icon: Banknote, sourceId: 'finance' },
    ],
  },
  {
    id: 'lms', label: 'LMS',
    items: [
      { id: 'course_enrolled', label: 'Course Enrolled', Icon: GraduationCap, sourceId: 'lms' },
    ],
  },
];

// ── Action Categories ──────────────────────────────────────────────────────────
type ActionCategory = 'All' | 'Communication' | 'Conditions' | 'Operation' | 'Social' | 'External Apps' | 'Webhooks';

const ACTION_LIST: { id: string; label: string; desc: string; category: ActionCategory; Icon: ElementType; color: string }[] = [
  { id: 'add_to_crm', label: 'Add/Update to CRM', desc: 'Add/Update Contact to CRM', category: 'Operation', Icon: FolderPlus, color: 'bg-blue-100 text-blue-600' },
  { id: 'assign_ai', label: 'Assign To AI Agent', desc: 'Assign To AI Agent', category: 'Operation', Icon: Bot, color: 'bg-purple-100 text-purple-600' },
  { id: 'assign_staff', label: 'Assign To Staff', desc: 'Assign lead to a specific staff member', category: 'Operation', Icon: UserCheck, color: 'bg-green-100 text-green-600' },
  { id: 'change_appointment', label: 'Change Appointment Status', desc: 'Update Appointment Status to any', category: 'Operation', Icon: CalendarCheck, color: 'bg-orange-100 text-orange-600' },
  { id: 'change_lead_quality', label: 'Change Lead Quality', desc: 'Change Lead Quality in CRM (Selected Pipeline)', category: 'Operation', Icon: Star, color: 'bg-yellow-100 text-yellow-600' },
  { id: 'change_stage', label: 'Change Pipeline Stage', desc: 'Move lead to a different pipeline stage', category: 'Operation', Icon: ArrowLeftRight, color: 'bg-indigo-100 text-indigo-600' },
  { id: 'add_tag', label: 'Add Tag', desc: 'Apply a tag to the lead', category: 'Operation', Icon: Tag, color: 'bg-teal-100 text-teal-600' },
  { id: 'remove_tag', label: 'Remove Tag', desc: 'Remove a tag from the lead', category: 'Operation', Icon: Trash2, color: 'bg-red-100 text-red-600' },
  { id: 'internal_notify', label: 'Internal Notification', desc: 'Send an Internal Notification', category: 'Communication', Icon: Bell, color: 'bg-gray-800 text-white' },
  { id: 'send_email', label: 'Send Email', desc: 'Send an automated email', category: 'Communication', Icon: Mail, color: 'bg-gray-800 text-white' },
  { id: 'send_sms', label: 'Send SMS', desc: 'Send an automated SMS', category: 'Communication', Icon: MessageSquare, color: 'bg-gray-800 text-white' },
  { id: 'send_whatsapp', label: 'WhatsApp Message', desc: 'Send a automated whatsapp message', category: 'Communication', Icon: MessageCircle, color: 'bg-gray-800 text-white' },
  { id: 'delay', label: 'Time Delay', desc: 'Wait before executing the next action', category: 'Conditions', Icon: Timer, color: 'bg-slate-100 text-slate-600' },
  { id: 'if_else', label: 'If / Else Condition', desc: 'Branch based on a condition', category: 'Conditions', Icon: GitBranch, color: 'bg-yellow-100 text-yellow-600' },
  { id: 'create_followup', label: 'Create Follow-up', desc: 'Schedule a follow-up task', category: 'Operation', Icon: CalendarPlus, color: 'bg-rose-100 text-rose-600' },
  { id: 'create_note', label: 'Add Note', desc: 'Add a note to the lead record', category: 'Operation', Icon: FileText, color: 'bg-lime-100 text-lime-600' },
  { id: 'contact_group', label: 'Contact Group', desc: 'Copy or move contact to another list', category: 'Operation', Icon: Users, color: 'bg-cyan-100 text-cyan-600' },
  { id: 'contact_group_access', label: 'Contact Group Access', desc: 'Give group access to contact', category: 'Operation', Icon: UserRoundCog, color: 'bg-sky-100 text-sky-600' },
  { id: 'event_start_time', label: 'Event Start Time', desc: 'Event/Webinar time when it starts', category: 'Operation', Icon: PlayCircle, color: 'bg-orange-100 text-orange-600' },
  { id: 'execute_automation', label: 'Execute Automation', desc: 'Can run another automation workflow', category: 'Operation', Icon: SquareMinus, color: 'bg-slate-100 text-slate-600' },
  { id: 'exit_workflow', label: 'Exit Workflow', desc: 'Stop executing the workflow', category: 'Operation', Icon: LogOut, color: 'bg-gray-100 text-gray-700' },
  { id: 'remove_staff', label: 'Remove Assigned Staff', desc: 'Remove assigned staff from contact', category: 'Operation', Icon: UserMinus, color: 'bg-red-100 text-red-600' },
  { id: 'remove_contact', label: 'Remove Contact', desc: 'Remove contact from selected list', category: 'Operation', Icon: UserX, color: 'bg-red-100 text-red-700' },
  { id: 'remove_from_crm', label: 'Remove from CRM', desc: 'Remove contact from CRM', category: 'Operation', Icon: FolderX, color: 'bg-red-100 text-red-600' },
  { id: 'remove_workflow', label: 'Remove Workflow', desc: 'Remove a contact from the current workflow', category: 'Operation', Icon: X, color: 'bg-gray-100 text-gray-600' },
  { id: 'tag_contact', label: 'Tag Contact', desc: 'Assign one or more tags to your contact', category: 'Operation', Icon: Tag, color: 'bg-teal-100 text-teal-600' },
  { id: 'update_attributes', label: "Update Contact's Attributes", desc: 'Update first name, last name, or any custom field', category: 'Operation', Icon: UserCog, color: 'bg-indigo-100 text-indigo-600' },
  { id: 'post_instagram', label: 'Instagram DM', desc: 'Send an Instagram direct message', category: 'Social', Icon: Camera, color: 'bg-pink-100 text-pink-600' },
  { id: 'facebook_post', label: 'Facebook Comment Reply', desc: 'Reply to a Facebook comment', category: 'Social', Icon: ThumbsUp, color: 'bg-blue-100 text-blue-600' },
  { id: 'webhook_call', label: 'Webhook Call', desc: 'POST data to an external URL', category: 'Webhooks', Icon: Globe, color: 'bg-gray-100 text-gray-600' },
  { id: 'api_call', label: 'API Request', desc: 'Make an HTTP GET/POST request', category: 'External Apps', Icon: Code, color: 'bg-violet-100 text-violet-600' },
];

const ACTION_CATEGORIES: ActionCategory[] = ['All', 'Communication', 'Conditions', 'Operation', 'Social', 'External Apps', 'Webhooks'];

const STAFF_OPTIONS = ['Ranjith Kumar', 'Priya Sharma', 'Amit Patel', 'Sara Reddy', 'Vikram Singh'];
const STAGES = ['New Leads', 'Contacted', 'Qualified', 'Proposal Sent', 'Closed Won'];
const PAGES = ['Saral Bakery', 'TechWave Solutions', 'GreenLeaf Organics'];
const FORMS = ['Video Editor Wanter', 'Demo Request Form', 'Contact Us Form'];
const EMAIL_TEMPLATES = ['Select Existing Template', 'Welcome Email', 'Proposal Sent', 'Follow-up Reminder', 'Onboarding Guide'];
const WA_TEMPLATES = [
  'Webinar Welcome Message', '3 hours to go', '1 hour to go', '30 mins to go', 'Live Now',
  'Welcome Message (Immediately After Booking)', 'Reminder Message (4 Hours Before Call)',
  'Reminder Message (30 Minutes Before Call)', 'Join Now Message (At Call Time)',
  'Welcome Email (Website lead)', 'Nurture 1 (Website Lead)', 'Nurture 2 (Website Funnel)',
  'Nurture 3 (Website Funnel)', '2 days to Webinar', '1 day to Webinar',
];
const PIPELINES = ['1 to 1 Funnel', 'Sales Pipeline', 'Support Pipeline', 'Onboarding Pipeline'];
const LEAD_QUALITIES = ['Hot', 'Warm', 'Cold', 'Unqualified'];
const CONTACT_LISTS = ['Newsletter', 'VIP Clients', 'Webinar Attendees', 'Trial Users'];
const APPT_STATUSES = ['Booked', 'Cancelled', 'Completed', 'No Show', 'Rescheduled'];
const AI_AGENTS = ['Sales Bot', 'Support Bot', 'Onboarding Bot', 'FAQ Bot'];
const COURSES = ['Sales Mastery', 'Marketing 101', 'Product Training', 'Onboarding Course'];
const FOLLOWUP_TYPES = ['Call', 'Email', 'WhatsApp', 'Meeting', 'Task'];
const CONDITION_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'city', 'company', 'pipeline_stage', 'lead_quality', 'tag', 'source', 'assigned_staff'];
const CONDITION_OPERATORS = ['equals', 'not equals', 'contains', 'not contains', 'starts with', 'ends with', 'is empty', 'is not empty', 'greater than', 'less than'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const INSTAGRAM_TEMPLATES = ['IG Welcome DM', 'IG Promo Offer', 'IG Event Invite'];
const FB_TEMPLATES = ['FB Thanks Reply', 'FB Promo Reply', 'FB Support Reply'];

// ── Node style helpers ─────────────────────────────────────────────────────────
const nodeStyle = (type: WFNode['type']) => {
  if (type === 'trigger') return 'bg-indigo-500 hover:bg-indigo-600 text-white';
  if (type === 'condition') return 'bg-amber-500 hover:bg-amber-600 text-white';
  if (type === 'delay') return 'bg-sky-500 hover:bg-sky-600 text-white';
  return 'bg-emerald-500 hover:bg-emerald-600 text-white';
};

const nodeIcon = (actionType: string): ElementType => {
  const found = ACTION_LIST.find((a) => a.id === actionType);
  if (found) return found.Icon;
  for (const cat of TRIGGER_CATEGORIES) {
    const item = cat.items.find((i) => i.id === actionType);
    if (item) return item.Icon;
  }
  return Zap;
};

function NodeIconRenderer({ actionType }: { actionType: string }) {
  const Icon = nodeIcon(actionType);
  return <Icon className="w-4 h-4" />;
}

// ── Shared field row ───────────────────────────────────────────────────────────
function FieldRow({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1.5 block">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1"><AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />{hint}</p>}
    </div>
  );
}

const selectCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-primary outline-none';
const inputCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-primary outline-none';

// ── Trigger Config Panel ───────────────────────────────────────────────────────
function TriggerConfigPanel({ node, onUpdate, onChangeTrigger }: {
  node: WFNode;
  onUpdate: (updates: Partial<WFNode>) => void;
  onChangeTrigger: () => void;
}) {
  const cfg = node.config;
  const sel = (field: string) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
    onUpdate({ config: { ...cfg, [field]: e.target.value } });

  const isForm = ['product_enquired', 'opt_in_form', 'meta_form'].includes(node.actionType);

  return (
    <div className="space-y-5">

      {/* Forms triggers */}
      {isForm && (<>
        <div className="flex items-center gap-2 mb-1">
          <InfinityIcon className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold text-sm">{node.label}</span>
        </div>
        <FieldRow label="Facebook Page" required hint="Only pages connected through the App Store are available.">
          <select className={selectCls} value={(cfg.page as string) ?? ''} onChange={sel('page')}>
            <option value="">Select page...</option>
            {PAGES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Form" hint="Only forms that are mapped and active will be displayed here.">
          <div className="w-full border border-border rounded-lg px-3 py-2 min-h-10 flex flex-wrap gap-1.5 items-center cursor-text bg-card">
            {((cfg.forms as string[]) ?? []).map((f) => (
              <span key={f} className="flex items-center gap-1 bg-muted text-foreground text-xs px-2 py-1 rounded-full">
                {f}
                <button onClick={() => onUpdate({ config: { ...cfg, forms: ((cfg.forms as string[]) ?? []).filter((x) => x !== f) } })}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <select className="flex-1 min-w-24 outline-none text-sm bg-transparent text-muted-foreground" value="" onChange={(e) => {
              if (e.target.value && !((cfg.forms as string[]) ?? []).includes(e.target.value))
                onUpdate({ config: { ...cfg, forms: [...((cfg.forms as string[]) ?? []), e.target.value] } });
            }}>
              <option value="">+ Add form...</option>
              {FORMS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </FieldRow>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 font-semibold mb-1">Facebook Lead Testing Tool</p>
          <p className="text-xs text-blue-700">Use this tool to simulate lead submissions and test your automation flow.</p>
          <a href="#" className="text-xs text-blue-600 font-medium hover:underline mt-1 block">Click here to access &rarr;</a>
        </div>
      </>)}

      {/* CRM — stage changed */}
      {node.actionType === 'stage_changed' && (<>
        <FieldRow label="Pipeline Stage">
          <select className={selectCls} value={(cfg.stage as string) ?? ''} onChange={sel('stage')}>
            <option value="">Any stage change</option>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Pipeline">
          <select className={selectCls} value={(cfg.pipeline as string) ?? ''} onChange={sel('pipeline')}>
            <option value="">Any pipeline</option>
            {PIPELINES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
      </>)}

      {/* CRM — lead created */}
      {node.actionType === 'lead_created' && (<>
        <FieldRow label="Pipeline">
          <select className={selectCls} value={(cfg.pipeline as string) ?? ''} onChange={sel('pipeline')}>
            <option value="">Any pipeline</option>
            {PIPELINES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Source Filter">
          <select className={selectCls} value={(cfg.source as string) ?? ''} onChange={sel('source')}>
            <option value="">Any source</option>
            {['Meta Forms', 'WhatsApp', 'Custom Form', 'Manual', 'Landing Page'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </FieldRow>
      </>)}

      {/* CRM — follow up */}
      {node.actionType === 'follow_up' && (<>
        <FieldRow label="Follow-up Type">
          <select className={selectCls} value={(cfg.followupType as string) ?? ''} onChange={sel('followupType')}>
            <option value="">Any type</option>
            {FOLLOWUP_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Assigned To">
          <select className={selectCls} value={(cfg.assignedTo as string) ?? ''} onChange={sel('assignedTo')}>
            <option value="">Any staff</option>
            {STAFF_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FieldRow>
      </>)}

      {/* CRM — notes added */}
      {node.actionType === 'notes_added' && (
        <div className="py-4 text-center text-sm text-muted-foreground bg-muted/40 rounded-xl">
          <FilePlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium text-foreground">Notes Added</p>
          <p className="text-xs mt-1">Triggers whenever a note is added to any contact. No additional filter required.</p>
        </div>
      )}

      {/* Contact triggers */}
      {node.actionType === 'contact_created' && (<>
        <FieldRow label="Contact Source">
          <select className={selectCls} value={(cfg.source as string) ?? ''} onChange={sel('source')}>
            <option value="">Any source</option>
            {['Meta Form', 'WhatsApp', 'Custom Form', 'Manual Entry', 'API Import'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </FieldRow>
      </>)}

      {node.actionType === 'contact_updated' && (<>
        <FieldRow label="Field Changed">
          <select className={selectCls} value={(cfg.fieldChanged as string) ?? ''} onChange={sel('fieldChanged')}>
            <option value="">Any field</option>
            {['first_name', 'last_name', 'email', 'phone', 'city', 'company', 'tag', 'assigned_staff'].map((f) => <option key={f}>{f}</option>)}
          </select>
        </FieldRow>
      </>)}

      {node.actionType === 'contact_tagged' && (<>
        <FieldRow label="Tag">
          <input className={inputCls} placeholder="Enter tag name (leave empty for any tag)" value={(cfg.tag as string) ?? ''} onChange={sel('tag')} />
        </FieldRow>
      </>)}

      {/* Calendar triggers */}
      {['appointment_booked', 'appointment_cancelled', 'appointment_rescheduled', 'appointment_noshow', 'appointment_showup'].includes(node.actionType) && (<>
        <FieldRow label="Appointment Type">
          <select className={selectCls} value={(cfg.apptType as string) ?? ''} onChange={sel('apptType')}>
            <option value="">All types</option>
            <option>Demo</option>
            <option>Meeting</option>
            <option>Call</option>
            <option>Consultation</option>
          </select>
        </FieldRow>
        <FieldRow label="Booking Link (optional)">
          <select className={selectCls} value={(cfg.bookingLink as string) ?? ''} onChange={sel('bookingLink')}>
            <option value="">Any booking link</option>
            <option>30-min Intro Call</option>
            <option>60-min Strategy Session</option>
            <option>Product Demo</option>
          </select>
        </FieldRow>
      </>)}

      {/* Webhook / API trigger */}
      {node.actionType === 'webhook_inbound' && (<>
        <div className="bg-muted/40 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Code2 className="w-4 h-4" /> Inbound Webhook URL</p>
          <code className="text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg block break-all">
            https://api.digygo.com/webhooks/inbound/org_abc123
          </code>
          <button className="text-xs text-primary font-medium flex items-center gap-1 hover:underline" onClick={() => { navigator.clipboard.writeText('https://api.digygo.com/webhooks/inbound/org_abc123'); toast.success('Copied!'); }}>
            <Copy className="w-3 h-3" /> Copy URL
          </button>
        </div>
        <FieldRow label="Filter by Event Type (optional)">
          <input className={inputCls} placeholder="e.g. form_submit, payment_done" value={(cfg.eventType as string) ?? ''} onChange={sel('eventType')} />
        </FieldRow>
      </>)}

      {/* Schedule triggers */}
      {node.actionType === 'specific_date' && (<>
        <FieldRow label="Date" required>
          <input type="date" className={inputCls} value={(cfg.date as string) ?? ''} onChange={sel('date')} />
        </FieldRow>
        <FieldRow label="Time">
          <input type="time" className={inputCls} value={(cfg.time as string) ?? '09:00'} onChange={sel('time')} />
        </FieldRow>
        <FieldRow label="Timezone">
          <select className={selectCls} value={(cfg.timezone as string) ?? 'Asia/Kolkata'} onChange={sel('timezone')}>
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
          </select>
        </FieldRow>
      </>)}

      {node.actionType === 'weekly_recurring' && (<>
        <FieldRow label="Day of Week" required>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const selected = ((cfg.days as string[]) ?? []).includes(day);
              return (
                <button key={day} type="button"
                  className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                    selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary')}
                  onClick={() => {
                    const curr = (cfg.days as string[]) ?? [];
                    onUpdate({ config: { ...cfg, days: selected ? curr.filter((d) => d !== day) : [...curr, day] } });
                  }}
                >{day.slice(0, 3)}</button>
              );
            })}
          </div>
        </FieldRow>
        <FieldRow label="Time">
          <input type="time" className={inputCls} value={(cfg.time as string) ?? '09:00'} onChange={sel('time')} />
        </FieldRow>
      </>)}

      {node.actionType === 'monthly_recurring' && (<>
        <FieldRow label="Day of Month" required>
          <select className={selectCls} value={(cfg.dayOfMonth as string) ?? ''} onChange={sel('dayOfMonth')}>
            <option value="">Select day...</option>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="last">Last day of month</option>
          </select>
        </FieldRow>
        <FieldRow label="Time">
          <input type="time" className={inputCls} value={(cfg.time as string) ?? '09:00'} onChange={sel('time')} />
        </FieldRow>
      </>)}

      {node.actionType === 'event_date' && (<>
        <FieldRow label="Event / Webinar">
          <select className={selectCls} value={(cfg.eventId as string) ?? ''} onChange={sel('eventId')}>
            <option value="">Select event...</option>
            <option value="evt1">Sales Webinar — April 20</option>
            <option value="evt2">Product Launch — May 5</option>
            <option value="evt3">Training Workshop — May 15</option>
          </select>
        </FieldRow>
        <FieldRow label="Trigger Offset">
          <div className="flex gap-2">
            <input type="number" className="w-24 border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-primary outline-none" value={(cfg.offsetAmount as string) ?? '0'} onChange={sel('offsetAmount')} min="0" />
            <select className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none" value={(cfg.offsetUnit as string) ?? 'hours_before'} onChange={sel('offsetUnit')}>
              <option value="hours_before">hours before</option>
              <option value="days_before">days before</option>
              <option value="hours_after">hours after</option>
              <option value="days_after">days after</option>
            </select>
          </div>
        </FieldRow>
      </>)}

      {/* Inbox trigger */}
      {node.actionType === 'inbox_message' && (<>
        <FieldRow label="Channel">
          <select className={selectCls} value={(cfg.channel as string) ?? ''} onChange={sel('channel')}>
            <option value="">Any channel</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="instagram">Instagram DM</option>
            <option value="facebook">Facebook DM</option>
          </select>
        </FieldRow>
        <FieldRow label="Keyword Filter (optional)">
          <input className={inputCls} placeholder="e.g. pricing, demo, help" value={(cfg.keyword as string) ?? ''} onChange={sel('keyword')} />
          <p className="text-xs text-muted-foreground mt-1">Trigger only when message contains this keyword.</p>
        </FieldRow>
      </>)}

      {/* Comments / DM triggers */}
      {(node.actionType === 'comment_received' || node.actionType === 'dm_received') && (<>
        <FieldRow label="Facebook Page">
          <select className={selectCls} value={(cfg.page as string) ?? ''} onChange={sel('page')}>
            <option value="">Select page...</option>
            {PAGES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
        {node.actionType === 'comment_received' && (
          <FieldRow label="Post Filter (optional)">
            <select className={selectCls} value={(cfg.post as string) ?? ''} onChange={sel('post')}>
              <option value="">Any post</option>
              <option>April Campaign Post</option>
              <option>Product Launch Post</option>
              <option>Giveaway Post</option>
            </select>
          </FieldRow>
        )}
        <FieldRow label="Keyword Filter (optional)">
          <input className={inputCls} placeholder="e.g. price, interested, yes" value={(cfg.keyword as string) ?? ''} onChange={sel('keyword')} />
        </FieldRow>
      </>)}

      {/* Finance trigger */}
      {node.actionType === 'payment_received' && (<>
        <FieldRow label="Payment Plan (optional)">
          <select className={selectCls} value={(cfg.plan as string) ?? ''} onChange={sel('plan')}>
            <option value="">Any plan</option>
            <option>Monthly ₹999</option>
            <option>Quarterly ₹2499</option>
            <option>Annual ₹7999</option>
          </select>
        </FieldRow>
        <FieldRow label="Minimum Amount (optional)">
          <input type="number" className={inputCls} placeholder="e.g. 500" value={(cfg.minAmount as string) ?? ''} onChange={sel('minAmount')} min="0" />
        </FieldRow>
      </>)}

      {/* LMS trigger */}
      {node.actionType === 'course_enrolled' && (<>
        <FieldRow label="Course">
          <select className={selectCls} value={(cfg.course as string) ?? ''} onChange={sel('course')}>
            <option value="">Any course</option>
            {COURSES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </FieldRow>
      </>)}

      {(!node.actionType || node.actionType === '') && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No trigger selected.</p>
          <p className="text-xs mt-1">Click "Change Trigger" to pick a trigger source.</p>
        </div>
      )}
    </div>
  );
}

// ── Condition Config Panel ─────────────────────────────────────────────────────
function ConditionConfigPanel({ node, onUpdate }: { node: WFNode; onUpdate: (updates: Partial<WFNode>) => void }) {
  const cfg = node.config;
  const sel = (field: string) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onUpdate({ config: { ...cfg, [field]: e.target.value } });

  const operator = (cfg.operator as string) ?? '';
  const hideValue = ['is empty', 'is not empty'].includes(operator);

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-xs text-amber-800 flex items-start gap-1.5">
          <GitBranch className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          This step splits the workflow into <strong>YES</strong> and <strong>NO</strong> branches based on the condition below.
        </p>
      </div>

      <FieldRow label="Condition Name">
        <input className={inputCls} placeholder="e.g. Is the stage Qualified?" value={(cfg.conditionName as string) ?? ''} onChange={sel('conditionName')} />
      </FieldRow>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground block">Condition Rule</label>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Field" required>
            <select className={selectCls} value={(cfg.field as string) ?? ''} onChange={sel('field')}>
              <option value="">Select field...</option>
              {CONDITION_FIELDS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Operator" required>
            <select className={selectCls} value={operator} onChange={sel('operator')}>
              <option value="">Select...</option>
              {CONDITION_OPERATORS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </FieldRow>
        </div>
        {!hideValue && (
          <FieldRow label="Value" required>
            <input className={inputCls} placeholder="Enter value to compare..." value={(cfg.value as string) ?? ''} onChange={sel('value')} />
          </FieldRow>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground block">Branch Labels</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-700">YES branch</span>
            </div>
            <input className={inputCls} placeholder="e.g. Condition met" value={(cfg.yesLabel as string) ?? 'Yes'} onChange={sel('yesLabel')} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-700">NO branch</span>
            </div>
            <input className={inputCls} placeholder="e.g. Condition not met" value={(cfg.noLabel as string) ?? 'No'} onChange={sel('noLabel')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Action Config Panel ────────────────────────────────────────────────────────
function ActionConfigPanel({ node, onUpdate }: { node: WFNode; onUpdate: (updates: Partial<WFNode>) => void }) {
  const sel = (field: string) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
    onUpdate({ config: { ...node.config, [field]: e.target.value } });
  const cfg = node.config;

  return (
    <div className="space-y-5">

      {/* Add/Update to CRM */}
      {node.actionType === 'add_to_crm' && (<>
        <FieldRow label="Select Pipeline">
          <select className={selectCls} value={(cfg.pipeline as string) ?? ''} onChange={sel('pipeline')}>
            <option value="">Choose pipeline...</option>
            {PIPELINES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Select Pipeline Stage">
          <select className={selectCls} value={(cfg.stage as string) ?? ''} onChange={sel('stage')}>
            <option value="">Select stage...</option>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FieldRow>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Skip Lead Value Change</span>
          <Switch checked={!!(cfg.skipLeadValue)} onCheckedChange={(v) => onUpdate({ config: { ...cfg, skipLeadValue: v } })} />
        </div>
        <FieldRow label="Lead Value">
          <input type="number" className={inputCls} value={(cfg.leadValue as string) ?? '0'} onChange={sel('leadValue')} min="0" />
        </FieldRow>
      </>)}

      {/* Assign To AI Agent */}
      {node.actionType === 'assign_ai' && (<>
        <p className="text-sm text-muted-foreground">Assign this contact to an AI agent to handle communication automatically.</p>
        <FieldRow label="Select AI Agent" required>
          <select className={selectCls} value={(cfg.agentId as string) ?? ''} onChange={sel('agentId')}>
            <option value="">Choose an AI agent...</option>
            {AI_AGENTS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </FieldRow>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold block">Hand off to human on reply</span>
            <span className="text-xs text-muted-foreground">Notify assigned staff when contact replies</span>
          </div>
          <Switch checked={!!(cfg.handoff)} onCheckedChange={(v) => onUpdate({ config: { ...cfg, handoff: v } })} />
        </div>
      </>)}

      {/* Assign To Staff */}
      {node.actionType === 'assign_staff' && (<>
        <FieldRow label="Select Staff" required>
          <input className={inputCls} placeholder="Select staff to assign on contact" value={(cfg.staffId as string) ?? ''} onChange={sel('staffId')} list="staff-list" />
          <datalist id="staff-list">{STAFF_OPTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        </FieldRow>
        <div className="flex items-center gap-3">
          <Switch checked={!!(cfg.unassignedOnly)} onCheckedChange={(v) => onUpdate({ config: { ...cfg, unassignedOnly: v } })} />
          <span className="text-sm text-foreground">Only apply to unassigned contacts.</span>
        </div>
      </>)}

      {/* Change Appointment Status */}
      {node.actionType === 'change_appointment' && (<>
        <p className="text-sm text-foreground">
          <span className="font-semibold">Note:</span> This operation only works with Appointment Automations.
        </p>
        <FieldRow label="Select Status">
          <select className={selectCls} value={(cfg.status as string) ?? ''} onChange={sel('status')}>
            <option value="">Choose status...</option>
            {APPT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FieldRow>
      </>)}

      {/* Change Lead Quality */}
      {node.actionType === 'change_lead_quality' && (<>
        <FieldRow label="Select Pipeline">
          <select className={selectCls} value={(cfg.pipeline as string) ?? ''} onChange={sel('pipeline')}>
            <option value="">Choose pipeline...</option>
            {PIPELINES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Select Lead Quality">
          <select className={selectCls} value={(cfg.quality as string) ?? ''} onChange={sel('quality')}>
            <option value="">Select quality...</option>
            {LEAD_QUALITIES.map((q) => <option key={q}>{q}</option>)}
          </select>
        </FieldRow>
      </>)}

      {/* Contact Group Access */}
      {node.actionType === 'contact_group_access' && (
        <FieldRow label="Select Group">
          <input className={inputCls} placeholder="Select a group" value={(cfg.group as string) ?? ''} onChange={sel('group')} />
        </FieldRow>
      )}

      {/* Contact Group */}
      {node.actionType === 'contact_group' && (<>
        <FieldRow label="Action">
          <select className={selectCls} value={(cfg.groupAction as string) ?? 'add'} onChange={sel('groupAction')}>
            <option value="add">Add to list</option>
            <option value="move">Move to list</option>
            <option value="remove">Remove from list</option>
          </select>
        </FieldRow>
        <FieldRow label="Target list" required>
          <select className={selectCls} value={(cfg.targetList as string) ?? ''} onChange={sel('targetList')}>
            <option value="">Choose a list</option>
            {CONTACT_LISTS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </FieldRow>
      </>)}

      {/* Change Pipeline Stage */}
      {node.actionType === 'change_stage' && (<>
        <FieldRow label="Select Pipeline">
          <select className={selectCls} value={(cfg.pipeline as string) ?? ''} onChange={sel('pipeline')}>
            <option value="">Any pipeline</option>
            {PIPELINES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Move To Stage">
          <select className={selectCls} value={(cfg.stage as string) ?? ''} onChange={sel('stage')}>
            <option value="">Select stage...</option>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FieldRow>
      </>)}

      {/* Add Tag / Tag Contact */}
      {(node.actionType === 'add_tag' || node.actionType === 'tag_contact') && (
        <FieldRow label="Tag Name" required hint="Use comma to separate multiple tags.">
          <input className={inputCls} placeholder="Enter tag name" value={(cfg.tag as string) ?? ''} onChange={sel('tag')} />
        </FieldRow>
      )}

      {/* Remove Tag */}
      {node.actionType === 'remove_tag' && (
        <FieldRow label="Tag to Remove" hint="Remove one or more tags. Use comma for multiple.">
          <input className={inputCls} placeholder="Tag name to remove" value={(cfg.tag as string) ?? ''} onChange={sel('tag')} />
        </FieldRow>
      )}

      {/* Remove Contact */}
      {node.actionType === 'remove_contact' && (
        <FieldRow label="Remove from List">
          <select className={selectCls} value={(cfg.targetList as string) ?? ''} onChange={sel('targetList')}>
            <option value="">Choose a list</option>
            {CONTACT_LISTS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </FieldRow>
      )}

      {/* Execute Automation */}
      {node.actionType === 'execute_automation' && (<>
        <FieldRow label="Select Workflow">
          <select className={selectCls} value={(cfg.workflowId as string) ?? ''} onChange={sel('workflowId')}>
            <option value="">Choose workflow to run...</option>
            <option value="wf1">New Lead Onboarding</option>
            <option value="wf2">Post-Sale Follow-up</option>
            <option value="wf3">Re-engagement Campaign</option>
          </select>
        </FieldRow>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Wait for completion</span>
          <Switch checked={!!(cfg.waitForCompletion)} onCheckedChange={(v) => onUpdate({ config: { ...cfg, waitForCompletion: v } })} />
        </div>
      </>)}

      {/* Update Attributes */}
      {node.actionType === 'update_attributes' && (<>
        <FieldRow label="Field">
          <select className={selectCls} value={(cfg.attrField as string) ?? ''} onChange={sel('attrField')}>
            <option value="">Select field...</option>
            {['first_name', 'last_name', 'email', 'phone', 'city', 'company'].map((f) => <option key={f}>{f}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Value">
          <input className={inputCls} placeholder="Enter value or use {%variable%}" value={(cfg.attrValue as string) ?? ''} onChange={sel('attrValue')} />
          <p className="text-xs text-muted-foreground mt-1">Use <code className="bg-muted px-1 rounded">{'{%first_name%}'}</code> for dynamic values.</p>
        </FieldRow>
      </>)}

      {/* Create Follow-up */}
      {node.actionType === 'create_followup' && (<>
        <FieldRow label="Follow-up Title" required>
          <input className={inputCls} placeholder="e.g. Follow up with lead" value={(cfg.title as string) ?? ''} onChange={sel('title')} />
        </FieldRow>
        <FieldRow label="Type">
          <select className={selectCls} value={(cfg.followupType as string) ?? ''} onChange={sel('followupType')}>
            <option value="">Select type...</option>
            {FOLLOWUP_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Due Date Offset">
          <div className="flex gap-2">
            <input type="number" className="w-24 border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-primary outline-none" value={(cfg.dueDays as string) ?? '1'} onChange={sel('dueDays')} min="0" />
            <select className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none" value={(cfg.dueUnit as string) ?? 'days'} onChange={sel('dueUnit')}>
              <option value="hours">hours from now</option>
              <option value="days">days from now</option>
            </select>
          </div>
        </FieldRow>
        <FieldRow label="Assign To">
          <select className={selectCls} value={(cfg.assignTo as string) ?? ''} onChange={sel('assignTo')}>
            <option value="">Assigned staff</option>
            {STAFF_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Notes (optional)">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none" rows={3} placeholder="Add notes for the follow-up..." value={(cfg.notes as string) ?? ''} onChange={sel('notes')} />
        </FieldRow>
      </>)}

      {/* Add Note */}
      {node.actionType === 'create_note' && (<>
        <FieldRow label="Note Content" required>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none" rows={5} placeholder="Enter the note content. Use {%first_name%} for dynamic values." value={(cfg.noteContent as string) ?? ''} onChange={sel('noteContent')} />
          <p className="text-xs text-muted-foreground mt-1">Use <code className="bg-muted px-1 rounded">{'{%first_name%}'}</code>, <code className="bg-muted px-1 rounded">{'{%email%}'}</code> etc. for personalization.</p>
        </FieldRow>
        <FieldRow label="Visibility">
          <select className={selectCls} value={(cfg.noteVisibility as string) ?? 'private'} onChange={sel('noteVisibility')}>
            <option value="private">Private (only assigned staff)</option>
            <option value="team">Team (all staff)</option>
          </select>
        </FieldRow>
      </>)}

      {/* Event Start Time */}
      {node.actionType === 'event_start_time' && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <p className="text-xs text-orange-800 flex items-start gap-1.5">
              <PlayCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              This action triggers at the exact start time of a scheduled event or webinar. No further configuration needed.
            </p>
          </div>
          <FieldRow label="Event">
            <select className={selectCls} value={(cfg.eventId as string) ?? ''} onChange={sel('eventId')}>
              <option value="">Select event...</option>
              <option value="evt1">Sales Webinar — April 20</option>
              <option value="evt2">Product Launch — May 5</option>
              <option value="evt3">Training Workshop — May 15</option>
            </select>
          </FieldRow>
        </div>
      )}

      {/* Internal Notification */}
      {node.actionType === 'internal_notify' && (<>
        <p className="text-sm text-muted-foreground leading-relaxed">Send a notification to your team member when a contact reaches this step.</p>
        <FieldRow label="Action Name">
          <input className={inputCls} value={(cfg.actionName as string) ?? 'Internal Notification'} onChange={sel('actionName')} />
        </FieldRow>
        <FieldRow label="Type of Notification">
          <select className={selectCls} value={(cfg.notifType as string) ?? ''} onChange={sel('notifType')}>
            <option value="">Select a type</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="whatsapp_official">WhatsApp Official</option>
            <option value="in_app">In App</option>
          </select>
        </FieldRow>
        <FieldRow label="Send To">
          <select className={selectCls} value={(cfg.sendTo as string) ?? ''} onChange={sel('sendTo')}>
            <option value="">Select whom to notify</option>
            <option value="assigned">Assigned Staff</option>
            <option value="all">All Staff</option>
            <option value="specific">Specific Staff</option>
          </select>
        </FieldRow>
        {(cfg.sendTo as string) === 'specific' && (
          <FieldRow label="Select Staff">
            <select className={selectCls} value={(cfg.staffId as string) ?? ''} onChange={sel('staffId')}>
              <option value="">Choose staff member...</option>
              {STAFF_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </FieldRow>
        )}
        <FieldRow label="Message">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none" rows={3} placeholder="Notification message..." value={(cfg.message as string) ?? ''} onChange={sel('message')} />
        </FieldRow>
      </>)}

      {/* Send Email */}
      {node.actionType === 'send_email' && (<>
        <p className="text-sm text-muted-foreground leading-relaxed">Send an automated email to contacts who reach this step.</p>
        <FieldRow label="Select Template">
          <select className={selectCls} value={(cfg.template as string) ?? ''} onChange={sel('template')}>
            {EMAIL_TEMPLATES.map((t) => <option key={t} value={t === 'Select Existing Template' ? '' : t}>{t}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="From Name" required>
          <input className={inputCls} placeholder="E.g. David Encoteg" value={(cfg.fromName as string) ?? ''} onChange={sel('fromName')} />
        </FieldRow>
        <FieldRow label="Email Subject" required>
          <input className={inputCls} placeholder="E.g. Welcome to our mail list" value={(cfg.subject as string) ?? ''} onChange={sel('subject')} />
        </FieldRow>
        <FieldRow label="Reply To">
          <input className={inputCls} placeholder="Reply to email address" value={(cfg.replyTo as string) ?? ''} onChange={sel('replyTo')} />
        </FieldRow>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold">Content</label>
            <button className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors">Custom Values</button>
          </div>
          <div className="border border-border rounded-t-lg bg-gray-50 px-2 py-1.5 flex items-center gap-1 flex-wrap text-xs text-gray-600">
            {['↩', '↪', 'B', 'I', 'U', 'H1', '¶', 'A', '—', '🔗'].map((t) => (
              <button key={t} className="px-1.5 py-0.5 rounded hover:bg-gray-200 font-medium transition-colors">{t}</button>
            ))}
            <select className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white outline-none ml-1">
              <option>Paragraph</option><option>Heading 1</option><option>Heading 2</option>
            </select>
          </div>
          <textarea
            className="w-full border border-t-0 border-border rounded-b-lg px-3 py-2 text-sm bg-card outline-none resize-none min-h-32"
            rows={5}
            placeholder="Type or paste your content here!"
            value={(cfg.content as string) ?? ''}
            onChange={sel('content')}
          />
        </div>
      </>)}

      {/* Send SMS */}
      {node.actionType === 'send_sms' && (<>
        <p className="text-sm text-muted-foreground leading-relaxed">Send an automated SMS to contacts who reach this step.</p>
        <FieldRow label="Action Name">
          <input className={inputCls} value={(cfg.actionName as string) ?? 'Send SMS'} onChange={sel('actionName')} />
        </FieldRow>
        <FieldRow label="Message">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none" rows={4} placeholder="Type your SMS message..." value={(cfg.message as string) ?? ''} onChange={sel('message')} />
          <p className="text-xs text-muted-foreground mt-1">Use <code className="bg-muted px-1 rounded">{'{%first_name%}'}</code> for dynamic values.</p>
        </FieldRow>
        <FieldRow label="From Number">
          <select className={selectCls} value={(cfg.fromNumber as string) ?? ''} onChange={sel('fromNumber')}>
            <option value="">Use default number</option>
            <option>+91 98765 43210</option>
            <option>+91 91234 56789</option>
          </select>
        </FieldRow>
      </>)}

      {/* WhatsApp Message */}
      {node.actionType === 'send_whatsapp' && (<>
        <p className="text-sm text-muted-foreground leading-relaxed">Send an automated WhatsApp message to contacts at this step.</p>
        <FieldRow label="Select Template" required>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-48 overflow-y-auto bg-white">
              {WA_TEMPLATES.map((t) => (
                <button
                  key={t}
                  onClick={() => onUpdate({ config: { ...cfg, template: t } })}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-0 transition-colors',
                    (cfg.template as string) === t
                      ? 'bg-red-50 text-red-700 font-medium'
                      : 'hover:bg-gray-50 text-gray-700'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </FieldRow>
      </>)}

      {/* Time Delay */}
      {node.actionType === 'delay' && (<>
        <FieldRow label="Wait Duration">
          <div className="flex gap-2">
            <input type="number" className="w-24 border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-primary outline-none" value={(cfg.delayAmount as string) ?? '1'} onChange={sel('delayAmount')} min="1" />
            <select className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none" value={(cfg.delayUnit as string) ?? 'hours'} onChange={sel('delayUnit')}>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </FieldRow>
        <FieldRow label="Delay Type">
          <select className={selectCls} value={(cfg.delayType as string) ?? 'wait'} onChange={sel('delayType')}>
            <option value="wait">Wait for duration</option>
            <option value="until_time">Wait until specific time</option>
            <option value="business_hours">Wait until business hours</option>
          </select>
        </FieldRow>
        {(cfg.delayType as string) === 'until_time' && (
          <FieldRow label="Time">
            <input type="time" className={inputCls} value={(cfg.untilTime as string) ?? '09:00'} onChange={sel('untilTime')} />
          </FieldRow>
        )}
      </>)}

      {/* Instagram DM */}
      {node.actionType === 'post_instagram' && (<>
        <p className="text-sm text-muted-foreground">Send a direct message on Instagram to this contact.</p>
        <FieldRow label="Instagram Account">
          <select className={selectCls} value={(cfg.igAccount as string) ?? ''} onChange={sel('igAccount')}>
            <option value="">Select account...</option>
            {PAGES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Select Template">
          <select className={selectCls} value={(cfg.template as string) ?? ''} onChange={sel('template')}>
            <option value="">Select template...</option>
            {INSTAGRAM_TEMPLATES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Or write message">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none" rows={3} placeholder="Type your Instagram DM..." value={(cfg.message as string) ?? ''} onChange={sel('message')} />
        </FieldRow>
      </>)}

      {/* Facebook Comment Reply */}
      {node.actionType === 'facebook_post' && (<>
        <p className="text-sm text-muted-foreground">Reply to a Facebook comment automatically.</p>
        <FieldRow label="Facebook Page">
          <select className={selectCls} value={(cfg.page as string) ?? ''} onChange={sel('page')}>
            <option value="">Select page...</option>
            {PAGES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Reply Template">
          <select className={selectCls} value={(cfg.template as string) ?? ''} onChange={sel('template')}>
            <option value="">Select template...</option>
            {FB_TEMPLATES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Or write reply">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none" rows={3} placeholder="Type your reply message..." value={(cfg.message as string) ?? ''} onChange={sel('message')} />
          <p className="text-xs text-muted-foreground mt-1">This will be posted as a public comment reply.</p>
        </FieldRow>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Also send DM</span>
          <Switch checked={!!(cfg.alsoSendDm)} onCheckedChange={(v) => onUpdate({ config: { ...cfg, alsoSendDm: v } })} />
        </div>
      </>)}

      {/* Webhook Call */}
      {node.actionType === 'webhook_call' && (<>
        <FieldRow label="URL" required>
          <input type="url" className={inputCls} value={(cfg.url as string) ?? ''} onChange={sel('url')} placeholder="https://your-webhook-url.com/endpoint" />
        </FieldRow>
        <FieldRow label="Method">
          <select className={selectCls} value={(cfg.method as string) ?? 'POST'} onChange={sel('method')}>
            <option>POST</option><option>GET</option><option>PUT</option><option>PATCH</option>
          </select>
        </FieldRow>
        <FieldRow label="Headers (JSON)">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none font-mono" rows={3} placeholder='{"Authorization": "Bearer token"}' value={(cfg.headers as string) ?? ''} onChange={sel('headers')} />
        </FieldRow>
        <FieldRow label="Payload (JSON)">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none font-mono" rows={4} placeholder='{"contact": "{%email%}", "event": "workflow_triggered"}' value={(cfg.payload as string) ?? ''} onChange={sel('payload')} />
        </FieldRow>
      </>)}

      {/* API Request */}
      {node.actionType === 'api_call' && (<>
        <FieldRow label="URL" required>
          <input type="url" className={inputCls} value={(cfg.url as string) ?? ''} onChange={sel('url')} placeholder="https://api.example.com/endpoint" />
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Method">
            <select className={selectCls} value={(cfg.method as string) ?? 'GET'} onChange={sel('method')}>
              <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
            </select>
          </FieldRow>
          <FieldRow label="Content Type">
            <select className={selectCls} value={(cfg.contentType as string) ?? 'application/json'} onChange={sel('contentType')}>
              <option value="application/json">JSON</option>
              <option value="application/x-www-form-urlencoded">Form URL Encoded</option>
              <option value="multipart/form-data">Multipart Form</option>
            </select>
          </FieldRow>
        </div>
        <FieldRow label="Headers (JSON)">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none font-mono" rows={3} placeholder='{"Authorization": "Bearer {{api_key}}"}' value={(cfg.headers as string) ?? ''} onChange={sel('headers')} />
        </FieldRow>
        <FieldRow label="Body (JSON)">
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none font-mono" rows={4} placeholder='{"name": "{%first_name%}", "email": "{%email%}"}' value={(cfg.body as string) ?? ''} onChange={sel('body')} />
        </FieldRow>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Save response to contact</span>
          <Switch checked={!!(cfg.saveResponse)} onCheckedChange={(v) => onUpdate({ config: { ...cfg, saveResponse: v } })} />
        </div>
      </>)}

      {/* No-config actions */}
      {['exit_workflow', 'remove_workflow', 'remove_staff', 'remove_from_crm'].includes(node.actionType) && (
        <div className="py-6 text-center text-sm text-muted-foreground bg-muted/40 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
            <NodeIconRenderer actionType={node.actionType} />
          </div>
          <p className="font-medium text-foreground">{ACTION_LIST.find((a) => a.id === node.actionType)?.label}</p>
          <p className="text-xs mt-1">No additional configuration required.</p>
        </div>
      )}

      {/* Fallback */}
      {!['add_to_crm','assign_ai','assign_staff','change_appointment','change_lead_quality','contact_group_access','contact_group','change_stage','add_tag','remove_tag','remove_contact','remove_from_crm','execute_automation','update_attributes','create_followup','create_note','event_start_time','internal_notify','send_email','send_sms','send_whatsapp','delay','if_else','tag_contact','post_instagram','facebook_post','webhook_call','api_call','exit_workflow','remove_workflow','remove_staff'].includes(node.actionType) && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          <p className="text-xs">Select an action to configure it.</p>
        </div>
      )}
    </div>
  );
}

// ── Trigger Picker Modal ───────────────────────────────────────────────────────
function TriggerPickerModal({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (source: string, type: string, label: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-xl text-gray-900">Select Trigger</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {TRIGGER_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <h4 className="text-lg font-bold text-gray-900 mb-4">{cat.label}</h4>
              <div className="grid grid-cols-4 gap-3">
                {cat.items.map((item) => {
                  const isHovered = hoveredId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelect(item.sourceId, item.id, item.label)}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                        isHovered ? 'border-gray-900 bg-white shadow-md' : 'border-gray-200 bg-gray-50 hover:border-gray-900'
                      )}
                    >
                      {isHovered && <ArrowRight className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-gray-700" />}
                      <item.Icon className="w-7 h-7 text-gray-800" strokeWidth={1.5} />
                      <span className="text-xs font-semibold text-gray-800 text-center leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Action Picker Modal ────────────────────────────────────────────────────────
function ActionPickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (action: typeof ACTION_LIST[0]) => void }) {
  const [activeCategory, setActiveCategory] = useState<ActionCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = ACTION_LIST.filter((a) => {
    const matchCat = activeCategory === 'All' || a.category === activeCategory;
    const matchSearch = !searchQuery || a.label.toLowerCase().includes(searchQuery.toLowerCase()) || a.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-8 pt-8 pb-5 shrink-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-2xl text-gray-900">Add an Action</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <p className="text-sm text-gray-500 ml-8 leading-relaxed max-w-2xl">
            Set up actions that trigger automatically based on specific dates, events, or customer behaviors.
          </p>
        </div>
        <div className="px-8 pb-4 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {ACTION_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-all',
                    cat === activeCategory ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-full text-sm outline-none focus:border-gray-400 w-52 bg-gray-50 focus:bg-white transition-colors"
                placeholder="Search actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 mx-8" />
        <div className="flex-1 overflow-y-auto px-8 py-2">
          {filtered.map((action) => (
            <button
              key={action.id}
              onClick={() => onSelect(action)}
              className="w-full flex items-center gap-5 px-4 py-5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                <action.Icon className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-gray-900">{action.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{action.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors shrink-0" />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-gray-500">No actions found</p>
              <p className="text-sm mt-1">Try a different search or category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Workflow Settings Modal ────────────────────────────────────────────────────
function WorkflowSettingsModal({ workflow, onClose, onSave }: {
  workflow: WFRecord;
  onClose: () => void;
  onSave: (updates: Partial<WFRecord>) => void;
}) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [allowReentry, setAllowReentry] = useState(workflow.allowReentry);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2"><Settings className="w-5 h-5" /> Workflow Settings</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Workflow Name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter workflow name" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Description</label>
            <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-primary outline-none resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what this workflow does..." />
          </div>
          <div className="flex items-start justify-between gap-4 p-4 bg-muted/40 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-foreground">Allow Re-entry</p>
              <p className="text-xs text-muted-foreground mt-0.5">Allow contacts to enter this workflow multiple times. If disabled, a contact can only run through this workflow once.</p>
            </div>
            <Switch checked={allowReentry} onCheckedChange={setAllowReentry} />
          </div>
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Changes to workflow settings take effect for new contacts entering this workflow. Contacts already in the workflow will continue with the old settings.</p>
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={() => { onSave({ name, description, allowReentry }); onClose(); }}>
            <Check className="w-4 h-4 mr-1" /> Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Branch Node: renders a sub-list of nodes in a branch ──────────────────────
interface BranchNodeListProps {
  nodes: WFNode[];
  label: string;
  branchKey: 'yes' | 'no';
  parentNodeId: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddAction: (parentId: string, branch: 'yes' | 'no', afterIndex: number) => void;
  onDeleteBranchNode: (parentId: string, branch: 'yes' | 'no', nodeId: string) => void;
}

function BranchNodeList({ nodes, label, branchKey, parentNodeId, selectedNodeId, onSelectNode, onAddAction, onDeleteBranchNode }: BranchNodeListProps) {
  const isYes = branchKey === 'yes';
  return (
    <div className="flex flex-col items-center min-w-[180px] px-2">
      {/* Branch label */}
      <div className={cn('px-3 py-1 rounded-full text-xs font-bold mb-2', isYes ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
        {label}
      </div>
      {/* Branch connector line */}
      <div className="w-px h-4 bg-gray-300" />
      {nodes.length === 0 ? (
        <div className="flex flex-col items-center">
          <button
            onClick={() => onAddAction(parentNodeId, branchKey, -1)}
            className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 bg-white hover:bg-indigo-50 hover:border-indigo-400 flex items-center justify-center transition-all group shadow-sm"
            title={`Add step to ${label} branch`}
          >
            <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500" />
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <div className="text-xs text-gray-400 italic mb-2">Empty branch</div>
        </div>
      ) : (
        nodes.map((node, idx) => (
          <div key={node.id} className="flex flex-col items-center w-full">
            <button
              onClick={() => onSelectNode(node.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg min-w-40 font-medium text-sm shadow-md transition-all w-full justify-center',
                nodeStyle(node.type),
                selectedNodeId === node.id && 'ring-2 ring-offset-2 ring-white shadow-xl scale-[1.03]',
              )}
            >
              <NodeIconRenderer actionType={node.actionType} />
              <span className="truncate">{node.label}</span>
            </button>
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-gray-300" />
              <button
                onClick={() => onAddAction(parentNodeId, branchKey, idx)}
                className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white hover:bg-indigo-50 hover:border-indigo-400 flex items-center justify-center transition-all group shadow-sm"
                title="Add step"
              >
                <Plus className="w-3 h-3 text-gray-400 group-hover:text-indigo-500" />
              </button>
              <div className="w-px h-6 bg-gray-300" />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Canvas Node (handles rendering + if/else branching) ───────────────────────
interface CanvasNodeProps {
  node: WFNode;
  idx: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onInsertAfter: (idx: number) => void;
  onAddBranchAction: (parentId: string, branch: 'yes' | 'no', afterIndex: number) => void;
  onDeleteBranchNode: (parentId: string, branch: 'yes' | 'no', nodeId: string) => void;
  onSelectBranchNode: (parentId: string, branch: 'yes' | 'no', nodeId: string) => void;
}

function CanvasNode({ node, idx, selectedNodeId, onSelectNode, onInsertAfter, onAddBranchAction, onDeleteBranchNode, onSelectBranchNode }: CanvasNodeProps) {
  const isCondition = node.type === 'condition' && node.actionType === 'if_else';

  return (
    <div className="flex flex-col items-center">
      {/* Main node pill */}
      <button
        onClick={() => onSelectNode(node.id)}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-lg min-w-48 font-medium text-sm shadow-md transition-all',
          nodeStyle(node.type),
          selectedNodeId === node.id && 'ring-2 ring-offset-2 ring-white shadow-xl scale-[1.03]',
        )}
      >
        <NodeIconRenderer actionType={node.actionType} />
        <span>{node.label}</span>
      </button>

      {isCondition ? (
        /* ── If/Else branching layout ── */
        <div className="flex flex-col items-center w-full">
          <div className="w-px h-6 bg-gray-300" />
          {/* Horizontal branch connector */}
          <div className="flex items-start gap-8 relative">
            {/* Left arm */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gray-300" style={{ left: '22%', right: '22%' }} />
            <BranchNodeList
              nodes={node.branches?.yes ?? []}
              label={(node.config.yesLabel as string) || 'Yes'}
              branchKey="yes"
              parentNodeId={node.id}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => onSelectBranchNode(node.id, 'yes', id)}
              onAddAction={onAddBranchAction}
              onDeleteBranchNode={onDeleteBranchNode}
            />
            {/* Vertical divider */}
            <div className="w-px bg-gray-200 self-stretch mt-6" />
            <BranchNodeList
              nodes={node.branches?.no ?? []}
              label={(node.config.noLabel as string) || 'No'}
              branchKey="no"
              parentNodeId={node.id}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => onSelectBranchNode(node.id, 'no', id)}
              onAddAction={onAddBranchAction}
              onDeleteBranchNode={onDeleteBranchNode}
            />
          </div>
          {/* Merge connector */}
          <div className="flex flex-col items-center mt-2">
            <div className="w-px h-6 bg-gray-300" />
            <div className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium border border-gray-200">Merge</div>
            <div className="w-px h-6 bg-gray-300" />
            <button
              onClick={() => onInsertAfter(idx)}
              className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white hover:bg-indigo-50 hover:border-indigo-400 flex items-center justify-center transition-all group shadow-sm"
              title="Add step after merge"
            >
              <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500" />
            </button>
            <div className="w-px h-8 bg-gray-300" />
          </div>
        </div>
      ) : (
        /* ── Standard linear connector ── */
        <div className="flex flex-col items-center">
          <div className="w-px h-8 bg-gray-300" />
          <button
            onClick={() => onInsertAfter(idx)}
            className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white hover:bg-indigo-50 hover:border-indigo-400 flex items-center justify-center transition-all group shadow-sm"
            title="Add step"
          >
            <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500" />
          </button>
          <div className="w-px h-8 bg-gray-300" />
        </div>
      )}
    </div>
  );
}

// ── Branch node state for panel ───────────────────────────────────────────────
interface BranchNodeContext {
  parentId: string;
  branch: 'yes' | 'no';
  nodeId: string;
}

// ── Main Editor ────────────────────────────────────────────────────────────────
export default function WorkflowEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const passedWorkflow = (location.state as { workflow?: WFRecord })?.workflow;
  const [workflow, setWorkflow] = useState<WFRecord>(
    passedWorkflow ?? {
      id: id ?? 'new',
      name: 'Untitled Automation',
      description: '',
      allowReentry: false,
      totalContacts: 0,
      completed: 0,
      completedNodes: 0,
      lastUpdated: 'just now',
      status: 'inactive',
      nodes: [{ id: 'n1', type: 'trigger', actionType: '', label: 'Select Trigger', config: {} }],
    }
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(workflow.nodes[0]?.id ?? null);
  const [selectedBranchCtx, setSelectedBranchCtx] = useState<BranchNodeContext | null>(null);
  const [showTriggerPicker, setShowTriggerPicker] = useState(false);
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [insertBranchCtx, setInsertBranchCtx] = useState<{ parentId: string; branch: 'yes' | 'no'; afterIndex: number } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('just now');
  const [zoom, setZoom] = useState(100);
  const [panelWidth, setPanelWidth] = useState(320);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenuDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const next = Math.min(600, Math.max(280, dragStartWidth.current + delta));
      setPanelWidth(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Determine which node is selected (main canvas or branch)
  const selectedNode = selectedBranchCtx
    ? (() => {
        const parent = workflow.nodes.find((n) => n.id === selectedBranchCtx.parentId);
        return parent?.branches?.[selectedBranchCtx.branch]?.find((n) => n.id === selectedBranchCtx.nodeId) ?? null;
      })()
    : workflow.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setLastSaved('just now');
      toast.success('Workflow saved');
    }, 800);
  };

  const updateNode = (nodeId: string, updates: Partial<WFNode>) => {
    setWorkflow((w) => ({
      ...w,
      nodes: w.nodes.map((n) => n.id === nodeId ? { ...n, ...updates } : n),
    }));
  };

  const updateBranchNode = (parentId: string, branch: 'yes' | 'no', nodeId: string, updates: Partial<WFNode>) => {
    setWorkflow((w) => ({
      ...w,
      nodes: w.nodes.map((n) => {
        if (n.id !== parentId) return n;
        return {
          ...n,
          branches: {
            yes: n.branches?.yes ?? [],
            no: n.branches?.no ?? [],
            [branch]: (n.branches?.[branch] ?? []).map((bn) => bn.id === nodeId ? { ...bn, ...updates } : bn),
          },
        };
      }),
    }));
  };

  const deleteNode = (nodeId: string) => {
    if (workflow.nodes.length === 1) { toast.error('A workflow must have at least one node'); return; }
    setWorkflow((w) => ({ ...w, nodes: w.nodes.filter((n) => n.id !== nodeId) }));
    setSelectedNodeId(workflow.nodes[0]?.id ?? null);
    setSelectedBranchCtx(null);
  };

  const deleteBranchNode = (parentId: string, branch: 'yes' | 'no', nodeId: string) => {
    setWorkflow((w) => ({
      ...w,
      nodes: w.nodes.map((n) => {
        if (n.id !== parentId) return n;
        return {
          ...n,
          branches: {
            yes: n.branches?.yes ?? [],
            no: n.branches?.no ?? [],
            [branch]: (n.branches?.[branch] ?? []).filter((bn) => bn.id !== nodeId),
          },
        };
      }),
    }));
    setSelectedBranchCtx(null);
    setSelectedNodeId(null);
  };

  const handleSelectTrigger = (_source: string, type: string, label: string) => {
    updateNode(workflow.nodes[0].id, { actionType: type, label });
    setShowTriggerPicker(false);
    setSelectedNodeId(workflow.nodes[0].id);
    toast.success(`Trigger set: ${label}`);
  };

  const handleSelectAction = (action: typeof ACTION_LIST[0]) => {
    const newNode: WFNode = {
      id: `n-${Date.now()}`,
      type: action.id === 'delay' ? 'delay' : action.id === 'if_else' ? 'condition' : 'action',
      actionType: action.id,
      label: action.label,
      config: {},
      branches: action.id === 'if_else' ? { yes: [], no: [] } : undefined,
    };

    if (insertBranchCtx) {
      // Adding to a branch
      const { parentId, branch, afterIndex } = insertBranchCtx;
      setWorkflow((w) => ({
        ...w,
        nodes: w.nodes.map((n) => {
          if (n.id !== parentId) return n;
          const branchNodes = [...(n.branches?.[branch] ?? [])];
          branchNodes.splice(afterIndex + 1, 0, newNode);
          return {
            ...n,
            branches: {
              yes: n.branches?.yes ?? [],
              no: n.branches?.no ?? [],
              [branch]: branchNodes,
            },
          };
        }),
      }));
      setSelectedBranchCtx({ parentId, branch, nodeId: newNode.id });
      setSelectedNodeId(null);
    } else {
      // Adding to main canvas
      const idx = insertAfterIndex ?? workflow.nodes.length - 1;
      const newNodes = [...workflow.nodes];
      newNodes.splice(idx + 1, 0, newNode);
      setWorkflow((w) => ({ ...w, nodes: newNodes }));
      setSelectedNodeId(newNode.id);
      setSelectedBranchCtx(null);
    }

    setShowActionPicker(false);
    setInsertAfterIndex(null);
    setInsertBranchCtx(null);
  };

  const handleAddBranchAction = (parentId: string, branch: 'yes' | 'no', afterIndex: number) => {
    setInsertBranchCtx({ parentId, branch, afterIndex });
    setInsertAfterIndex(null);
    setShowActionPicker(true);
  };

  const isPanelOpen = selectedNode !== null;

  // Determine if selected node is trigger (for showing Change Trigger button)
  const selectedNodeIsTrigger = !selectedBranchCtx && selectedNode?.type === 'trigger';
  const selectedNodeIsCondition = selectedNode?.type === 'condition';

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/automation')}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Switch
            checked={workflow.status === 'active'}
            onCheckedChange={(v) => setWorkflow((w) => ({ ...w, status: v ? 'active' : 'inactive' }))}
          />
          <span className={cn('text-sm font-medium', workflow.status === 'active' ? 'text-green-600' : 'text-muted-foreground')}>
            {workflow.status === 'active' ? 'Active' : 'Paused'}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Last saved: {lastSaved}
          </span>
        </div>

        {/* Editable title */}
        <div className="flex-1 flex justify-center px-8">
          {isEditingName ? (
            <input
              autoFocus
              className="text-lg font-semibold text-center border-b-2 border-primary outline-none bg-transparent"
              value={workflow.name}
              onChange={(e) => setWorkflow((w) => ({ ...w, name: e.target.value }))}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-lg font-semibold text-foreground hover:text-primary flex items-center gap-2 transition-colors"
            >
              {workflow.name}
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><Save className="w-4 h-4 mr-1" /> Save</>}
          </Button>
          <Button size="sm" onClick={() => toast.info('Test workflow triggered — check execution logs')} className="bg-slate-700 hover:bg-slate-800 text-white">
            <Play className="w-3.5 h-3.5 mr-1" /> Test Workflow
          </Button>
          {/* Settings / Menu dropdown */}
          <div className="relative" ref={menuRef}>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowMenuDropdown((v) => !v)}>
              <Settings className="w-3.5 h-3.5" /> Menu
              <ChevronDown className="w-3 h-3" />
            </Button>
            {showMenuDropdown && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted text-left transition-colors" onClick={() => { setShowMenuDropdown(false); setShowSettingsModal(true); }}>
                  <Settings className="w-4 h-4 text-muted-foreground" /> Workflow Settings
                </button>
                <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted text-left transition-colors" onClick={() => { setShowMenuDropdown(false); toast.info('Workflow duplicated'); }}>
                  <Copy className="w-4 h-4 text-muted-foreground" /> Duplicate Workflow
                </button>
                <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted text-left transition-colors" onClick={() => { setShowMenuDropdown(false); toast.info('Viewing execution logs...'); navigate('/automation/workflows'); }}>
                  <ClipboardList className="w-4 h-4 text-muted-foreground" /> Execution Logs
                </button>
                <div className="border-t border-border my-1" />
                <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted text-left transition-colors" onClick={() => { setShowMenuDropdown(false); setWorkflow((w) => ({ ...w, status: w.status === 'active' ? 'inactive' : 'active' })); }}>
                  <Power className="w-4 h-4 text-muted-foreground" /> {workflow.status === 'active' ? 'Pause Workflow' : 'Activate Workflow'}
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 text-left transition-colors"
                  onClick={() => { setShowMenuDropdown(false); toast.error('Workflow deleted'); navigate('/automation/workflows'); }}
                >
                  <Trash2 className="w-4 h-4" /> Delete Workflow
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body: Canvas + Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-12 shrink-0 flex flex-col items-center gap-1 py-3 bg-card border-r border-border">
          <button
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="text-[10px] text-muted-foreground font-medium">{zoom}%</div>
          <button
            title="Reset zoom"
            onClick={() => setZoom(100)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            title="Fit view"
            onClick={() => setZoom(100)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500 text-white" title="Workflow info">
            <Info className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 relative overflow-auto"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundColor: '#f3f4f6',
          }}
          onClick={() => { setSelectedNodeId(null); setSelectedBranchCtx(null); }}
        >
          <div
            className="flex flex-col items-center py-16 min-h-full"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            {workflow.nodes.map((node, idx) => (
              <CanvasNode
                key={node.id}
                node={node}
                idx={idx}
                selectedNodeId={selectedBranchCtx ? null : selectedNodeId}
                onSelectNode={(nodeId) => { setSelectedNodeId(nodeId); setSelectedBranchCtx(null); }}
                onInsertAfter={(i) => { setInsertAfterIndex(i); setInsertBranchCtx(null); setShowActionPicker(true); }}
                onAddBranchAction={handleAddBranchAction}
                onDeleteBranchNode={deleteBranchNode}
                onSelectBranchNode={(parentId, branch, nodeId) => {
                  setSelectedBranchCtx({ parentId, branch, nodeId });
                  setSelectedNodeId(null);
                }}
              />
            ))}
          </div>
        </div>

        {/* Right Config Panel — resizable */}
        <div
          className="bg-white border-l border-border flex flex-col shrink-0 overflow-hidden relative transition-[width] duration-200"
          style={{ width: isPanelOpen ? panelWidth : 0 }}
        >
          {/* Drag handle */}
          {isPanelOpen && (
            <div
              onMouseDown={onDragStart}
              className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize z-10 group"
              title="Drag to resize"
            >
              <div className="w-full h-full group-hover:bg-primary/20 transition-colors" />
              <div className="absolute top-1/2 left-0 -translate-y-1/2 flex flex-col gap-1 px-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {[0, 1, 2].map((i) => <div key={i} className="w-1 h-1 rounded-full bg-primary/60" />)}
              </div>
            </div>
          )}

          {selectedNode && (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <button
                  onClick={() => { setSelectedNodeId(null); setSelectedBranchCtx(null); }}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to automation
                </button>
                <button
                  onClick={() => {
                    if (selectedBranchCtx) {
                      deleteBranchNode(selectedBranchCtx.parentId, selectedBranchCtx.branch, selectedBranchCtx.nodeId);
                    } else if (selectedNodeId) {
                      deleteNode(selectedNodeId);
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete node"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedNode.label || 'Configure Node'}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedNode.type === 'trigger'
                      ? 'Select the event that starts this automation'
                      : selectedNode.type === 'condition'
                      ? 'Define the condition to split the workflow'
                      : 'Configure this action step'}
                  </p>
                  {selectedBranchCtx && (
                    <div className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-2',
                      selectedBranchCtx.branch === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    )}>
                      <GitBranch className="w-3 h-3" />
                      {selectedBranchCtx.branch === 'yes' ? 'YES' : 'NO'} branch
                    </div>
                  )}
                </div>

                {selectedNode.type === 'trigger'
                  ? <TriggerConfigPanel
                      node={selectedNode}
                      onUpdate={(u) => updateNode(selectedNode.id, u)}
                      onChangeTrigger={() => setShowTriggerPicker(true)}
                    />
                  : selectedNodeIsCondition
                  ? <ConditionConfigPanel
                      node={selectedNode}
                      onUpdate={(u) => selectedBranchCtx
                        ? updateBranchNode(selectedBranchCtx.parentId, selectedBranchCtx.branch, selectedNode.id, u)
                        : updateNode(selectedNode.id, u)
                      }
                    />
                  : <ActionConfigPanel
                      node={selectedNode}
                      onUpdate={(u) => selectedBranchCtx
                        ? updateBranchNode(selectedBranchCtx.parentId, selectedBranchCtx.branch, selectedNode.id, u)
                        : updateNode(selectedNode.id, u)
                      }
                    />
                }
              </div>

              <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
                <Button
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => toast.success('Node config saved')}
                >
                  <Check className="w-4 h-4 mr-1" /> Save Change
                </Button>
                {selectedNodeIsTrigger && (
                  <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowTriggerPicker(true)}>
                    Change Trigger
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showTriggerPicker && (
        <TriggerPickerModal onClose={() => setShowTriggerPicker(false)} onSelect={handleSelectTrigger} />
      )}
      {showActionPicker && (
        <ActionPickerModal
          onClose={() => { setShowActionPicker(false); setInsertAfterIndex(null); setInsertBranchCtx(null); }}
          onSelect={handleSelectAction}
        />
      )}
      {showSettingsModal && (
        <WorkflowSettingsModal
          workflow={workflow}
          onClose={() => setShowSettingsModal(false)}
          onSave={(updates) => { setWorkflow((w) => ({ ...w, ...updates })); toast.success('Settings saved'); }}
        />
      )}
    </div>
  );
}
