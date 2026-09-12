/**
 * Lane B's only contract with the application. Values originate in Convex;
 * this UI deliberately has no dependency on an agent runtime or provider SDK.
 */
export type WorkerStatus =
  | "idle"
  | "thinking"
  | "using_tool"
  | "waiting_human"
  | "delegating"
  | "blocked"
  | "complete";

export type Rank = "intern" | "permanent" | "senior" | "lead" | "manager";
export type EmploymentType = "intern" | "permanent";

export interface WorkforceWorker {
  id: string;
  name: string;
  title: string;
  employmentType: EmploymentType;
  rank: Rank;
  managerAgentId?: string;
  status: WorkerStatus;
  capabilities: string[];
}

export interface WorkItem {
  id: string;
  title: string;
  tenantCallsign: string;
  status: string;
  budget?: number;
  deadline?: string;
  assignedWorkerIds: string[];
  waitingOn?: string;
  completionVerified: boolean;
}

export interface OperationEvent {
  id: string;
  timestamp: number;
  workerId?: string;
  workItemId?: string;
  type: string;
  summary: string;
  detail?: string;
}

export interface QuoteView {
  id: string;
  contractorCallsign: string;
  price?: number;
  availability: string;
  withinBudget?: boolean;
  meetsDeadline?: boolean;
  selected?: boolean;
  recommendation?: string;
}

export interface ApprovalView {
  status: "pending" | "approved" | "rejected";
  action: string;
  requestedFrom: string;
}

export interface ParticipantCounts {
  ownerReady: boolean;
  tenant: { joined: number; required: number };
  contractors: { joined: number; required: number };
}

export interface CommandCentreState {
  workers: WorkforceWorker[];
  workItem?: WorkItem;
  events: OperationEvent[];
  quotes: QuoteView[];
  approval?: ApprovalView;
  participants: ParticipantCounts;
}

export const rankMark: Record<Rank, string> = {
  intern: "⌃",
  permanent: "⌃⌃",
  senior: "⌃⌃⌃",
  lead: "◆",
  manager: "★"
};

export const statusLabel: Record<WorkerStatus, string> = {
  idle: "Idle",
  thinking: "Thinking",
  using_tool: "Using tool",
  waiting_human: "Waiting on human",
  delegating: "Delegating",
  blocked: "Blocked",
  complete: "Complete"
};
