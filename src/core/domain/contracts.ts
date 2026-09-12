import type {
  ApprovalStatus,
  AssignmentStatus,
  EmploymentType,
  RiskClass,
  StructuredEventType,
  WorkerRank,
  WorkerStatus,
  WorkItemStatus,
} from "./vocabulary";

export type EntityId = string;
export type ToolPermissionId = string;
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type Metadata = Record<string, JsonValue>;

export interface CompanyProfile {
  name: string;
  businessDescription: string;
  ownerPersonId: EntityId;
  operatingPolicies: Record<string, string>;
  approvalPolicies: Record<string, string>;
  terminology: Record<string, string>;
  availableToolIds: EntityId[];
}

export interface Person {
  displayName: string;
  roleType: string;
  whatsappNumber?: string;
  demoCallsign?: string;
  active: boolean;
  scenarioMetadata?: Metadata;
}

export interface WorkerModelConfig {
  provider?: string;
  model?: string;
  routingPreference?: string;
}

export interface Worker {
  name: string;
  title: string;
  employmentType: EmploymentType;
  rank: WorkerRank;
  managerWorkerId?: EntityId;
  status: WorkerStatus;
  capabilityIds: EntityId[];
  // Capabilities describe competence; these explicit grants control tool access.
  toolPermissionIds: ToolPermissionId[];
  personality: string;
  communicationStyle: string;
  standingInstructions: string[];
  modelConfig?: WorkerModelConfig;
  tasksCompleted: number;
  successfulTasks: number;
  promotionEligible: boolean;
}

export interface Capability {
  key: string;
  name: string;
  description: string;
  defaultToolPermissionIds?: ToolPermissionId[];
}

export interface WorkItem {
  objective: string;
  context: string;
  constraints: string[];
  status: WorkItemStatus;
  requestedByPersonId: EntityId;
  parentWorkItemId?: EntityId;
  requiredCapabilityIds: EntityId[];
  successCriteria: string[];
  deadline?: number;
  budget?: {
    amount: number;
    currency: string;
  };
  policyMetadata?: Metadata;
}

export interface Assignment {
  workItemId: EntityId;
  workerId: EntityId;
  responsibility: string;
  status: AssignmentStatus;
  resultSummary?: string;
}

export interface Approval {
  workItemId: EntityId;
  requestedFromPersonId: EntityId;
  proposedByWorkerId: EntityId;
  actionType: string;
  reason: string;
  riskClass: RiskClass;
  amount?: {
    value: number;
    currency: string;
  };
  payload: Metadata;
  status: ApprovalStatus;
  requestedAt: number;
  resolvedAt?: number;
}

export interface StructuredEvent {
  timestamp: number;
  workerId?: EntityId;
  workItemId?: EntityId;
  eventType: StructuredEventType;
  summary: string;
  metadata: Metadata;
}

export interface ToolDefinition {
  key: string;
  description: string;
  riskClass: RiskClass;
  requiredPermissions: ToolPermissionId[];
}

/** Provider-agnostic channel message persisted for transport/correlation. */
export type MessageDirection = "inbound" | "outbound";
export type MessageChannel = "whatsapp";
export type MessageProvider = "twilio";
export type ChannelMessageStatus = "received" | "sent" | "failed";

export interface ChannelMessage {
  provider: MessageProvider;
  providerMessageId: string;
  direction: MessageDirection;
  channel: MessageChannel;
  /** Normalized E.164. Persist for correlation; never show in public UI. */
  participantAddress: string;
  personId?: EntityId;
  body: string;
  status: ChannelMessageStatus;
  createdAt: number;
  providerMetadata?: Metadata;
}

export interface WorkerSpec {
  name: string;
  title: string;
  employmentType: EmploymentType;
  rank: WorkerRank;
  managerWorkerId?: EntityId;
  capabilityIds: EntityId[];
  toolPermissionIds: ToolPermissionId[];
  personality: string;
  communicationStyle: string;
  standingInstructions: string[];
  modelPreference?: WorkerModelConfig;
  reasonForCreation: string;
}
