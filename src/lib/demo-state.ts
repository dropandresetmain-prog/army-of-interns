import type { CommandCentreState } from "./command-centre-types";

/** Temporary S4-shaped data. Replace the source, not the visual components. */
export const demoState: CommandCentreState = {
  workers: [
    { id: "alex", name: "Alex", title: "General Manager", employmentType: "permanent", rank: "manager", status: "delegating", capabilities: ["triage", "workforce planning", "approval coordination"] },
    { id: "shu-zhen", name: "Shu Zhen", title: "Operations Intern", employmentType: "intern", rank: "intern", managerAgentId: "alex", status: "waiting_human", capabilities: ["maintenance triage", "tenant coordination"] },
    { id: "kai", name: "Kai", title: "Procurement Intern", employmentType: "intern", rank: "intern", managerAgentId: "alex", status: "using_tool", capabilities: ["contractor sourcing", "quote intake"] }
  ],
  workItem: { id: "case-041", title: "Leaking toilet — Unit 18-07", tenantCallsign: "TENANT-01", status: "Sourcing quotes", budget: 450, deadline: "Today, 17:00", assignedWorkerIds: ["alex", "shu-zhen", "kai"], waitingOn: "3 contractor quotes", completionVerified: false },
  events: [
    { id: "e1", timestamp: Date.now() - 78000, workerId: "alex", type: "work_received", summary: "New maintenance request received.", detail: "Case CASE-041 opened for TENANT-01." },
    { id: "e2", timestamp: Date.now() - 63000, workerId: "alex", type: "capability_gap", summary: "Property-operations capability required." },
    { id: "e3", timestamp: Date.now() - 61000, workerId: "alex", type: "agent_created", summary: "Created Operations Intern: Shu Zhen." },
    { id: "e4", timestamp: Date.now() - 40000, workerId: "shu-zhen", type: "classified", summary: "Tenant response received. Issue classified: plumbing." },
    { id: "e5", timestamp: Date.now() - 29000, workerId: "alex", type: "agent_created", summary: "Created Procurement Intern: Kai." },
    { id: "e6", timestamp: Date.now() - 5000, workerId: "kai", type: "tool_invoked", summary: "Quote requests sent to available contractors." }
  ],
  quotes: [
    { id: "q1", contractorCallsign: "CONTRACTOR-01", price: 380, availability: "Today, 15:30", withinBudget: true, meetsDeadline: true, selected: true, recommendation: "Lowest viable quote, available before deadline" },
    { id: "q2", contractorCallsign: "CONTRACTOR-02", price: 420, availability: "Today, 16:00", withinBudget: true, meetsDeadline: true },
    { id: "q3", contractorCallsign: "CONTRACTOR-03", price: 280, availability: "Tomorrow, 09:00", withinBudget: true, meetsDeadline: false }
  ],
  approval: { status: "pending", action: "Confirm contractor booking", requestedFrom: "Business Owner" },
  participants: { ownerReady: true, tenant: { joined: 1, required: 1 }, contractors: { joined: 3, required: 3 } }
};

/**
 * Presentation fixtures, not workflow logic. Each snapshot represents state
 * already persisted by Convex after the corresponding live-flow checkpoint.
 */
export const liveFlowStages: Array<{ label: string; state: CommandCentreState }> = [
  {
    label: "Crew joins",
    state: {
      ...demoState,
      workers: [demoState.workers[0]],
      workItem: undefined,
      quotes: [], approval: undefined, events: [],
      participants: { ownerReady: true, tenant: { joined: 0, required: 1 }, contractors: { joined: 0, required: 3 } }
    }
  },
  {
    label: "Work received",
    state: {
      ...demoState,
      workers: [{ ...demoState.workers[0], status: "thinking" }], quotes: [], approval: undefined,
      participants: { ownerReady: true, tenant: { joined: 1, required: 1 }, contractors: { joined: 3, required: 3 } },
      events: [demoState.events[0]]
    }
  },
  {
    label: "Operations intern staffed",
    state: {
      ...demoState,
      workers: [demoState.workers[0], demoState.workers[1]], quotes: [], approval: undefined,
      events: demoState.events.slice(0, 4)
    }
  },
  { label: "Quotes evaluated", state: demoState },
  {
    label: "Outcome verified",
    state: {
      ...demoState,
      workers: demoState.workers.map((worker) => ({ ...worker, status: "complete" })),
      workItem: { ...demoState.workItem!, status: "Verified complete", waitingOn: undefined, completionVerified: true },
      approval: { ...demoState.approval!, status: "approved" },
      events: [...demoState.events, { id: "e7", timestamp: Date.now() - 1000, workerId: "shu-zhen", type: "outcome_verified", summary: "Tenant verified the repair. Work item closed." }]
    }
  },
  {
    label: "Shu Zhen promoted",
    state: {
      ...demoState,
      workers: demoState.workers.map((worker) => worker.id === "shu-zhen" ? { ...worker, title: "Property Operations Executive", employmentType: "permanent", rank: "permanent", status: "complete" } : { ...worker, status: "complete" }),
      workItem: { ...demoState.workItem!, status: "Verified complete", waitingOn: undefined, completionVerified: true },
      approval: { ...demoState.approval!, status: "approved" },
      events: [...demoState.events, { id: "e7", timestamp: Date.now() - 2000, workerId: "shu-zhen", type: "outcome_verified", summary: "Tenant verified the repair. Work item closed." }, { id: "e8", timestamp: Date.now(), workerId: "alex", type: "employee_promoted", summary: "Business Owner approved Shu Zhen's promotion to permanent employee." }]
    }
  }
];
