import { describe, expect, it } from "vitest";

import type { WorkItem, WorkerSpec } from "./contracts";
import {
  APPROVAL_STATUSES,
  STRUCTURED_EVENT_TYPES,
  WORKER_STATUSES,
  WORK_ITEM_STATUSES,
} from "./vocabulary";

const requesterId = "person_demo_owner";

const maintenanceWork: WorkItem = {
  objective: "The toilet in Room 3 is leaking",
  context: "Reported by the person responsible for the location.",
  constraints: ["Avoid disrupting occupied rooms"],
  status: "open",
  requestedByPersonId: requesterId,
  requiredCapabilityIds: ["capability_maintenance_triage"],
  successCriteria: ["The leak is stopped and the outcome is verified"],
};

const marketingWork: WorkItem = {
  objective: "Prepare our Instagram posts for next week",
  context: "Use the approved brand voice and current campaign themes.",
  constraints: ["Prepare seven posts", "Do not publish without approval"],
  status: "open",
  requestedByPersonId: requesterId,
  requiredCapabilityIds: ["capability_content_marketing"],
  successCriteria: ["Seven review-ready posts are prepared"],
};

describe("shared domain contracts", () => {
  it("represents materially different SME work with the same WorkItem shape", () => {
    expect(Object.keys(maintenanceWork).sort()).toEqual(Object.keys(marketingWork).sort());
    expect(maintenanceWork.objective).toContain("toilet");
    expect(marketingWork.objective).toContain("Instagram");
  });

  it("keeps capabilities and tool permissions as separate worker spec fields", () => {
    const spec: WorkerSpec = {
      name: "Generalist",
      title: "Operations Intern",
      employmentType: "intern",
      rank: "intern",
      capabilityIds: ["capability_vendor_sourcing"],
      toolPermissionIds: ["permission_read_vendor_directory"],
      personality: "Practical",
      communicationStyle: "Concise",
      standingInstructions: ["Escalate authority-sensitive actions"],
      reasonForCreation: "A required capability is not present in the workforce",
    };

    expect(spec.capabilityIds).not.toEqual(spec.toolPermissionIds);
  });

  it("defines stable and duplicate-free shared vocabularies", () => {
    for (const vocabulary of [
      WORKER_STATUSES,
      WORK_ITEM_STATUSES,
      APPROVAL_STATUSES,
      STRUCTURED_EVENT_TYPES,
    ]) {
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
    }
  });

  it("allows structured metadata without imposing a scenario schema", () => {
    maintenanceWork.policyMetadata = {
      evidence: {
        sources: ["requester", "business_record"],
        verified: false,
      },
    };

    expect(maintenanceWork.policyMetadata.evidence).toEqual({
      sources: ["requester", "business_record"],
      verified: false,
    });
  });
});
