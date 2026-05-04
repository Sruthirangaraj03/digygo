import { create } from 'zustand';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Lead, Conversation, Workflow, Notification, CalendarEvent, StaffMember,
  Tag, Opportunity, NoteEntry, FollowUp, CustomFieldDef, BookingLink, AvailabilitySlot, QuickReply, Pipeline, PipelineStage,
} from '@/data/mockData';
import { WFRecord, WFFolder } from '@/types/workflow';

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
  moveLeadStage: (id: string, newStage: string, newStageId?: string) => void;
  deleteLead: (id: string) => void;

  // Note actions
  addNote: (note: NoteEntry) => void;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;

  // Follow-up actions
  addFollowUp: (fu: FollowUp) => void;
  completeFollowUp: (id: string, leadId?: string) => void;

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
  addNotification: (n: Notification) => void;
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
  addPipeline: (pipeline: Pipeline) => Promise<void>;
  updatePipeline: (id: string, updates: Partial<Pipeline>) => Promise<void>;
  deletePipeline: (id: string) => Promise<void>;
  clonePipeline: (id: string) => Promise<void>;

  refreshPipelines: () => Promise<void>;
  // API sync
  initFromApi: () => Promise<void>;
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

  pipelines: [],
  leads: [],
  conversations: [],
  workflows: [],
  notifications: [],
  calendarEvents: [],
  staff: [],
  tags: [],
  opportunities: [],
  notes: [],
  followUps: [],
  customFields: [],
  bookingLinks: [],
  availabilitySlots: [],
  quickReplies: [],
  activities: [],
  additionalFields: [],

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
  moveLeadStage: (id, newStage, newStageId) => set((s) => {
    const lead = s.leads.find((l) => l.id === id);
    const oldStage = lead?.stage;
    if (oldStage === newStage) return { leads: s.leads };
    const activity: LeadActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      leadId: id,
      type: 'stage_change',
      title: `Stage changed to ${newStage}`,
      detail: oldStage ? `From "${oldStage}" → "${newStage}"` : undefined,
      timestamp: new Date().toISOString(),
    };
    return {
      leads: s.leads.map((l) => l.id === id ? { ...l, stage: newStage, stageId: newStageId ?? l.stageId, lastActivity: new Date().toISOString() } : l),
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
  completeFollowUp: (id, leadId) => {
    set((s) => {
      const resolvedLeadId = leadId ?? s.followUps.find((f) => f.id === id)?.leadId;
      if (resolvedLeadId) {
        api.patch(`/api/leads/${resolvedLeadId}/followups/${id}`, { completed: true }).catch(() => null);
      }
      return { followUps: s.followUps.map((f) => f.id === id ? { ...f, completed: true } : f) };
    });
  },

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
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  markNotificationRead: (id) => {
    set((s) => ({ notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) }));
    api.patch(`/api/notifications/${id}/read`, {}).catch(() => {});
  },
  markAllNotificationsRead: () => {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    api.post('/api/notifications/read-all', {}).catch(() => {});
  },

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
  addPipeline: async (pipeline) => {
    const created = await api.post<any>('/api/pipelines', {
      name: pipeline.name,
      stages: pipeline.stages.map((s) => s.name),
    });
    const mapped: Pipeline = {
      id: created.id,
      name: created.name,
      stages: (created.stages ?? []).map((s: any) => ({ id: s.id, name: s.name, color: s.color ?? '#94a3b8' })),
    };
    set((s) => ({ pipelines: [...s.pipelines, mapped] }));
  },
  updatePipeline: async (id, updates) => {
    // Capture old stages BEFORE optimistic update
    const oldStages = useCrmStore.getState().pipelines.find((p) => p.id === id)?.stages ?? [];

    // Optimistic update
    set((s) => ({ pipelines: s.pipelines.map((p) => p.id === id ? { ...p, ...updates } : p) }));

    // Persist name change
    if (updates.name) {
      await api.patch(`/api/pipelines/${id}`, { name: updates.name }).catch(() => null);
    }

    // Persist stage changes
    if (updates.stages) {
      const newStages = updates.stages;
      const isTempId = (sid: string) => sid.startsWith('s-') || sid.startsWith('new-');

      // DELETE stages that were removed
      for (const old of oldStages) {
        if (!isTempId(old.id) && !newStages.find((s) => s.id === old.id)) {
          await api.delete(`/api/pipelines/${id}/stages/${old.id}`).catch(() => null);
        }
      }

      const finalStages: PipelineStage[] = [];
      for (let i = 0; i < newStages.length; i++) {
        const s = newStages[i];
        if (isTempId(s.id)) {
          // New stage — create
          const created = await api.post<any>(`/api/pipelines/${id}/stages`, {
            name: s.name, stage_order: i, color: s.color ?? null,
          }).catch(() => null);
          finalStages.push(created ? { id: created.id, name: created.name, color: created.color ?? s.color } : s);
        } else {
          // Existing stage — patch if changed
          const old = oldStages.find((o) => o.id === s.id);
          if (old && (old.name !== s.name || old.color !== s.color)) {
            await api.patch(`/api/pipelines/${id}/stages/${s.id}`, {
              name: s.name, stage_order: i, color: s.color ?? null,
            }).catch(() => null);
          }
          finalStages.push(s);
        }
      }

      // Update store with real IDs after creation
      set((st) => ({
        pipelines: st.pipelines.map((p) =>
          p.id === id ? { ...p, stages: finalStages } : p
        ),
      }));
    }
  },
  deletePipeline: async (id) => {
    await api.delete(`/api/pipelines/${id}`);
    set((s) => ({ pipelines: s.pipelines.filter((p) => p.id !== id) }));
  },
  clonePipeline: async (id) => {
    const src = useCrmStore.getState().pipelines.find((p) => p.id === id);
    if (!src) return;
    try {
      const created = await api.post<any>('/api/pipelines', {
        name: `${src.name} (Copy)`,
        stages: src.stages.map((s) => s.name),
      });
      const mapped: Pipeline = {
        id: created.id,
        name: created.name,
        stages: (created.stages ?? []).map((s: any) => ({ id: s.id, name: s.name, color: s.color ?? '#94a3b8' })),
      };
      set((s) => ({ pipelines: [...s.pipelines, mapped] }));
    } catch {
      const newId = `pipeline-${Date.now()}`;
      set((s) => ({ pipelines: [...s.pipelines, { ...src, id: newId, name: `${src.name} (Copy)`, stages: src.stages.map((st) => ({ ...st, id: `${st.id}-c` })) }] }));
    }
  },

  refreshPipelines: async () => {
    const res = await api.get<any[]>('/api/pipelines');
    const mapped: Pipeline[] = res.map((p) => ({
      id: p.id,
      name: p.name,
      stages: (p.stages ?? []).map((s: any) => ({ id: s.id, name: s.name, color: s.color ?? '#94a3b8' })),
    }));
    set({ pipelines: mapped });
  },

  initFromApi: async () => {
    const { currentUser } = useAuthStore.getState();
    if (currentUser?.role === 'super_admin' && !currentUser?.tenantId) return;

    try {
      const [leadsRes, staffRes, pipelinesRes, calRes, tagsRes, questionsRes, convsRes, notifsRes, bookingLinksRes, followUpsRes, customFieldsRes, workflowsRes] = await Promise.all([
        api.get<any[]>('/api/leads?limit=5000').catch(() => [] as any[]),
        api.get<any[]>('/api/settings/staff').catch(() => [] as any[]),
        api.get<any[]>('/api/pipelines').catch(() => [] as any[]),
        api.get<any[]>('/api/calendar').catch(() => [] as any[]),
        api.get<any[]>('/api/tags').catch(() => [] as any[]),
        api.get<any[]>('/api/fields/questions').catch((e) => { console.warn('[initFromApi] fields/questions failed:', e?.response?.status); return [] as any[]; }),
        api.get<any[]>('/api/conversations').catch(() => [] as any[]),
        api.get<any[]>('/api/notifications').catch(() => [] as any[]),
        api.get<any[]>('/api/calendar/event-types').catch(() => [] as any[]),
        api.get<any[]>('/api/leads/followups').catch(() => [] as any[]),
        api.get<any[]>('/api/fields/custom').catch((e) => { console.warn('[initFromApi] fields/custom failed:', e?.response?.status); return [] as any[]; }),
        api.get<any[]>('/api/workflows').catch(() => [] as any[]),
      ]);

      // Build stageId → stageName lookup
      const stageMap: Record<string, string> = {};
      for (const p of pipelinesRes) {
        for (const s of (p.stages ?? [])) {
          stageMap[s.id] = s.name;
        }
      }

      const mappedPipelines: Pipeline[] = pipelinesRes.map((p) => ({
        id: p.id,
        name: p.name,
        stages: (p.stages ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          color: s.color ?? '#94a3b8',
        })),
      }));

      const mappedLeads: Lead[] = leadsRes.map((l) => {
        const parts = (l.name ?? '').split(' ');
        const stageName = stageMap[l.stage_id] ?? l.stage_name ?? 'New Lead';
        return {
          id: l.id,
          firstName: parts[0] ?? '',
          lastName: parts.slice(1).join(' ') ?? '',
          email: l.email ?? '',
          phone: l.phone ?? '',
          stage: stageName,
          stageId: l.stage_id ?? '',
          pipelineId: l.pipeline_id ?? '',
          source: l.source ?? 'Manual',
          meta_form_name: l.meta_form_name ?? undefined,
          custom_form_name: l.custom_form_name ?? undefined,
          tags: l.tags ?? [],
          assignedTo: l.assigned_to ?? '',
          assignedName: l.assigned_name ?? '',
          createdAt: l.created_at ?? new Date().toISOString(),
          lastActivity: l.updated_at ?? l.created_at ?? new Date().toISOString(),
          businessName: '',
          city: '',
          notes: l.notes ?? '',
          dealValue: 0,
          value: 0,
          probability: 0,
          nextFollowUp: null,
          customFields: [],
          leadQuality: l.custom_fields?.lead_quality ?? '',
        } as Lead;
      });

      const mappedStaff: StaffMember[] = staffRes.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role as StaffMember['role'],
        status: s.is_active ? 'active' as const : 'inactive' as const,
        leadsAssigned: 0,
        lastActive: s.created_at ?? new Date().toISOString(),
        avatar: (s.name as string).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      }));

      const mappedEvents: CalendarEvent[] = calRes.map((e) => ({
        id: e.id,
        title: e.title,
        type: (e.type ?? 'meeting') as CalendarEvent['type'],
        leadName: e.lead_name ?? '',
        assignedTo: e.assigned_to ?? '',
        createdBy: e.created_by ?? undefined,
        createdByName: e.created_by_name ?? undefined,
        date: e.start_time ? e.start_time.slice(0, 10) : new Date().toISOString().slice(0, 10),
        time: e.start_time ? e.start_time.slice(11, 16) : '09:00',
        duration: e.end_time && e.start_time
          ? Math.round((new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000)
          : 60,
        status: (['scheduled','completed','no-show','cancelled'].includes(e.status) ? e.status : 'scheduled') as CalendarEvent['status'],
        notes: e.description ?? '',
      }));

      const mappedTags = tagsRes.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color ?? '#94a3b8',
        count: t.lead_count ?? 0,
      }));

      const mappedAdditionalFields: AdditionalField[] = (questionsRes ?? []).map((r: any) => ({
        id: r.id,
        pipelineId: r.pipeline_id ?? 'all',
        question: r.question,
        type: r.type as AdditionalFieldType,
        slug: r.slug,
        options: r.options ?? undefined,
        required: r.required ?? false,
      }));

      const mappedConversations = (convsRes ?? []).map((c: any) => ({
        id: c.id,
        leadId: c.lead_id ?? '',
        leadName: c.lead_name ?? 'Unknown',
        leadPhone: c.lead_phone ?? '',
        channel: (c.channel ?? 'whatsapp') as 'whatsapp',
        lastMessage: c.last_message ?? '',
        lastMessageTime: c.last_message_at ?? c.created_at ?? new Date().toISOString(),
        unreadCount: c.unread_count ?? 0,
        status: (c.status ?? 'open') as 'open' | 'pending' | 'resolved',
        assignedTo: c.assigned_to ?? '',
        messages: [],
      }));

      const mappedNotifications = (notifsRes ?? []).map((n: any) => ({
        id: n.id,
        type: 'lead_created' as const,
        message: n.title + (n.message ? `: ${n.message}` : ''),
        time: n.created_at ?? new Date().toISOString(),
        read: n.is_read ?? false,
        avatar: '🔔',
      }));

      const mappedBookingLinks = (bookingLinksRes ?? []).map((b: any) => ({
        id: b.id,
        title: b.name,
        name: b.name,
        eventType: b.meeting_type ?? 'meeting',
        slug: b.slug,
        duration: b.duration ?? 30,
        buffer: b.buffer_time ?? 0,
        isActive: b.is_active ?? true,
        url: `/book/${b.slug}`,
        meetingType: b.meeting_type ?? '',
        meetingLink: b.meeting_link ?? '',
        schedule: b.schedule ?? {},
        capacityPerSlot: b.capacity_per_slot ?? 1,
      }));

      const mappedFollowUps = (followUpsRes ?? []).map((f: any) => ({
        id: f.id,
        leadId: f.lead_id,
        note: f.title + (f.description ? `\n${f.description}` : ''),
        dueAt: f.due_at,
        completed: f.completed ?? false,
        assignedTo: f.assigned_to ?? '',
        createdAt: f.created_at ?? new Date().toISOString(),
      }));

      const mappedCustomFields = (customFieldsRes ?? []).map((cf: any) => ({
        id: cf.id,
        name: cf.name,
        slug: cf.slug,
        type: cf.type,
        required: cf.required ?? false,
        visible: cf.visible ?? true,
        options: cf.options ?? undefined,
        orderIndex: cf.order_index ?? 0,
      }));

      const mappedWorkflows = (workflowsRes ?? []).map((w: any) => ({
        id: w.id,
        name: w.name,
        status: (w.status ?? 'inactive') as 'active' | 'inactive',
        trigger: w.trigger_key ?? '',
        nodes: w.nodes ?? [],
        allowReentry: w.allow_reentry ?? false,
        createdAt: w.created_at ?? new Date().toISOString(),
      }));

      set({
        leads: mappedLeads,
        staff: mappedStaff,
        pipelines: mappedPipelines,
        calendarEvents: mappedEvents,
        tags: mappedTags,
        conversations: mappedConversations,
        notifications: mappedNotifications,
        bookingLinks: mappedBookingLinks,
        followUps: mappedFollowUps,
        workflows: mappedWorkflows,
        customFields: mappedCustomFields,
        additionalFields: mappedAdditionalFields,
      });
    } catch {
      // Keep mock data if API fails (e.g. not logged in yet)
    }
  },
}));
