// Assignment rules are evaluated and displayed via GET /api/assignment-rules.
// Leads are NEVER auto-assigned. Assignment only happens when:
//   1. A user manually sets assigned_to in the UI
//   2. An "Assign Staff" workflow action node explicitly assigns a lead
// Do NOT add any auto-assignment logic here.

export interface LeadForAssignment {
  id: string;
  source?: string;
  pipeline_id?: string;
  stage_id?: string;
  stage_name?: string;
  [key: string]: any;
}
