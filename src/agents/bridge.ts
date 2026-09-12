import type { AgentActivity, RuntimeSnapshot } from "./types";

export interface StaffWorkInput {
  objective: string;
  capabilityKeys?: string[];
  requestedByPersonId?: string;
}

export interface StaffWorkResult {
  workerId: string;
  workerName: string;
  workItemId: string;
  assignmentId: string;
  capabilityKeys: string[];
}

export interface SendMessageInput {
  body: string;
  personId?: string;
  roleType?: string;
  demoCallsign?: string;
}

export interface RecordOptionInput {
  personId?: string;
  price?: number | null;
  availability?: string | null;
  rawMessage: string;
}

export interface RankedOption {
  personId: string;
  price: number | null;
  availability: string | null;
  viable: boolean;
  rank: number | null;
  rejectedReason?: string;
}

export interface AgentBridge {
  snapshot: () => RuntimeSnapshot;
  refresh: () => Promise<RuntimeSnapshot>;
  emit: (activity: AgentActivity) => Promise<void>;
  staffWork: (input: StaffWorkInput) => Promise<StaffWorkResult>;
  requestStaffing: (input: { capabilityKeys: string[]; reason: string }) => Promise<{ ok: boolean }>;
  staffCapabilities: (input: {
    capabilityKeys: string[];
    workerName?: string;
    workerTitle?: string;
  }) => Promise<StaffWorkResult>;
  sendMessage: (input: SendMessageInput) => Promise<{ sent: boolean; personId?: string }>;
  solicitOptions: (input: { body: string }) => Promise<{ contacted: number }>;
  recordOption: (input: RecordOptionInput) => Promise<{
    ok: boolean;
    needClarification: boolean;
    recordedCount: number;
  }>;
  evaluateOptions: () => Promise<{
    winnerPersonId: string | null;
    ranked: RankedOption[];
  }>;
  reportRecommendation: (input: { summary: string }) => Promise<{ ok: boolean }>;
  requestApproval: (input: { reason: string }) => Promise<{ approvalId: string }>;
  resolveApproval: (input: {
    decision: "approved" | "rejected";
  }) => Promise<{ status: string; confirmed: boolean }>;
  verifyOutcome: (input: {
    confirmed: boolean;
    notes: string;
  }) => Promise<{ completed: boolean; promotionEligible: boolean }>;
  updateWorkContext: (input: {
    phase?: string;
    notes?: string;
  }) => Promise<{ phase: string }>;
  recommendPromotion: () => Promise<{ approvalId?: string; eligible: boolean }>;
  runWorkerAgent: (input: {
    workerId?: string;
    workerName?: string;
    brief: string;
  }) => Promise<{ finalOutput?: string; workerName: string }>;
}
