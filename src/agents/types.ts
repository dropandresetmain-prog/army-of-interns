import type { StructuredEventType } from "../core/domain/vocabulary";

export type AgentName = "Alex" | "Shu Zhen" | "Daniel";

export type AgentKind = "manager" | "operations" | "procurement";

export interface RuntimePerson {
  id: string;
  displayName: string;
  roleType: string;
  demoCallsign?: string;
  telegramChatId?: string;
}

export interface RuntimeWorker {
  id: string;
  name: string;
  title: string;
  rank: string;
  employmentType: string;
  status: string;
  personality: string;
  communicationStyle: string;
  standingInstructions: string[];
  toolPermissionIds: string[];
  capabilityKeys: string[];
  successfulTasks: number;
  tasksCompleted: number;
  promotionEligible: boolean;
}

export interface RuntimeWorkItem {
  id: string;
  objective: string;
  context: string;
  constraints: string[];
  successCriteria: string[];
  status: string;
}

export interface RuntimeQuote {
  personId: string;
  displayName?: string;
  price?: number;
  availability?: string;
  extractStatus: string;
  viable?: boolean;
  rank?: number;
}

export interface RuntimeApproval {
  id: string;
  actionType: string;
  status: string;
  reason: string;
  selectedName?: string;
  price?: number;
  availability?: string;
}

export interface RuntimeMessage {
  direction: string;
  body: string;
  personDisplayName?: string;
  roleType?: string;
}

export interface RuntimeEvent {
  eventType: string;
  summary: string;
  agentName?: string;
}

export interface RuntimeSnapshot {
  phase: string;
  companyName?: string;
  companyDescription?: string;
  workItem?: RuntimeWorkItem;
  actor?: RuntimeWorker;
  workers: RuntimeWorker[];
  people: RuntimePerson[];
  assignments: Array<{ workerId: string; responsibility: string; status: string }>;
  approval?: RuntimeApproval;
  quotes: RuntimeQuote[];
  recentMessages: RuntimeMessage[];
  recentEvents: RuntimeEvent[];
  pendingManagerFollowUp: boolean;
  pendingStaffingCapabilityKeys: string[];
  selectedContractorPersonId?: string;
  tenantPersonId?: string;
}

export interface OutboundMessage {
  personId?: string;
  chatId?: string;
  body: string;
}

export interface AgentActivity {
  eventType: StructuredEventType;
  summary: string;
  metadata: Record<string, string | number | boolean | string[] | null>;
}

export const MANAGER_TOOL_NAMES = [
  "inspect_work",
  "inspect_workforce",
  "staff_work",
  "delegate_worker",
  "request_approval",
  "resolve_approval",
  "inspect_outcome",
  "recommend_promotion",
  "send_message",
  "log_action",
] as const;

export const WORKER_TOOL_BY_PERMISSION: Record<string, string> = {
  permission_read_business_record: "inspect_work",
  permission_update_work_item: "update_work_context",
  permission_send_message: "send_message",
  permission_log_event: "log_action",
  permission_request_staffing: "request_staffing",
  permission_verify_outcome: "verify_outcome",
  permission_solicit_options: "solicit_options",
  permission_collect_response: "record_option",
  permission_evaluate_options: "evaluate_options",
  permission_report_recommendation: "report_recommendation",
};

export const PROCUREMENT_ONLY_TOOLS = [
  "solicit_options",
  "record_option",
  "evaluate_options",
  "report_recommendation",
] as const;

export const APPROVAL_TOOLS = ["resolve_approval", "request_approval"] as const;
