import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  analyzeRequiredCapabilities,
  createAssignmentDraft,
  createWorkerSpecFromCapabilities,
  enforcePermissionEnvelope,
  intakeNaturalWorkRequest,
  mapCapabilitiesToToolPermissions,
  matchWorkforce,
  planWorkforceStaffing,
} from "./index";

const OWNER_ID = "person_owner";

describe("work intake", () => {
  it("turns a natural request into a valid generic work item", () => {
    const { workItem } = intakeNaturalWorkRequest({
      text: "  The toilet in Room 3 is leaking.  ",
      requestedByPersonId: OWNER_ID,
      constraints: ["Minimize downtime"],
    });

    expect(workItem.objective).toBe("The toilet in Room 3 is leaking.");
    expect(workItem.status).toBe("open");
    expect(workItem.requestedByPersonId).toBe(OWNER_ID);
    expect(workItem.requiredCapabilityIds).toEqual([]);
    expect(workItem.constraints).toEqual(["Minimize downtime"]);
    expect(workItem.successCriteria.length).toBeGreaterThan(0);
    expect(workItem).not.toHaveProperty("tenantId");
    expect(workItem).not.toHaveProperty("contractorId");
  });
});

describe("capability analysis", () => {
  it("maps maintenance-shaped and marketing-shaped requests to controlled keys", () => {
    const maintenance = analyzeRequiredCapabilities({
      objective: "The toilet in Room 3 is leaking.",
    });
    expect(maintenance.requiredCapabilityKeys).toEqual([
      "maintenance_triage",
      "stakeholder_messaging",
    ]);
    expect(maintenance.unrecognized).toBe(false);

    const marketing = analyzeRequiredCapabilities({
      objective: "Prepare our Instagram posts for next week.",
    });
    expect(marketing.requiredCapabilityKeys).toEqual(["content_marketing"]);
    expect(marketing.unrecognized).toBe(false);
  });

  it("rejects unknown proposed capability keys explicitly", () => {
    const result = analyzeRequiredCapabilities({
      objective: "Handle the invoice backlog",
      proposedCapabilityKeys: ["bookkeeping", "magic_plumber_power"],
    });

    expect(result.acceptedProposals).toEqual(["bookkeeping"]);
    expect(result.rejectedProposals).toEqual(["magic_plumber_power"]);
    expect(result.requiredCapabilityKeys).toContain("bookkeeping");
    expect(result.requiredCapabilityKeys).not.toContain("magic_plumber_power");
  });
});

describe("workforce matching and reuse", () => {
  it("selects a suitable existing worker by capability coverage", () => {
    const match = matchWorkforce({
      requiredCapabilityIds: ["cap_maintenance", "cap_messaging"],
      workers: [
        {
          id: "w_alex",
          name: "Alex",
          status: "idle",
          capabilityIds: [],
        },
        {
          id: "w_ops",
          name: "ShouldNotMatter",
          status: "idle",
          capabilityIds: ["cap_maintenance", "cap_messaging", "cap_extra"],
        },
      ],
    });

    expect(match.outcome).toBe("matched");
    if (match.outcome === "matched") {
      expect(match.workerId).toBe("w_ops");
    }
  });

  it("reuses the same worker for a second same-capability task", () => {
    const workers = [
      {
        id: "w_ops",
        status: "idle" as const,
        capabilityIds: ["cap_maintenance", "cap_messaging"],
      },
    ];

    const first = matchWorkforce({
      requiredCapabilityIds: ["cap_maintenance", "cap_messaging"],
      workers,
    });
    const second = matchWorkforce({
      requiredCapabilityIds: ["cap_maintenance", "cap_messaging"],
      workers,
    });

    expect(first.outcome).toBe("matched");
    expect(second.outcome).toBe("matched");
    if (first.outcome === "matched" && second.outcome === "matched") {
      expect(second.workerId).toBe(first.workerId);
    }
  });

  it("returns no_match when capability coverage is missing", () => {
    const match = matchWorkforce({
      requiredCapabilityIds: ["cap_content"],
      workers: [
        {
          id: "w_ops",
          status: "idle",
          capabilityIds: ["cap_maintenance"],
        },
      ],
    });

    expect(match).toEqual({
      outcome: "no_match",
      missingCapabilityIds: ["cap_content"],
      reason: "No assignable worker covers the required capability set.",
    });
  });
});

describe("WorkerSpec and permissions", () => {
  it("builds a valid WorkerSpec on the no-match path", () => {
    const spec = createWorkerSpecFromCapabilities({
      requiredCapabilityKeys: ["content_marketing"],
      managerWorkerId: "w_manager",
      reasonForCreation: "No marketing worker available.",
    });

    expect(spec.employmentType).toBe("intern");
    expect(spec.rank).toBe("intern");
    expect(spec.title).toBe("Marketing Intern");
    expect(spec.capabilityIds).toEqual(["content_marketing"]);
    expect(spec.toolPermissionIds.length).toBeGreaterThan(0);
    expect(spec.reasonForCreation).toContain("No marketing worker");
    expect(spec.managerWorkerId).toBe("w_manager");
  });

  it("maps capabilities to permissions and rejects out-of-envelope grants", () => {
    const allowed = mapCapabilitiesToToolPermissions(["content_marketing"]);
    expect(allowed).toContain("permission_read_business_record");
    expect(allowed).not.toContain("permission_solicit_options");

    const enforced = enforcePermissionEnvelope({
      capabilityKeys: ["content_marketing"],
      requestedPermissionIds: [
        "permission_read_business_record",
        "permission_solicit_options",
        "permission_invented_by_model",
      ],
    });

    expect(enforced.allowedPermissionIds).toEqual([
      "permission_read_business_record",
    ]);
    expect(enforced.rejectedPermissionIds).toEqual([
      "permission_invented_by_model",
      "permission_solicit_options",
    ]);
  });
});

describe("assignment and kernel plan events", () => {
  it("creates a generic assignment and preserves worker-before-assignment intent", () => {
    const assignment = createAssignmentDraft({
      workItemId: "wi_1",
      workerId: "w_1",
      responsibility: "Own delivery for capabilities: content_marketing.",
    });

    expect(assignment.status).toBe("active");
    expect(assignment.workItemId).toBe("wi_1");
    expect(assignment.workerId).toBe("w_1");
  });

  it("emits the expected lifecycle events for create and reuse paths", () => {
    const createPlan = planWorkforceStaffing({
      request: {
        text: "Prepare our Instagram posts for next week.",
        requestedByPersonId: OWNER_ID,
      },
      workers: [],
      managerWorkerId: "w_manager",
    });

    expect(createPlan.staffing.kind).toBe("create");
    expect(createPlan.workerSpec?.title).toBe("Marketing Intern");
    expect(createPlan.plannedEvents.map((event) => event.eventType)).toEqual([
      "work_received",
      "capabilities_identified",
      "staffing_requested",
      "worker_created",
      "assignment_started",
    ]);

    const reusePlan = planWorkforceStaffing({
      request: {
        text: "Prepare our Instagram posts for next week.",
        requestedByPersonId: OWNER_ID,
      },
      workers: [
        {
          id: "w_marketing",
          status: "idle",
          capabilityIds: ["content_marketing"],
        },
      ],
      capabilityIdByKey: { content_marketing: "content_marketing" },
    });

    expect(reusePlan.staffing.kind).toBe("reuse");
    expect(reusePlan.plannedEvents.map((event) => event.eventType)).toEqual([
      "work_received",
      "capabilities_identified",
      "worker_matched",
      "assignment_started",
    ]);
  });

  it("runs maintenance and marketing smoke cases through the same planner", () => {
    const maintenance = planWorkforceStaffing({
      request: {
        text: "The toilet in Room 3 is leaking.",
        requestedByPersonId: OWNER_ID,
      },
      workers: [],
    });
    const marketing = planWorkforceStaffing({
      request: {
        text: "Prepare our Instagram posts for next week.",
        requestedByPersonId: OWNER_ID,
      },
      workers: [],
    });

    expect(Object.keys(maintenance).sort()).toEqual(Object.keys(marketing).sort());
    expect(maintenance.capabilityAnalysis.requiredCapabilityKeys).toContain(
      "maintenance_triage",
    );
    expect(marketing.capabilityAnalysis.requiredCapabilityKeys).toEqual([
      "content_marketing",
    ]);
    expect(maintenance.workerSpec?.title).toBe("Operations Intern");
    expect(marketing.workerSpec?.title).toBe("Marketing Intern");
  });
});

describe("scenario independence", () => {
  it("keeps core workforce modules free of scenario-specific concepts", () => {
    const root = join(process.cwd(), "src", "core", "workforce");
    const forbidden =
      /\b(Tenant|Contractor|plumber|quote|Shu Zhen|Kai|shu.?zhen)\b/i;
    const files: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walk(path);
        } else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) {
          files.push(path);
        }
      }
    }

    walk(root);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(forbidden);
    }
  });
});
