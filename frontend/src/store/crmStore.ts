import { create } from 'zustand';
import {
  leads as initialLeads,
  conversations as initialConversations,
  workflows as initialWorkflows,
  notifications as initialNotifications,
  calendarEvents as initialEvents,
  staff as initialStaff,
  tags as initialTags,
  opportunities as initialOpportunities,
  notes as initialNotes,
  followUps as initialFollowUps,
  customFields as initialCustomFields,
  bookingLinks as initialBookingLinks,
  availabilitySlots as initialAvailabilitySlots,
  quickReplies as initialQuickReplies,
  pipelines as initialPipelines,
  Lead, Conversation, Workflow, Notification, CalendarEvent, StaffMember,
  Tag, Opportunity, NoteEntry, FollowUp, CustomFieldDef, BookingLink, AvailabilitySlot, QuickReply, Pipeline, PipelineStage,
} from '@/data/mockData';
import { WFRecord, WFFolder } from '@/pages/AutomationPage';

export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'created' | 'call' | 'whatsapp' | 'email' | 'note' | 'followup' | 'appointment' | 'stage_change' | 'tag_added' | 'assigned';
  title: string;
  detail?: string;
  timestamp: string;
  createdBy?: string;
}

export type AdditionalFieldType =
  | 'Single Line' | 'Multi Line' | 'Number' | 'Phone' | 'Monetary'
  | 'Email' | 'URL' | 'Dropdown' | 'Multi-select' | 'Radio' | 'Multi-Checkbox' | 'Checkbox'
  | 'Date' | 'File Upload';

export interface AdditionalField {
  id: string;
  pipelineId: string;
  question: string;
  type: AdditionalFieldType;
  slug: string;
  options?: string[];
  required: boolean;
}

interface CrmState {
  wfRecords: WFRecord[];
  wfFolders: WFFolder[];

  // Automation workflow actions
  addWfRecord: (wf: WFRecord) => void;
  updateWfRecord: (id: string, updates: Partial<WFRecord>) => void;
  deleteWfRecord: (id: string) => void;

  // Automation folder actions
  addWfFolder: (folder: WFFolder) => void;
  deleteWfFolder: (id: string) => void;
  moveWfToFolder: (wfId: string, folderId: string) => void;

  pipelines: Pipeline[];
  leads: Lead[];
  conversations: Conversation[];
  workflows: Workflow[];
  notifications: Notification[];
  calendarEvents: CalendarEvent[];
  staff: StaffMember[];
  tags: Tag[];
  opportunities: Opportunity[];
  notes: NoteEntry[];
  followUps: FollowUp[];
  customFields: CustomFieldDef[];
  bookingLinks: BookingLink[];
  availabilitySlots: AvailabilitySlot[];
  quickReplies: QuickReply[];
  activities: LeadActivity[];
  additionalFields: AdditionalField[];

  // Activity actions
  addActivity: (activity: LeadActivity) => void;

  // Additional Fields actions (pipeline questionnaires)
  addAdditionalField: (field: AdditionalField) => void;
  updateAdditionalField: (id: string, updates: Partial<AdditionalField>) => void;
  deleteAdditionalField: (id: string) => void;

  // Lead actions
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  moveLeadStage: (id: string, newStage: string) => void;
  deleteLead: (id: string) => void;

  // Note actions
  addNote: (note: NoteEntry) => void;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;

  // Follow-up actions
  addFollowUp: (fu: FollowUp) => void;
  completeFollowUp: (id: string) => void;

  // Tag actions
  addTag: (tag: Tag) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  // Opportunity actions
  addOpportunity: (opp: Opportunity) => void;
  updateOpportunity: (id: string, updates: Partial<Opportunity>) => void;

  // Conversation actions
  sendMessage: (conversationId: string, text: string, sender: 'agent' | 'customer', isNote?: boolean) => void;
  resolveConversation: (id: string) => void;
  reopenConversation: (id: string) => void;
  assignConversation: (id: string, staffId: string) => void;
  markConversationRead: (id: string) => void;

  // Workflow actions
  toggleWorkflow: (id: string) => void;
  addWorkflow: (wf: Workflow) => void;
  deleteWorkflow: (id: string) => void;

  // Notification actions
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Calendar actions
  addCalendarEvent: (event: CalendarEvent) => void;
  updateEventStatus: (id: string, status: CalendarEvent['status']) => void;

  // Booking link actions
  addBookingLink: (bl: BookingLink) => void;
  updateBookingLink: (id: string, updates: Partial<BookingLink>) => void;
  deleteBookingLink: (id: string) => void;

  // Availability actions
  updateAvailability: (id: string, updates: Partial<AvailabilitySlot>) => void;

  // Custom field actions
  addCustomField: (field: CustomFieldDef) => void;
  updateCustomField: (id: string, updates: Partial<CustomFieldDef>) => void;
  deleteCustomField: (id: string) => void;
  reorderCustomFields: (fields: CustomFieldDef[]) => void;

  // Staff actions
  addStaff: (member: StaffMember) => void;
  updateStaff: (id: string, updates: Partial<StaffMember>) => void;
  deactivateStaff: (id: string) => void;

  // Pipeline actions
  addPipeline: (pipeline: Pipeline) => void;
  updatePipeline: (id: string, updates: Partial<Pipeline>) => void;
  deletePipeline: (id: string) => void;
  clonePipeline: (id: string) => void;
}

export const useCrmStore = create<CrmState>((set) => ({
  wfRecords: [],
  wfFolders: [],

  addWfRecord: (wf) => set((s) => ({ wfRecords: [wf, ...s.wfRecords] })),
  updateWfRecord: (id, updates) => set((s) => ({ wfRecords: s.wfRecords.map((w) => w.id === id ? { ...w, ...updates } : w) })),
  deleteWfRecord: (id) => set((s) => ({ wfRecords: s.wfRecords.filter((w) => w.id !== id) })),

  addWfFolder: (folder) => set((s) => ({ wfFolders: [...s.wfFolders, folder] })),
  deleteWfFolder: (id) => set((s) => ({ wfFolders: s.wfFolders.filter((f) => f.id !== id) })),
  moveWfToFolder: (wfId, folderId) => set((s) => ({
    wfFolders: s.wfFolders.map((f) =>
      f.id === folderId
        ? { ...f, workflowIds: f.workflowIds.includes(wfId) ? f.workflowIds : [...f.workflowIds, wfId] }
        : f
    ),
  })),

  pipelines: initialPipelines,
  leads: initialLeads,
  conversations: initialConversations,
  workflows: initialWorkflows,
  notifications: initialNotifications,
  calendarEvents: initialEvents,
  staff: initialStaff,
  tags: initialTags,
  opportunities: initialOpportunities,
  notes: initialNotes,
  followUps: initialFollowUps,
  customFields: initialCustomFields,
  bookingLinks: initialBookingLinks,
  availabilitySlots: initialAvailabilitySlots,
  quickReplies: initialQuickReplies,
  activities: [],
  additionalFields: [
    { id: 'a1', pipelineId: 'sales', question: 'What is their budget range?', type: 'Dropdown', slug: 'budget_range', options: ['< ₹50k', '₹50k – ₹2L', '₹2L – ₹10L', '> ₹10L'], required: true },
    { id: 'a2', pipelineId: 'sales', question: 'Expected timeline to decide?', type: 'Date',     slug: 'timeline',     required: false },
    { id: 'a3', pipelineId: 'sales', question: 'Who is the decision-maker?',   type: 'Single Line', slug: 'decision_maker', required: false },
    { id: 'a4', pipelineId: 'sales', question: 'Main pain point?',             type: 'Multi Line', slug: 'pain_point', required: false },
  ],

  // Activity actions
  addActivity: (activity) => set((s) => ({ activities: [activity, ...s.activities] })),

  // Additional Fields actions
  addAdditionalField: (field) => set((s) => ({ additionalFields: [...s.additionalFields, field] })),
  updateAdditionalField: (id, updates) => set((s) => ({ additionalFields: s.additionalFields.map((f) => f.id === id ? { ...f, ...updates } : f) })),
  deleteAdditionalField: (id) => set((s) => ({ additionalFields: s.additionalFields.filter((f) => f.id !== id) })),

  // Lead actions
  addLead: (lead) => set((s) => ({ leads: [lead, ...s.leads] })),
  updateLead: (id, updates) => set((s) => {
    const lead = s.leads.find((l) => l.id === id);
    const newActivities: LeadActivity[] = [];
    // Log assignment change
    if (lead && 'assignedTo' in updates && updates.assignedTo !== lead.assignedTo) {
      const newStaff = s.staff.find((st) => st.id === updates.assignedTo);
      const oldStaff = s.staff.find((st) => st.id === lead.assignedTo);
      newActivities.push({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        leadId: id,
        type: 'assigned',
        title: newStaff ? `Assigned to ${newStaff.name}` : 'Unassigned',
        detail: oldStaff ? `Previously: ${oldStaff.name}` : undefined,
        timestamp: new Date().toISOString(),
      });
    }
    // Log tag additions
    if (lead && 'tags' in updates && updates.tags) {
      const added = updates.tags.filter((t) => !lead.tags.includes(t));
      added.forEach((tag) => {
        newActivities.push({
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          leadId: id,
          type: 'tag_added',
          title: `Tag added: ${tag}`,
          timestamp: new Date().toISOString(),
        });
      });
    }
    return {
      leads: s.leads.map((l) => l.id === id ? { ...l, ...updates } : l),
      activities: newActivities.length > 0 ? [...newActivities, ...s.activities] : s.activities,
    };
  }),
  moveLeadStage: (id, newStage) => set((s) => {
    const lead = s.leads.find((l) => l.id === id);
    const oldStage = lead?.stage;
    if (oldStage === newStage) {
      return { leads: s.leads };
    }
    const activity: LeadActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      leadId: id,
      type: 'stage_change',
      title: `Stage changed to ${newStage}`,
      detail: oldStage ? `From "${oldStage}" → "${newStage}"` : undefined,
      timestamp: new Date().toISOString(),
    };
    return {
      leads: s.leads.map((l) => l.id === id ? { ...l, stage: newStage, lastActivity: new Date().toISOString() } : l),
      activities: [activity, ...s.activities],
    };
  }),
  deleteLead: (id) => set((s) => ({ leads: s.leads.filter((l) => l.id !== id) })),

  // Note actions
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (id, content) => set((s) => ({ notes: s.notes.map((n) => n.id === id ? { ...n, content } : n) })),
  deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  // Follow-up actions
  addFollowUp: (fu) => set((s) => ({ followUps: [fu, ...s.followUps] })),
  completeFollowUp: (id) => set((s) => ({ followUps: s.followUps.map((f) => f.id === id ? { ...f, completed: true } : f) })),

  // Tag actions
  addTag: (tag) => set((s) => ({ tags: [...s.tags, tag] })),
  updateTag: (id, updates) => set((s) => ({ tags: s.tags.map((t) => t.id === id ? { ...t, ...updates } : t) })),
  deleteTag: (id) => set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),

  // Opportunity actions
  addOpportunity: (opp) => set((s) => ({ opportunities: [opp, ...s.opportunities] })),
  updateOpportunity: (id, updates) => set((s) => ({ opportunities: s.opportunities.map((o) => o.id === id ? { ...o, ...updates } : o) })),

  // Conversation actions
  sendMessage: (conversationId, text, sender, isNote = false) => set((s) => ({
    conversations: s.conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            lastMessage: text,
            lastMessageTime: new Date().toISOString(),
            unreadCount: sender === 'customer' ? c.unreadCount + 1 : 0,
            messages: [...c.messages, { id: `msg-${Date.now()}`, text, sender, timestamp: new Date().toISOString(), status: sender === 'agent' ? 'sent' as const : undefined, isNote }],
          }
        : c
    ),
  })),
  resolveConversation: (id) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? { ...c, status: 'resolved' as const, unreadCount: 0 } : c) })),
  reopenConversation: (id) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? { ...c, status: 'open' as const } : c) })),
  assignConversation: (id, staffId) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? { ...c, assignedTo: staffId } : c) })),
  markConversationRead: (id) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c) })),

  // Workflow actions
  toggleWorkflow: (id) => set((s) => ({ workflows: s.workflows.map((w) => w.id === id ? { ...w, status: w.status === 'active' ? 'inactive' as const : 'active' as const } : w) })),
  addWorkflow: (wf) => set((s) => ({ workflows: [wf, ...s.workflows] })),
  deleteWorkflow: (id) => set((s) => ({ workflows: s.workflows.filter((w) => w.id !== id) })),

  // Notification actions
  markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) })),
  markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

  // Calendar actions
  addCalendarEvent: (event) => set((s) => ({ calendarEvents: [event, ...s.calendarEvents] })),
  updateEventStatus: (id, status) => set((s) => ({ calendarEvents: s.calendarEvents.map((e) => e.id === id ? { ...e, status } : e) })),

  // Booking link actions
  addBookingLink: (bl) => set((s) => ({ bookingLinks: [bl, ...s.bookingLinks] })),
  updateBookingLink: (id, updates) => set((s) => ({ bookingLinks: s.bookingLinks.map((b) => b.id === id ? { ...b, ...updates } : b) })),
  deleteBookingLink: (id) => set((s) => ({ bookingLinks: s.bookingLinks.filter((b) => b.id !== id) })),

  // Availability actions
  updateAvailability: (id, updates) => set((s) => ({ availabilitySlots: s.availabilitySlots.map((a) => a.id === id ? { ...a, ...updates } : a) })),

  // Custom field actions
  addCustomField: (field) => set((s) => ({ customFields: [...s.customFields, field] })),
  updateCustomField: (id, updates) => set((s) => ({ customFields: s.customFields.map((f) => f.id === id ? { ...f, ...updates } : f) })),
  deleteCustomField: (id) => set((s) => ({ customFields: s.customFields.filter((f) => f.id !== id) })),
  reorderCustomFields: (fields) => set(() => ({ customFields: fields })),

  // Staff actions
  addStaff: (member) => set((s) => ({ staff: [...s.staff, member] })),
  updateStaff: (id, updates) => set((s) => ({ staff: s.staff.map((m) => m.id === id ? { ...m, ...updates } : m) })),
  deactivateStaff: (id) => set((s) => ({ staff: s.staff.map((m) => m.id === id ? { ...m, status: m.status === 'active' ? 'inactive' as const : 'active' as const } : m) })),

  // Pipeline actions
  addPipeline: (pipeline) => set((s) => ({ pipelines: [...s.pipelines, pipeline] })),
  updatePipeline: (id, updates) => set((s) => ({ pipelines: s.pipelines.map((p) => p.id === id ? { ...p, ...updates } : p) })),
  deletePipeline: (id) => set((s) => ({ pipelines: s.pipelines.filter((p) => p.id !== id) })),
  clonePipeline: (id) => set((s) => {
    const src = s.pipelines.find((p) => p.id === id);
    if (!src) return {};
    const newId = `pipeline-${Date.now()}`;
    return { pipelines: [...s.pipelines, { ...src, id: newId, name: `${src.name} (Copy)`, stages: src.stages.map((st) => ({ ...st, id: `${st.id}-c${Date.now()}` })) }] };
  }),
}));
