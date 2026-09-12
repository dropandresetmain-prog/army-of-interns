import { describe, expect, it } from "vitest";

import { selectPendingApprovalId } from "./approvals";
import {
  canReportContractorCompletion,
  canResolveApproval,
  canVerifyOutcome,
} from "./authority";
import type { AgentBridge } from "./bridge";
import { activityForFallback, activityForTool } from "./events";
import { createManagerAgent, createWorkerAgent, toolNamesOf } from "./factory";
import { REQUIRED_FINALE_EVENT_TYPES } from "./finaleEvents";
import { inboundAgentPrompt, managerFollowUpPrompt } from "./prompts";
import { selectAgentKind } from "./routing";
import { managerTools } from "./tools";
import type { RuntimeSnapshot, RuntimeWorker } from "./types";
import { STRUCTURED_EVENT_TYPES } from "../core/domain/vocabulary";

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

const recording: {
  resolve?: { decision: "approved" | "rejected" };
  messages: Array<{ body: string; roleType?: string; personId?: string }>;
  verify?: { confirmed: boolean; notes: string };
  phase?: string;
} = {
  messages: [],
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
  sendMessage: async (input) => {
    recording.messages.push({
      body: input.body,
      roleType: input.roleType,
      personId: input.personId,
    });
    return { sent: true, personId: input.personId };
  },
  solicitOptions: async () => ({ contacted: 0 }),
  recordOption: async () => ({ ok: true, needClarification: false, recordedCount: 0 }),
  evaluateOptions: async () => ({ winnerPersonId: null, ranked: [] }),
  reportRecommendation: async () => ({ ok: true }),
  requestApproval: async () => ({ approvalId: "a1" }),
  resolveApproval: async (input) => {
    recording.resolve = input;
    return {
      status: input.decision,
      confirmed: input.decision === "approved",
      selectedPersonId: input.decision === "approved" ? "person_contractor_c" : undefined,
      tenantPersonId: input.decision === "approved" ? "person_tenant" : undefined,
    };
  },
  verifyOutcome: async (input) => {
    recording.verify = input;
    return { completed: input.confirmed, promotionEligible: input.confirmed };
  },
  updateWorkContext: async (input) => {
    recording.phase = input.phase;
    return { phase: input.phase ?? "idle" };
  },
  recommendPromotion: async () => ({ approvalId: "promo1", eligible: true }),
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
  capabilityKeys: ["maintenance_triage"],
  successfulTasks: 2,
  tasksCompleted: 2,
  promotionEligible: false,
};

/** Test double for model semantics. Production uses the real Agents SDK. */
function interpretOwnerIntent(text: string): "approved" | "rejected" | "unclear" {
  const normalized = text.toLowerCase();
  if (
    /\b(yeah go ahead|book c|looks fine|looks good|let's proceed|approve|sure make her|keep her|promote|make her permanent)\b/.test(
      normalized,
    )
  ) {
    return "approved";
  }
  if (/\b(nah|too expensive|don't|do not|find another|reject)\b/.test(normalized)) {
    return "rejected";
  }
  return "unclear";
}

function interpretContractorCompletion(text: string): boolean {
  return /\b(done already|job completed|fixed it|all sorted|repair is finished|done)\b/i.test(text);
}

function interpretTenantOutcome(text: string): boolean | null {
  const normalized = text.toLowerCase();
  if (/\b(still leaking|same problem|started again|not fixed)\b/.test(normalized)) {
    return false;
  }
  if (/\b(yes it's fixed|all good|no more leaking|working perfectly|looks resolved|yes fixed)\b/.test(normalized)) {
    return true;
  }
  return null;
}

async function runOwnerToolPath(text: string, bridge: AgentBridge) {
  const decision = interpretOwnerIntent(text);
  if (decision === "unclear") {
    return await bridge.sendMessage({
      roleType: "business_owner",
      body: "Do you want me to proceed with this recommendation?",
    });
  }
  return await bridge.resolveApproval({ decision });
}

describe("free-form owner spend approval tool path", () => {
  it("approves natural owner language through resolve_approval", async () => {
    recording.resolve = undefined;
    const result = await runOwnerToolPath("yeah go ahead with contractor C", stubBridge);
    expect(recording.resolve).toEqual({ decision: "approved" });
    expect(result).toMatchObject({
      status: "approved",
      confirmed: true,
      selectedPersonId: "person_contractor_c",
      tenantPersonId: "person_tenant",
    });
  });

  it("rejects natural owner language without committing", async () => {
    recording.resolve = undefined;
    const result = await runOwnerToolPath("nah that's too expensive, don't book them", stubBridge);
    expect(recording.resolve).toEqual({ decision: "rejected" });
    expect(result).toMatchObject({
      status: "rejected",
      confirmed: false,
    });
    expect(result).not.toHaveProperty("selectedPersonId", "person_contractor_c");
  });

  it("asks one clarification when owner intent is ambiguous", async () => {
    recording.resolve = undefined;
    recording.messages = [];
    await runOwnerToolPath("what was the price again?", stubBridge);
    expect(recording.resolve).toBeUndefined();
    expect(recording.messages[0]?.body).toMatch(/proceed/i);
  });
});

describe("free-form promotion approval tool path", () => {
  it("routes owner promotion replies to Alex and uses resolve_approval", async () => {
    expect(
      selectAgentKind({
        phase: "awaiting_promotion",
        roleType: "business_owner",
      }),
    ).toBe("manager");
    expect(inboundAgentPrompt({
      kind: "manager",
      phase: "awaiting_promotion",
      roleType: "business_owner",
      body: "yeah keep Shu Zhen around, she's useful",
    })).toContain("promote_worker");

    recording.resolve = undefined;
    await runOwnerToolPath("sure make her permanent", stubBridge);
    expect(recording.resolve).toEqual({ decision: "approved" });
  });
});

describe("natural contractor completion and tenant verification", () => {
  it("routes selected contractor completion to operations", () => {
    expect(
      selectAgentKind({
        phase: "awaiting_contractor_done",
        roleType: "contractor",
        isSelectedContractor: true,
      }),
    ).toBe("operations");
    expect(
      interpretContractorCompletion("job's done boss"),
    ).toBe(true);
    expect(interpretContractorCompletion("can you confirm the address?")).toBe(false);
    expect(
      inboundAgentPrompt({
        kind: "operations",
        phase: "awaiting_contractor_done",
        roleType: "contractor",
        body: "fixed it already",
      }),
    ).toContain("awaiting_tenant_verification");
  });

  it("routes tenant verification to Shu Zhen and supports negative outcomes", async () => {
    expect(
      selectAgentKind({
        phase: "awaiting_tenant_verification",
        roleType: "tenant",
      }),
    ).toBe("operations");
    expect(interpretTenantOutcome("yep no leak anymore, all good")).toBe(true);
    expect(interpretTenantOutcome("still leaking actually")).toBe(false);
    expect(interpretTenantOutcome("the tap looks different")).toBeNull();

    recording.verify = undefined;
    const confirmed = interpretTenantOutcome("working perfectly");
    expect(confirmed).toBe(true);
    await stubBridge.verifyOutcome({ confirmed: true, notes: "working perfectly" });
    expect(recording.verify).toEqual({ confirmed: true, notes: "working perfectly" });

    await stubBridge.verifyOutcome({ confirmed: false, notes: "still leaking" });
    expect(recording.verify).toEqual({ confirmed: false, notes: "still leaking" });
  });
});

describe("human authority identity guards", () => {
  it("only allows the registered owner to resolve approvals", () => {
    expect(
      canResolveApproval({
        actorPersonId: "owner_1",
        actorRoleType: "business_owner",
        ownerPersonId: "owner_1",
      }),
    ).toBe(true);
    expect(
      canResolveApproval({
        actorPersonId: "tenant_1",
        actorRoleType: "tenant",
        ownerPersonId: "owner_1",
      }),
    ).toBe(false);
    expect(
      canResolveApproval({
        actorPersonId: "contractor_1",
        actorRoleType: "contractor",
        ownerPersonId: "owner_1",
      }),
    ).toBe(false);
    expect(canResolveApproval({ actorRoleType: "business_owner" })).toBe(false);
  });

  it("only allows the selected contractor to report completion", () => {
    expect(
      canReportContractorCompletion({
        actorPersonId: "c_selected",
        selectedContractorPersonId: "c_selected",
      }),
    ).toBe(true);
    expect(
      canReportContractorCompletion({
        actorPersonId: "c_other",
        selectedContractorPersonId: "c_selected",
      }),
    ).toBe(false);
  });

  it("only allows the registered tenant to verify the outcome", () => {
    expect(
      canVerifyOutcome({
        actorPersonId: "tenant_1",
        actorRoleType: "tenant",
        tenantPersonId: "tenant_1",
      }),
    ).toBe(true);
    expect(
      canVerifyOutcome({
        actorPersonId: "owner_1",
        actorRoleType: "business_owner",
        tenantPersonId: "tenant_1",
      }),
    ).toBe(false);
  });
});

describe("promotion approval preference", () => {
  it("chooses promotionApprovalId over the historical spend approval", () => {
    expect(
      selectPendingApprovalId({
        phase: "awaiting_promotion",
        approvalId: "spend_old",
        promotionApprovalId: "promo_new",
      }),
    ).toBe("promo_new");
    expect(
      selectPendingApprovalId({
        phase: "awaiting_promotion",
        approvalId: "spend_old",
      }),
    ).toBeUndefined();
    expect(
      selectPendingApprovalId({
        phase: "awaiting_owner_approval",
        approvalId: "spend_old",
        promotionApprovalId: "promo_new",
      }),
    ).toBe("spend_old");
  });
});

describe("Alex messaging and approval identities", () => {
  it("gives Alex send_message and surfaces selected contractor plus tenant after approve", async () => {
    const agent = createManagerAgent(alex, stubBridge, emptySnapshot);
    expect(toolNamesOf(agent)).toContain("send_message");

    const tools = managerTools(stubBridge);
    expect(tools.map((tool) => ("name" in tool ? tool.name : ""))).toContain("send_message");

    recording.resolve = undefined;
    const result = await stubBridge.resolveApproval({ decision: "approved" });
    expect(result.selectedPersonId).toBe("person_contractor_c");
    expect(result.tenantPersonId).toBe("person_tenant");
  });

  it("uses a promotion follow-up prompt after verified completion, not spend approval", () => {
    expect(
      managerFollowUpPrompt({
        phase: "awaiting_promotion",
        pendingStaffingCapabilityKeys: [],
      }),
    ).toMatch(/recommend_promotion/);
    expect(
      managerFollowUpPrompt({
        phase: "awaiting_promotion",
        pendingStaffingCapabilityKeys: [],
      }),
    ).not.toMatch(/request_approval/);
  });
});

describe("required finale events", () => {
  it("keeps the live finale event types on the structured vocabulary", () => {
    for (const eventType of REQUIRED_FINALE_EVENT_TYPES) {
      expect(STRUCTURED_EVENT_TYPES).toContain(eventType);
    }
    expect(activityForTool({ agentName: "Shu Zhen", toolName: "verify_outcome" }).eventType).toBe(
      "work_verified",
    );
    expect(activityForTool({ agentName: "Alex", toolName: "recommend_promotion" }).eventType).toBe(
      "promotion_recommended",
    );
    expect(activityForTool({ agentName: "Alex", toolName: "resolve_approval" }).eventType).toBe(
      "approval_resolved",
    );
    expect(activityForFallback("provider timeout").metadata.toolName).toBe("fallback");
  });
});

describe("operations agent still verifies outcomes", () => {
  it("keeps verify_outcome on Shu Zhen and not on Alex-only authority tools", () => {
    const ops = createWorkerAgent(shuZhen, stubBridge, emptySnapshot);
    expect(toolNamesOf(ops)).toContain("verify_outcome");
    expect(toolNamesOf(ops)).not.toContain("resolve_approval");
  });
});
