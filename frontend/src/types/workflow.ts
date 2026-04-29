export interface WFFolder { id: string; name: string; workflowIds: string[]; }

export interface WFNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay';
  actionType: string;
  label: string;
  config: Record<string, string | string[] | boolean>;
  branches?: { yes: WFNode[]; no: WFNode[] };
}

export interface WFRecord {
  id: string;
  name: string;
  description: string;
  allowReentry: boolean;
  totalContacts: number;
  completed: number;
  completedWithErrors: number;
  skipped: number;
  failed: number;
  pending: number;
  completedNodes: number;
  lastUpdated: string;
  status: 'active' | 'inactive';
  nodes: WFNode[];
}
