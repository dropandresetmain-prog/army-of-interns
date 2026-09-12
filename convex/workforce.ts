import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  analyzeRequiredCapabilities,
  createAssignmentDraft,
  createWorkerSpecFromCapabilities,
  enforcePermissionEnvelope,
  intakeNaturalWorkRequest,
  matchWorkforce,
} from "../src/core/workforce";
import { CONTROLLED_CAPABILITIES } from "../src/core/workforce/capabilityCatalog";
import {
  assignmentDocumentValidator,
  eventDocumentValidator,
  workItemDocumentValidator,
  workerDocumentValidator,
} from "./model/validators";

const staffingResultValidator = v.object({
  workItemId: v.id("workItems"),
  workerId: v.id("workers"),
  assignmentId: v.id("assignments"),
  staffingKind: v.union(v.literal("reuse"), v.literal("create")),
  requiredCapabilityKeys: v.array(v.string()),
  workerCreated: v.boolean(),
  eventIds: v.array(v.id("events")),
});

type KernelEventType =
  | "work_received"
  | "capabilities_identified"
  | "worker_matched"
  | "staffing_requested"
  | "worker_created"
  | "assignment_started";

async function ensureControlledCapabilities(ctx: MutationCtx) {
  const byKey = new Map<string, Id<"capabilities">>();

  for (const definition of CONTROLLED_CAPABILITIES) {
    const existing = await ctx.db
      .query("capabilities")
      .withIndex("by_key", (q) => q.eq("key", definition.key))
      .first();

    if (existing) {
      byKey.set(definition.key, existing._id);
      continue;
    }

    const id = await ctx.db.insert("capabilities", {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      defaultToolPermissionIds: [...definition.defaultToolPermissionIds],
    });
    byKey.set(definition.key, id);
  }

  return byKey;
}

async function resolveManagerWorkerId(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("workers")
    .withIndex("by_name", (q) => q.eq("name", "Alex"))
    .first();
  return existing?._id;
}

async function emitEvent(
  ctx: MutationCtx,
  args: {
    workerId?: Id<"workers">;
    workItemId?: Id<"workItems">;
    eventType: KernelEventType;
    summary: string;
    metadata?: Record<string, string | number | boolean | string[] | null>;
  },
) {
  return await ctx.db.insert("events", {
    timestamp: Date.now(),
    workerId: args.workerId,
    workItemId: args.workItemId,
    eventType: args.eventType,
    summary: args.summary,
    metadata: args.metadata ?? {},
  });
}

type IntakeArgs = {
  text: string;
  requestedByPersonId?: Id<"people">;
  context?: string;
  constraints?: string[];
  successCriteria?: string[];
  workerPresentation?: {
    name: string;
    title?: string;
    seededSuccessfulTasks?: number;
  };
};

export async function persistIntakeAndStaff(ctx: MutationCtx, args: IntakeArgs) {
    const capabilityByKey = await ensureControlledCapabilities(ctx);

    let requesterId = args.requestedByPersonId;
    if (!requesterId) {
      const owner = await ctx.db
        .query("people")
        .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
        .first();
      if (!owner) {
        throw new ConvexError(
          "No requester provided and demo owner is not seeded.",
        );
      }
      requesterId = owner._id;
    } else if (!(await ctx.db.get(requesterId))) {
      throw new ConvexError("requestedByPersonId does not exist.");
    }

    const { workItem: draft } = intakeNaturalWorkRequest({
      text: args.text,
      requestedByPersonId: requesterId,
      context: args.context,
      constraints: args.constraints,
      successCriteria: args.successCriteria,
    });

    const workItemId = await ctx.db.insert("workItems", {
      objective: draft.objective,
      context: draft.context,
      constraints: draft.constraints,
      status: draft.status,
      requestedByPersonId: requesterId,
      requiredCapabilityIds: [],
      successCriteria: draft.successCriteria,
      deadline: draft.deadline,
      budget: draft.budget,
      policyMetadata: draft.policyMetadata,
    });

    const eventIds: Id<"events">[] = [];
    eventIds.push(
      await emitEvent(ctx, {
        workItemId,
        eventType: "work_received",
        summary: `Received work: ${draft.objective}`,
        metadata: { objective: draft.objective },
      }),
    );

    const analysis = analyzeRequiredCapabilities({
      objective: draft.objective,
      context: draft.context,
    });

    if (analysis.unrecognized) {
      throw new ConvexError(
        "No controlled capabilities could be identified for this request.",
      );
    }

    const requiredCapabilityIds = analysis.requiredCapabilityKeys.map((key) => {
      const id = capabilityByKey.get(key);
      if (!id) {
        throw new ConvexError(`Capability ${key} is not seeded.`);
      }
      return id;
    });

    await ctx.db.patch(workItemId, {
      requiredCapabilityIds,
    });

    eventIds.push(
      await emitEvent(ctx, {
        workItemId,
        eventType: "capabilities_identified",
        summary: `Identified capabilities: ${analysis.requiredCapabilityKeys.join(", ")}`,
        metadata: {
          requiredCapabilityKeys: analysis.requiredCapabilityKeys,
          rejectedProposals: analysis.rejectedProposals,
        },
      }),
    );

    const workers = await ctx.db.query("workers").take(200);
    const match = matchWorkforce({
      requiredCapabilityIds,
      workers: workers.map((worker) => ({
        id: worker._id,
        capabilityIds: worker.capabilityIds,
        status: worker.status,
      })),
    });

    let workerId: Id<"workers">;
    let workerCreated = false;
    let staffingKind: "reuse" | "create";

    if (match.outcome === "matched") {
      staffingKind = "reuse";
      workerId = match.workerId as Id<"workers">;
      eventIds.push(
        await emitEvent(ctx, {
          workItemId,
          workerId,
          eventType: "worker_matched",
          summary: "Reused an existing worker for the required capabilities.",
          metadata: {
            workerId,
            matchedCapabilityIds: match.matchedCapabilityIds,
          },
        }),
      );
    } else {
      staffingKind = "create";
      eventIds.push(
        await emitEvent(ctx, {
          workItemId,
          eventType: "staffing_requested",
          summary: "No suitable worker found; staffing a new intern.",
          metadata: {
            missingCapabilityIds: match.missingCapabilityIds,
          },
        }),
      );

      const managerWorkerId = await resolveManagerWorkerId(ctx);
      const spec = createWorkerSpecFromCapabilities({
        requiredCapabilityKeys: analysis.requiredCapabilityKeys,
        managerWorkerId,
        name: args.workerPresentation?.name,
        reasonForCreation: match.reason,
      });

      const permissionCheck = enforcePermissionEnvelope({
        capabilityKeys: analysis.requiredCapabilityKeys,
        requestedPermissionIds: spec.toolPermissionIds,
      });
      if (permissionCheck.rejectedPermissionIds.length > 0) {
        throw new ConvexError(
          `WorkerSpec requested disallowed permissions: ${permissionCheck.rejectedPermissionIds.join(", ")}`,
        );
      }

      // Persist worker identity before any assignment may execute.
      const seededSuccesses = args.workerPresentation?.seededSuccessfulTasks ?? 0;
      workerId = await ctx.db.insert("workers", {
        name: spec.name,
        title: args.workerPresentation?.title ?? spec.title,
        employmentType: spec.employmentType,
        rank: spec.rank,
        managerWorkerId,
        status: "idle",
        capabilityIds: requiredCapabilityIds,
        toolPermissionIds: permissionCheck.allowedPermissionIds,
        personality: spec.personality,
        communicationStyle: spec.communicationStyle,
        standingInstructions: spec.standingInstructions,
        modelConfig: spec.modelPreference,
        tasksCompleted: seededSuccesses,
        successfulTasks: seededSuccesses,
        promotionEligible: false,
      });
      workerCreated = true;

      const persistedWorker = await ctx.db.get(workerId);
      if (!persistedWorker) {
        throw new ConvexError("Worker persistence failed before assignment.");
      }

      eventIds.push(
        await emitEvent(ctx, {
          workItemId,
          workerId,
          eventType: "worker_created",
          summary: `Created worker: ${spec.name} (${spec.title})`,
          metadata: {
            title: spec.title,
            capabilityKeys: analysis.requiredCapabilityKeys,
            toolPermissionIds: permissionCheck.allowedPermissionIds,
            reasonForCreation: spec.reasonForCreation,
          },
        }),
      );
    }

    const assignmentDraft = createAssignmentDraft({
      workItemId,
      workerId,
      responsibility: `Own delivery for capabilities: ${analysis.requiredCapabilityKeys.join(", ")}.`,
    });

    const assignmentId = await ctx.db.insert("assignments", {
      workItemId: assignmentDraft.workItemId as Id<"workItems">,
      workerId: assignmentDraft.workerId as Id<"workers">,
      responsibility: assignmentDraft.responsibility,
      status: assignmentDraft.status,
    });

    await ctx.db.patch(workItemId, { status: "in_progress" });
    await ctx.db.patch(workerId, { status: "working" });

    eventIds.push(
      await emitEvent(ctx, {
        workItemId,
        workerId,
        eventType: "assignment_started",
        summary: "Assignment started for the work item.",
        metadata: {
          assignmentId,
          staffingKind,
          responsibility: assignmentDraft.responsibility,
        },
      }),
    );

    return {
      workItemId,
      workerId,
      assignmentId,
      staffingKind,
      requiredCapabilityKeys: analysis.requiredCapabilityKeys,
      workerCreated,
      eventIds,
    };
}

/**
 * Generic workforce kernel entrypoint:
 * natural request → work item → capabilities → match/create → assignment → events.
 */
export const intakeAndStaff = mutation({
  args: {
    text: v.string(),
    requestedByPersonId: v.optional(v.id("people")),
    context: v.optional(v.string()),
    constraints: v.optional(v.array(v.string())),
    successCriteria: v.optional(v.array(v.string())),
    workerPresentation: v.optional(
      v.object({
        name: v.string(),
        title: v.optional(v.string()),
        seededSuccessfulTasks: v.optional(v.number()),
      }),
    ),
  },
  returns: staffingResultValidator,
  handler: persistIntakeAndStaff,
});

export const getWorkItemDetail = query({
  args: { workItemId: v.id("workItems") },
  returns: v.union(
    v.object({
      workItem: workItemDocumentValidator,
      assignments: v.array(assignmentDocumentValidator),
      events: v.array(eventDocumentValidator),
      workers: v.array(workerDocumentValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const workItem = await ctx.db.get(args.workItemId);
    if (!workItem) {
      return null;
    }

    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_work_item", (q) => q.eq("workItemId", args.workItemId))
      .take(50);

    const events = await ctx.db
      .query("events")
      .withIndex("by_work_item", (q) => q.eq("workItemId", args.workItemId))
      .take(100);

    const workerIds = [
      ...new Set(assignments.map((assignment) => assignment.workerId)),
    ];
    const workers = [];
    for (const workerId of workerIds) {
      const worker = await ctx.db.get(workerId);
      if (worker) {
        workers.push(worker);
      }
    }

    return {
      workItem,
      assignments,
      events: events.sort((a, b) => a.timestamp - b.timestamp),
      workers,
    };
  },
});

/**
 * Generic additional staffing on an existing work item (capability missing mid-flight).
 */
export async function persistStaffCapabilities(
  ctx: MutationCtx,
  args: {
    workItemId: Id<"workItems">;
    capabilityKeys: string[];
    workerPresentation?: { name: string; title?: string };
  },
) {
    const workItem = await ctx.db.get(args.workItemId);
    if (!workItem) {
      throw new ConvexError("Work item not found.");
    }

    const capabilityByKey = await ensureControlledCapabilities(ctx);
    const requiredCapabilityIds = args.capabilityKeys.map((key) => {
      const id = capabilityByKey.get(key);
      if (!id) {
        throw new ConvexError(`Capability ${key} is not seeded.`);
      }
      return id;
    });

    const mergedCapabilityIds = [
      ...new Set([...workItem.requiredCapabilityIds, ...requiredCapabilityIds]),
    ];
    await ctx.db.patch(args.workItemId, {
      requiredCapabilityIds: mergedCapabilityIds,
    });

    const eventIds: Id<"events">[] = [];
    eventIds.push(
      await emitEvent(ctx, {
        workItemId: args.workItemId,
        eventType: "staffing_requested",
        summary: `Staffing requested for: ${args.capabilityKeys.join(", ")}`,
        metadata: { requiredCapabilityKeys: args.capabilityKeys },
      }),
    );

    const workers = await ctx.db.query("workers").take(200);
    const match = matchWorkforce({
      requiredCapabilityIds,
      workers: workers.map((worker) => ({
        id: worker._id,
        capabilityIds: worker.capabilityIds,
        status: worker.status,
      })),
    });

    let workerId: Id<"workers">;
    let workerCreated = false;
    let staffingKind: "reuse" | "create";

    if (match.outcome === "matched") {
      staffingKind = "reuse";
      workerId = match.workerId as Id<"workers">;
      eventIds.push(
        await emitEvent(ctx, {
          workItemId: args.workItemId,
          workerId,
          eventType: "worker_matched",
          summary: "Reused an existing worker for the additional capabilities.",
          metadata: { workerId },
        }),
      );
    } else {
      staffingKind = "create";
      const managerWorkerId = await resolveManagerWorkerId(ctx);
      const spec = createWorkerSpecFromCapabilities({
        requiredCapabilityKeys: args.capabilityKeys,
        managerWorkerId,
        name: args.workerPresentation?.name,
        reasonForCreation: match.reason,
      });
      const permissionCheck = enforcePermissionEnvelope({
        capabilityKeys: args.capabilityKeys,
        requestedPermissionIds: spec.toolPermissionIds,
      });
      if (permissionCheck.rejectedPermissionIds.length > 0) {
        throw new ConvexError(
          `WorkerSpec requested disallowed permissions: ${permissionCheck.rejectedPermissionIds.join(", ")}`,
        );
      }

      workerId = await ctx.db.insert("workers", {
        name: spec.name,
        title: args.workerPresentation?.title ?? spec.title,
        employmentType: spec.employmentType,
        rank: spec.rank,
        managerWorkerId,
        status: "idle",
        capabilityIds: requiredCapabilityIds,
        toolPermissionIds: permissionCheck.allowedPermissionIds,
        personality: spec.personality,
        communicationStyle: spec.communicationStyle,
        standingInstructions: spec.standingInstructions,
        modelConfig: spec.modelPreference,
        tasksCompleted: 0,
        successfulTasks: 0,
        promotionEligible: false,
      });
      workerCreated = true;
      eventIds.push(
        await emitEvent(ctx, {
          workItemId: args.workItemId,
          workerId,
          eventType: "worker_created",
          summary: `Created worker: ${spec.name} (${args.workerPresentation?.title ?? spec.title})`,
          metadata: {
            title: args.workerPresentation?.title ?? spec.title,
            capabilityKeys: args.capabilityKeys,
            toolPermissionIds: permissionCheck.allowedPermissionIds,
          },
        }),
      );
    }

    const assignmentDraft = createAssignmentDraft({
      workItemId: args.workItemId,
      workerId,
      responsibility: `Own delivery for capabilities: ${args.capabilityKeys.join(", ")}.`,
    });
    const assignmentId = await ctx.db.insert("assignments", {
      workItemId: args.workItemId,
      workerId,
      responsibility: assignmentDraft.responsibility,
      status: assignmentDraft.status,
    });
    await ctx.db.patch(workerId, { status: "working" });
    eventIds.push(
      await emitEvent(ctx, {
        workItemId: args.workItemId,
        workerId,
        eventType: "assignment_started",
        summary: "Additional assignment started.",
        metadata: { assignmentId, staffingKind },
      }),
    );

    return {
      workItemId: args.workItemId,
      workerId,
      assignmentId,
      staffingKind,
      requiredCapabilityKeys: args.capabilityKeys,
      workerCreated,
      eventIds,
    };
}

export const staffCapabilities = internalMutation({
  args: {
    workItemId: v.id("workItems"),
    capabilityKeys: v.array(v.string()),
    workerPresentation: v.optional(
      v.object({
        name: v.string(),
        title: v.optional(v.string()),
      }),
    ),
  },
  returns: staffingResultValidator,
  handler: persistStaffCapabilities,
});
