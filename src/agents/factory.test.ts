import { describe, expect, it } from "vitest";

import type { AgentBridge } from "./bridge";
import { activityForTool } from "./events";
import { createManagerAgent, createWorkerAgent, instructionsForWorker, toolNamesOf } from "./factory";
import { expectedToolNamesForWorker, toolNamesForPermissions } from "./permissions";
import { selectAgentKind } from "./routing";
import {
  APPROVAL_TOOLS,
  PROCUREMENT_ONLY_TOOLS,
  type RuntimeSnapshot,
  type RuntimeWorker,
} from "./types";
import { DEMO_OPS_WORKER, DEMO_PROCUREMENT_WORKER } from "../scenarios/propertyMaintenance/identities";

const emptySnapshot: RuntimeSnapshot = {
  phase: "idle",
  workers: [],
  people: [],
  assignments: [],
  quotes: [],
  recentMessages: [],
  recentEvents: [],
  pendingManagerFollowUp: false,
  pendingStaffingCapabilityKeys: [],
};

const stubBridge: AgentBridge = {
  snapshot: () => emptySnapshot,
  refresh: async () => emptySnapshot,
  emit: async () => undefined,
  staffWork: async () => {
    throw new Error("not used");
  },
  requestStaffing: async () => ({ ok: true }),
  staffCapabilities: async () => {
    throw new Error("not used");
  },
  sendMessage: async () => ({ sent: true }),
  solicitOptions: async () => ({ contacted: 0 }),
  recordOption: async () => ({ ok: true, needClarification: false, recordedCount: 0 }),
  evaluateOptions: async () => ({ winnerPersonId: null, ranked: [] }),
  reportRecommendation: async () => ({ ok: true }),
  requestApproval: async () => ({ approvalId: "a1" }),
  resolveApproval: async () => ({
    status: "approved",
    confirmed: true,
    selectedPersonId: "person_contractor",
    tenantPersonId: "person_tenant",
  }),
  verifyOutcome: async () => ({ completed: true, promotionEligible: false }),
  updateWorkContext: async () => ({ phase: "idle" }),
  recommendPromotion: async () => ({ eligible: false }),
  runWorkerAgent: async () => ({ workerName: "x" }),
};

const alex: RuntimeWorker = {
  id: "w_alex",
  name: "Alex",
  title: "General Manager",
  rank: "manager",
  employmentType: "permanent",
  status: "idle",
  personality: "Calm and pragmatic.",
  communicationStyle: "Concise.",
  standingInstructions: [],
  toolPermissionIds: [],
  capabilityKeys: [],
  successfulTasks: 0,
  tasksCompleted: 0,
  promotionEligible: false,
};

const shuZhen: RuntimeWorker = {
  id: "w_ops",
  name: "Shu Zhen",
  title: "Operations Intern",
  rank: "intern",
  employmentType: "intern",
  status: "working",
  personality: "Efficient.",
  communicationStyle: "Concise.",
  standingInstructions: [],
  toolPermissionIds: [
    "permission_read_business_record",
    "permission_update_work_item",
    "permission_send_message",
    "permission_log_event",
    "permission_request_staffing",
    "permission_verify_outcome",
  ],
  capabilityKeys: ["maintenance_triage", "stakeholder_messaging"],
  successfulTasks: 2,
  tasksCompleted: 2,
  promotionEligible: false,
};

const daniel: RuntimeWorker = {
  id: "w_proc",
  name: "Daniel",
  title: "Procurement Intern",
  rank: "intern",
  employmentType: "intern",
  status: "working",
  personality: "Numbers-driven.",
  communicationStyle: "Short.",
  standingInstructions: [],
  toolPermissionIds: [
    "permission_solicit_options",
    "permission_send_message",
    "permission_collect_response",
    "permission_evaluate_options",
    "permission_report_recommendation",
    "permission_log_event",
  ],
  capabilityKeys: ["vendor_sourcing"],
  successfulTasks: 0,
  tasksCompleted: 0,
  promotionEligible: false,
};

describe("agent factory permission envelopes", () => {
  it("keeps Shu Zhen as permanent tenant-facing operations staff and Daniel as procurement intern", () => {
    expect(DEMO_OPS_WORKER.name).toBe("Shu Zhen");
    expect(DEMO_OPS_WORKER.employmentTypeOnCreate).toBe("permanent");
    expect(DEMO_PROCUREMENT_WORKER.name).toBe("Daniel");
    expect(DEMO_PROCUREMENT_WORKER.title).toMatch(/procurement/i);
  });

  it("exposes only permitted tools for a worker", () => {
    expect(toolNamesForPermissions(shuZhen.toolPermissionIds)).toEqual(
      expectedToolNamesForWorker(shuZhen),
    );
    expect(toolNamesForPermissions(daniel.toolPermissionIds)).toEqual(
      expectedToolNamesForWorker(daniel),
    );
  });

  it("gives Alex manager tools and not procurement-only tools by default", () => {
    const agent = createManagerAgent(alex, stubBridge, emptySnapshot);
    const names = toolNamesOf(agent);
    expect(names).toContain("staff_work");
    expect(names).toContain("delegate_worker");
    expect(names).toContain("request_approval");
    expect(names).toContain("resolve_approval");
    expect(names).toContain("send_message");
    expect(names).not.toContain("solicit_options");
    expect(names).not.toContain("evaluate_options");
  });

  it("does not give Shu Zhen procurement-only tools", () => {
    const agent = createWorkerAgent(shuZhen, stubBridge, emptySnapshot);
    const names = toolNamesOf(agent);
    expect(names).toContain("request_staffing");
    expect(names).toContain("verify_outcome");
    expect(names).toContain("send_message");
    for (const toolName of PROCUREMENT_ONLY_TOOLS) {
      expect(names).not.toContain(toolName);
    }
    expect(names).not.toContain("resolve_approval");
  });

  it("does not give Daniel spend-approval tools", () => {
    const agent = createWorkerAgent(daniel, stubBridge, emptySnapshot);
    const names = toolNamesOf(agent);
    expect(names).toContain("solicit_options");
    expect(names).toContain("record_option");
    expect(names).toContain("evaluate_options");
    for (const toolName of APPROVAL_TOOLS) {
      expect(names).not.toContain(toolName);
    }
    expect(names).not.toContain("verify_outcome");
    expect(names).not.toContain("staff_work");
  });
});

describe("shared worker instructions", () => {
  it("caps clarification turns and prefers action over conversation", () => {
    const text = instructionsForWorker(shuZhen, emptySnapshot);
    expect(text).toMatch(/Default to action over conversation/);
    expect(text).toMatch(/at most two clarification turns/);
    expect(text).toMatch(/1-2 sentences/);
    expect(text).toMatch(/use tools immediately/);
    expect(text).toMatch(/exactly one person/);
  });

  it("tells Alex not to seek redundant confirmation", () => {
    const text = instructionsForWorker(alex, emptySnapshot);
    expect(text).toMatch(/least chatty/);
    expect(text).toMatch(/Just to confirm/);
    expect(text).toMatch(/reasonably clear, act immediately/);
  });
});

describe("agent activity mapping", () => {
  it("maps tool boundaries to frozen structured event types", () => {
    const delegated = activityForTool({
      agentName: "Alex",
      toolName: "delegate_worker",
    });
    expect(delegated.eventType).toBe("assignment_started");
    expect(delegated.metadata.agentName).toBe("Alex");
    expect(delegated.metadata.toolName).toBe("delegate_worker");

    const contacted = activityForTool({
      agentName: "Shu Zhen",
      toolName: "send_message",
      targetRole: "tenant",
    });
    expect(contacted.eventType).toBe("human_contacted");
  });
});

describe("dispatcher routing", () => {
  it("routes by identity and phase, not semantic keywords", () => {
    expect(
      selectAgentKind({ phase: "idle", roleType: "tenant" }),
    ).toBe("operations");
    expect(
      selectAgentKind({
        phase: "awaiting_tenant_diagnosis",
        roleType: "tenant",
      }),
    ).toBe("operations");
    expect(
      selectAgentKind({
        phase: "awaiting_tenant_verification",
        roleType: "tenant",
      }),
    ).toBe("operations");
    expect(
      selectAgentKind({ phase: "soliciting_quotes", roleType: "contractor" }),
    ).toBe("procurement");
    expect(
      selectAgentKind({
        phase: "awaiting_owner_approval",
        roleType: "business_owner",
      }),
    ).toBe("manager");
    expect(
      selectAgentKind({
        phase: "awaiting_promotion",
        roleType: "business_owner",
      }),
    ).toBe("manager");
    expect(
      selectAgentKind({
        phase: "awaiting_contractor_done",
        roleType: "contractor",
        isSelectedContractor: true,
      }),
    ).toBe("operations");
    expect(
      selectAgentKind({
        phase: "awaiting_contractor_done",
        roleType: "contractor",
        isSelectedContractor: false,
      }),
    ).toBe("manager");
  });
});
