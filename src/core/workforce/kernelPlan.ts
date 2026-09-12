import type { StructuredEventType } from "../domain/vocabulary";
import { analyzeRequiredCapabilities } from "./capabilityAnalysis";
import { createAssignmentDraft, defaultResponsibilityForCapabilities } from "./assignmentFactory";
import { createWorkerSpecFromCapabilities } from "./workerSpecFactory";
import { matchWorkforce, type MatchableWorker } from "./workforceMatcher";
import { intakeNaturalWorkRequest, type NaturalWorkRequest } from "./workIntake";
import {
  enforcePermissionEnvelope,
  mapCapabilitiesToToolPermissions,
} from "./permissionMapping";

export type StaffingDecision =
  | {
      kind: "reuse";
      workerId: string;
      reason: string;
    }
  | {
      kind: "create";
      reason: string;
    };

export interface KernelPlanEvent {
  eventType: StructuredEventType;
  summary: string;
  metadata: Record<string, string | number | boolean | string[] | null>;
}

export interface KernelStaffingPlan {
  workItemDraft: ReturnType<typeof intakeNaturalWorkRequest>["workItem"];
  capabilityAnalysis: ReturnType<typeof analyzeRequiredCapabilities>;
  match: ReturnType<typeof matchWorkforce>;
  staffing: StaffingDecision;
  workerSpec?: ReturnType<typeof createWorkerSpecFromCapabilities>;
  responsibility: string;
  plannedEvents: KernelPlanEvent[];
}

/**
 * Pure planning step for the workforce kernel.
 * Persistence and ID resolution happen in the Convex boundary.
 */
export function planWorkforceStaffing(input: {
  request: NaturalWorkRequest;
  workers: MatchableWorker[];
  /** When matching uses capability document IDs, provide key→id map. */
  capabilityIdByKey?: Record<string, string>;
  managerWorkerId?: string;
}): KernelStaffingPlan {
  const { workItem } = intakeNaturalWorkRequest(input.request);
  const capabilityAnalysis = analyzeRequiredCapabilities({
    objective: workItem.objective,
    context: workItem.context,
  });

  const capabilityIdByKey = input.capabilityIdByKey ?? {};
  const requiredCapabilityIds = capabilityAnalysis.requiredCapabilityKeys.map(
    (key) => capabilityIdByKey[key] ?? key,
  );

  const workItemDraft = {
    ...workItem,
    requiredCapabilityIds,
  };

  const match = matchWorkforce({
    requiredCapabilityIds,
    workers: input.workers,
  });

  const plannedEvents: KernelPlanEvent[] = [
    {
      eventType: "work_received",
      summary: `Received work: ${workItem.objective}`,
      metadata: {
        objective: workItem.objective,
      },
    },
    {
      eventType: "capabilities_identified",
      summary:
        capabilityAnalysis.requiredCapabilityKeys.length > 0
          ? `Identified capabilities: ${capabilityAnalysis.requiredCapabilityKeys.join(", ")}`
          : "No controlled capabilities could be identified.",
      metadata: {
        requiredCapabilityKeys: capabilityAnalysis.requiredCapabilityKeys,
        rejectedProposals: capabilityAnalysis.rejectedProposals,
        unrecognized: capabilityAnalysis.unrecognized,
      },
    },
  ];

  let staffing: StaffingDecision;
  let workerSpec: ReturnType<typeof createWorkerSpecFromCapabilities> | undefined;

  if (match.outcome === "matched") {
    staffing = {
      kind: "reuse",
      workerId: match.workerId,
      reason: match.reason,
    };
    plannedEvents.push({
      eventType: "worker_matched",
      summary: "Reused an existing worker for the required capabilities.",
      metadata: {
        workerId: match.workerId,
        matchedCapabilityIds: match.matchedCapabilityIds,
      },
    });
  } else {
    staffing = {
      kind: "create",
      reason: match.reason,
    };
    plannedEvents.push({
      eventType: "staffing_requested",
      summary: "No suitable worker found; staffing a new intern.",
      metadata: {
        missingCapabilityIds: match.missingCapabilityIds,
      },
    });

    if (capabilityAnalysis.requiredCapabilityKeys.length > 0) {
      workerSpec = createWorkerSpecFromCapabilities({
        requiredCapabilityKeys: capabilityAnalysis.requiredCapabilityKeys,
        managerWorkerId: input.managerWorkerId,
        reasonForCreation: match.reason,
      });
      plannedEvents.push({
        eventType: "worker_created",
        summary: `Created worker spec for role: ${workerSpec.title}`,
        metadata: {
          title: workerSpec.title,
          capabilityKeys: capabilityAnalysis.requiredCapabilityKeys,
          toolPermissionIds: workerSpec.toolPermissionIds,
        },
      });
    }
  }

  const responsibility = defaultResponsibilityForCapabilities(
    capabilityAnalysis.requiredCapabilityKeys,
  );

  plannedEvents.push({
    eventType: "assignment_started",
    summary: "Assignment ready for the work item.",
    metadata: {
      responsibility,
      staffingKind: staffing.kind,
    },
  });

  return {
    workItemDraft,
    capabilityAnalysis,
    match,
    staffing,
    workerSpec,
    responsibility,
    plannedEvents,
  };
}

export {
  analyzeRequiredCapabilities,
  createAssignmentDraft,
  createWorkerSpecFromCapabilities,
  enforcePermissionEnvelope,
  intakeNaturalWorkRequest,
  mapCapabilitiesToToolPermissions,
  matchWorkforce,
};
