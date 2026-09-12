import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { selectPendingApprovalId } from "../src/agents/approvals";
import {
  canReportContractorCompletion,
  canResolveApproval,
  canVerifyOutcome,
} from "../src/agents/authority";
import { normalizeRoleType, resolveSendRole } from "../src/agents/messageTargeting";
import {
  canConfirmContractor,
  DEMO_BUDGET,
  DEMO_OPS_WORKER,
  DEMO_PROCUREMENT_WORKER,
  DEMO_STATE_KEY,
  evaluateContractorOptions,
  extractContractorQuote,
  isPromotionRecommended,
  isReadyToRank,
  PROMOTION_SUCCESS_THRESHOLD,
  quotesNeededToRank,
  SEEDED_OPS_SUCCESSFUL_TASKS,
} from "../src/scenarios/propertyMaintenance";
import { persistIntakeAndStaff, persistStaffCapabilities } from "./workforce";
import { persistBootstrapDemo, resetTransientDemoRecords } from "./seed";

const metadataValue = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.array(v.string()),
  v.null(),
);

async function getOrCreateDemoState(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("demoState")
    .withIndex("by_key", (q) => q.eq("key", DEMO_STATE_KEY))
    .first();
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("demoState", {
    key: DEMO_STATE_KEY,
    phase: "idle",
    metadata: {},
  });
  const created = await ctx.db.get(id);
  if (!created) {
    throw new ConvexError("Failed to create demo state.");
  }
  return created;
}

async function contractors(ctx: MutationCtx) {
  const rows = await ctx.db
    .query("people")
    .withIndex("by_role_type", (q) => q.eq("roleType", "contractor"))
    .take(20);
  return rows
    .filter((person) => person.active && person.telegramChatId)
    .sort((a, b) => (a.demoCallsign ?? "").localeCompare(b.demoCallsign ?? ""));
}

function presentationForKeys(keys: string[]) {
  if (keys.includes("vendor_sourcing")) {
    return {
      name: DEMO_PROCUREMENT_WORKER.name,
      title: DEMO_PROCUREMENT_WORKER.title,
    };
  }
  if (keys.includes("maintenance_triage")) {
    return {
      name: DEMO_OPS_WORKER.name,
      title: DEMO_OPS_WORKER.title,
      seededSuccessfulTasks: SEEDED_OPS_SUCCESSFUL_TASKS,
    };
  }
  return undefined;
}

async function persistNamedCapabilities(
  ctx: MutationCtx,
  workItemId: Id<"workItems">,
  capabilityKeys: string[],
) {
  const staffed = await persistStaffCapabilities(ctx, {
    workItemId,
    capabilityKeys,
    workerPresentation: presentationForKeys(capabilityKeys),
  });
  const worker = await ctx.db.get(staffed.workerId);
  const presentation = presentationForKeys(capabilityKeys);
  if (worker && presentation) {
    await ctx.db.patch(worker._id, {
      name: presentation.name,
      title: presentation.title,
    });
  }
  return staffed;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

async function workerSnapshot(
  ctx: QueryCtx | MutationCtx,
  worker: Doc<"workers">,
) {
  const capabilityKeys: string[] = [];
  for (const capabilityId of worker.capabilityIds) {
    const capability = await ctx.db.get(capabilityId);
    if (capability) {
      capabilityKeys.push(capability.key);
    }
  }
  return {
    id: worker._id,
    name: worker.name,
    title: worker.title,
    rank: worker.rank,
    employmentType: worker.employmentType,
    status: worker.status,
    personality: worker.personality,
    communicationStyle: worker.communicationStyle,
    standingInstructions: worker.standingInstructions,
    toolPermissionIds: worker.toolPermissionIds,
    capabilityKeys,
    successfulTasks: worker.successfulTasks,
    tasksCompleted: worker.tasksCompleted,
    promotionEligible: worker.promotionEligible,
  };
}

const workerSnapshotValidator = v.object({
  id: v.string(),
  name: v.string(),
  title: v.string(),
  rank: v.string(),
  employmentType: v.string(),
  status: v.string(),
  personality: v.string(),
  communicationStyle: v.string(),
  standingInstructions: v.array(v.string()),
  toolPermissionIds: v.array(v.string()),
  capabilityKeys: v.array(v.string()),
  successfulTasks: v.number(),
  tasksCompleted: v.number(),
  promotionEligible: v.boolean(),
});

const snapshotValidator = v.object({
  phase: v.string(),
  companyName: v.optional(v.string()),
  companyDescription: v.optional(v.string()),
  workItem: v.optional(
    v.object({
      id: v.string(),
      objective: v.string(),
      context: v.string(),
      constraints: v.array(v.string()),
      successCriteria: v.array(v.string()),
      status: v.string(),
    }),
  ),
  actor: v.optional(workerSnapshotValidator),
  workers: v.array(workerSnapshotValidator),
  people: v.array(
    v.object({
      id: v.string(),
      displayName: v.string(),
      roleType: v.string(),
      demoCallsign: v.optional(v.string()),
      telegramChatId: v.optional(v.string()),
    }),
  ),
  assignments: v.array(
    v.object({
      workerId: v.string(),
      responsibility: v.string(),
      status: v.string(),
    }),
  ),
  approval: v.optional(
    v.object({
      id: v.string(),
      actionType: v.string(),
      status: v.string(),
      reason: v.string(),
      selectedName: v.optional(v.string()),
      price: v.optional(v.number()),
      availability: v.optional(v.string()),
    }),
  ),
  quotes: v.array(
    v.object({
      personId: v.string(),
      displayName: v.optional(v.string()),
      price: v.optional(v.number()),
      availability: v.optional(v.string()),
      extractStatus: v.string(),
      viable: v.optional(v.boolean()),
      rank: v.optional(v.number()),
    }),
  ),
  recentMessages: v.array(
    v.object({
      direction: v.string(),
      body: v.string(),
      personDisplayName: v.optional(v.string()),
      roleType: v.optional(v.string()),
    }),
  ),
  recentEvents: v.array(
    v.object({
      eventType: v.string(),
      summary: v.string(),
      agentName: v.optional(v.string()),
    }),
  ),
  pendingManagerFollowUp: v.boolean(),
  pendingStaffingCapabilityKeys: v.array(v.string()),
  selectedContractorPersonId: v.optional(v.string()),
  tenantPersonId: v.optional(v.string()),
  joinedContractorCount: v.number(),
  quotesNeeded: v.number(),
});

export const resetProofState = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await resetTransientDemoRecords(ctx);
    await persistBootstrapDemo(ctx);
    const quotes = await ctx.db.query("contractorQuotes").take(200);
    for (const quote of quotes) {
      await ctx.db.delete(quote._id);
    }
    const states = await ctx.db.query("demoState").take(20);
    for (const state of states) {
      await ctx.db.delete(state._id);
    }
    await getOrCreateDemoState(ctx);
    return null;
  },
});

export const ensureDemoTenant = internalMutation({
  args: {},
  returns: v.object({
    personId: v.id("people"),
  }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "TENANT"))
      .first();
    if (existing) {
      return { personId: existing._id };
    }
    const personId = await ctx.db.insert("people", {
      displayName: "Tenant",
      roleType: "tenant",
      demoCallsign: "TENANT",
      active: true,
    });
    return { personId };
  },
});

export const getInboundMessage = internalQuery({
  args: { messageId: v.id("messages") },
  returns: v.union(
    v.object({
      _id: v.id("messages"),
      body: v.string(),
      personId: v.optional(v.id("people")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }
    return {
      _id: message._id,
      body: message.body,
      personId: message.personId,
    };
  },
});

export const loadRuntimeContext = internalQuery({
  args: { actorWorkerId: v.optional(v.id("workers")) },
  returns: snapshotValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("demoState")
      .withIndex("by_key", (q) => q.eq("key", DEMO_STATE_KEY))
      .first();
    const company = await ctx.db.query("companyProfiles").first();
    const people = await ctx.db.query("people").take(50);
    const workers = await ctx.db.query("workers").take(50);
    const workItem = state?.workItemId ? await ctx.db.get(state.workItemId) : null;
    const assignments = state?.workItemId
      ? await ctx.db
          .query("assignments")
          .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
          .take(20)
      : [];
    const approvalId = selectPendingApprovalId({
      phase: state?.phase ?? "idle",
      approvalId: state?.approvalId,
      promotionApprovalId: state?.promotionApprovalId,
    });
    const approval = approvalId ? await ctx.db.get(approvalId as Id<"approvals">) : null;
    const quotes = state?.workItemId
      ? await ctx.db
          .query("contractorQuotes")
          .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
          .take(20)
      : [];
    const messages = await ctx.db.query("messages").withIndex("by_created_at").order("desc").take(8);
    const events = state?.workItemId
      ? await ctx.db
          .query("events")
          .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
          .order("desc")
          .take(8)
      : [];

    const workerRows = [];
    for (const worker of workers) {
      workerRows.push(await workerSnapshot(ctx, worker));
    }
    const actor = args.actorWorkerId
      ? workerRows.find((worker) => worker.id === args.actorWorkerId)
      : workerRows.find((worker) => worker.rank === "manager");

    const recentMessages = [];
    for (const message of [...messages].reverse()) {
      const person = message.personId ? await ctx.db.get(message.personId) : null;
      recentMessages.push({
        direction: message.direction,
        body: message.body.slice(0, 200),
        personDisplayName: person?.displayName,
        roleType: person?.roleType,
      });
    }

    return {
      phase: state?.phase ?? "idle",
      companyName: company?.name,
      companyDescription: company?.businessDescription,
      workItem: workItem
        ? {
            id: workItem._id,
            objective: workItem.objective,
            context: workItem.context,
            constraints: workItem.constraints,
            successCriteria: workItem.successCriteria,
            status: workItem.status,
          }
        : undefined,
      actor,
      workers: workerRows,
      people: people.map((person) => ({
        id: person._id,
        displayName: person.displayName,
        roleType: person.roleType,
        demoCallsign: person.demoCallsign,
        telegramChatId: person.telegramChatId,
      })),
      assignments: assignments.map((assignment) => ({
        workerId: assignment.workerId,
        responsibility: assignment.responsibility,
        status: assignment.status,
      })),
      approval: approval
        ? {
            id: approval._id,
            actionType: approval.actionType,
            status: approval.status,
            reason: approval.reason,
            selectedName:
              typeof approval.payload.selectedName === "string"
                ? approval.payload.selectedName
                : typeof approval.payload.proposedTitle === "string"
                  ? approval.payload.proposedTitle
                  : undefined,
            price:
              typeof approval.payload.price === "number" ? approval.payload.price : undefined,
            availability:
              typeof approval.payload.availability === "string"
                ? approval.payload.availability
                : undefined,
          }
        : undefined,
      quotes: quotes.map((quote) => ({
        personId: quote.personId,
        displayName: people.find((person) => person._id === quote.personId)?.displayName,
        price: quote.price,
        availability: quote.availability,
        extractStatus: quote.extractStatus,
        viable: quote.viable,
        rank: quote.rank,
      })),
      recentMessages,
      recentEvents: [...events].reverse().map((event) => ({
        eventType: event.eventType,
        summary: event.summary,
        agentName:
          typeof event.metadata.agentName === "string" ? event.metadata.agentName : undefined,
      })),
      pendingManagerFollowUp: state?.metadata.pendingManagerFollowUp === true,
      pendingStaffingCapabilityKeys: asStringArray(state?.metadata.pendingStaffingCapabilityKeys),
      selectedContractorPersonId: state?.selectedContractorPersonId,
      tenantPersonId:
        typeof state?.metadata.tenantPersonId === "string"
          ? state.metadata.tenantPersonId
          : undefined,
      joinedContractorCount: people.filter(
        (person) => person.active && person.roleType === "contractor" && person.telegramChatId,
      ).length,
      quotesNeeded: quotesNeededToRank(
        people.filter(
          (person) => person.active && person.roleType === "contractor" && person.telegramChatId,
        ).length,
      ),
    };
  },
});

export const emitAgentEvent = internalMutation({
  args: {
    workerId: v.optional(v.id("workers")),
    workItemId: v.optional(v.id("workItems")),
    eventType: v.string(),
    summary: v.string(),
    metadata: v.optional(v.record(v.string(), metadataValue)),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    return await ctx.db.insert("events", {
      timestamp: Date.now(),
      workerId: args.workerId,
      workItemId: args.workItemId ?? state.workItemId,
      eventType: args.eventType as Doc<"events">["eventType"],
      summary: args.summary,
      metadata: args.metadata ?? {},
    });
  },
});

export const staffWork = internalMutation({
  args: {
    objective: v.string(),
    requestedByPersonId: v.optional(v.id("people")),
    capabilityKeys: v.optional(v.array(v.string())),
  },
  returns: v.object({
    workerId: v.id("workers"),
    workerName: v.string(),
    workItemId: v.id("workItems"),
    assignmentId: v.id("assignments"),
    capabilityKeys: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    const keys = args.capabilityKeys ?? [];
    if (state.workItemId && keys.length > 0) {
      const staffed = await persistNamedCapabilities(ctx, state.workItemId, keys);
      if (keys.includes("vendor_sourcing")) {
        await ctx.db.patch(state._id, {
          procurementWorkerId: staffed.workerId,
          procurementAssignmentId: staffed.assignmentId,
          metadata: {
            ...state.metadata,
            pendingManagerFollowUp: false,
            pendingStaffingCapabilityKeys: [],
          },
        });
      }
      const named = presentationForKeys(keys);
      const staffedWorker = await ctx.db.get(staffed.workerId);
      return {
        workerId: staffed.workerId,
        workerName: named?.name ?? staffedWorker?.name ?? "Worker",
        workItemId: staffed.workItemId,
        assignmentId: staffed.assignmentId,
        capabilityKeys: staffed.requiredCapabilityKeys,
      };
    }

    const tenant =
      (args.requestedByPersonId
        ? await ctx.db.get(args.requestedByPersonId)
        : null) ??
      (await ctx.db
        .query("people")
        .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "TENANT"))
        .first());
    if (!tenant) {
      throw new ConvexError("No tenant is registered to own this work item.");
    }

    const result = await persistIntakeAndStaff(ctx, {
      text: args.objective,
      requestedByPersonId: tenant._id,
      capabilityKeys: keys,
      context: "Telegram tenant report",
      constraints: [`Budget ≤ ${DEMO_BUDGET.currency} ${DEMO_BUDGET.amount}`, "Needed today"],
      workerPresentation: presentationForKeys(["maintenance_triage"]),
    });
    await ctx.db.patch(state._id, {
      phase: "awaiting_tenant_diagnosis",
      workItemId: result.workItemId,
      operationsWorkerId: result.workerId,
      operationsAssignmentId: result.assignmentId,
      metadata: {
        ...state.metadata,
        tenantPersonId: tenant._id,
        pendingManagerFollowUp: false,
      },
    });
    const worker = await ctx.db.get(result.workerId);
    const presentation = presentationForKeys(["maintenance_triage"]);
    if (worker && presentation) {
      await ctx.db.patch(worker._id, {
        name: presentation.name,
        title: presentation.title,
      });
    }
    return {
      workerId: result.workerId,
      workerName: presentation?.name ?? worker?.name ?? DEMO_OPS_WORKER.name,
      workItemId: result.workItemId,
      assignmentId: result.assignmentId,
      capabilityKeys: result.requiredCapabilityKeys,
    };
  },
});

export const requestStaffing = internalMutation({
  args: {
    capabilityKeys: v.array(v.string()),
    reason: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    const pendingMetadata = {
      ...state.metadata,
      pendingManagerFollowUp: true,
      pendingStaffingCapabilityKeys: args.capabilityKeys,
      staffingReason: args.reason,
    };
    // Staff Daniel immediately so the board does not wait on the manager LLM.
    if (state.workItemId && args.capabilityKeys.includes("vendor_sourcing")) {
      const staffed = await persistNamedCapabilities(
        ctx,
        state.workItemId,
        args.capabilityKeys,
      );
      await ctx.db.patch(state._id, {
        procurementWorkerId: staffed.workerId,
        procurementAssignmentId: staffed.assignmentId,
        metadata: {
          ...pendingMetadata,
          pendingManagerFollowUp: false,
          pendingStaffingCapabilityKeys: [],
        },
      });
      return { ok: true };
    }
    await ctx.db.patch(state._id, { metadata: pendingMetadata });
    return { ok: true };
  },
});

export const consumeManagerFollowUp = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const state = await getOrCreateDemoState(ctx);
    await ctx.db.patch(state._id, {
      metadata: {
        ...state.metadata,
        pendingManagerFollowUp: false,
      },
    });
    return null;
  },
});

export const sendIntent = internalMutation({
  args: {
    personId: v.optional(v.id("people")),
    roleType: v.optional(v.string()),
    demoCallsign: v.optional(v.string()),
    body: v.string(),
    agentKind: v.optional(
      v.union(v.literal("manager"), v.literal("operations"), v.literal("procurement")),
    ),
    inboundPersonId: v.optional(v.id("people")),
  },
  returns: v.object({
    personId: v.optional(v.id("people")),
    chatId: v.optional(v.string()),
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    const inbound = args.inboundPersonId ? await ctx.db.get(args.inboundPersonId) : null;
    const requestedPerson = args.personId ? await ctx.db.get(args.personId) : null;
    const resolved = resolveSendRole({
      kind: args.agentKind ?? "manager",
      phase: state.phase,
      requestedRoleType: requestedPerson?.roleType ?? args.roleType,
      inboundRoleType: inbound?.roleType,
    });
    if ("error" in resolved) {
      return { body: args.body };
    }

    const roleType = resolved.roleType;
    let person =
      requestedPerson && normalizeRoleType(requestedPerson.roleType) === roleType
        ? requestedPerson
        : null;

    if (!person && args.demoCallsign) {
      person = await ctx.db
        .query("people")
        .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", args.demoCallsign!))
        .first();
    }
    if (
      !person &&
      inbound &&
      normalizeRoleType(inbound.roleType) === roleType
    ) {
      person = inbound;
    }
    if (!person && roleType === "contractor") {
      if (state.selectedContractorPersonId) {
        person = await ctx.db.get(state.selectedContractorPersonId);
      }
    }
    if (!person && roleType === "tenant") {
      if (typeof state.metadata.tenantPersonId === "string") {
        person = await ctx.db.get(state.metadata.tenantPersonId as Id<"people">);
      }
    }
    if (!person && roleType === "business_owner") {
      person = await ctx.db
        .query("people")
        .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
        .first();
    }
    if (!person) {
      person =
        (await ctx.db
          .query("people")
          .withIndex("by_role_type", (q) => q.eq("roleType", roleType))
          .first()) ?? null;
    }
    if (!person || normalizeRoleType(person.roleType) !== roleType) {
      return { body: args.body };
    }
    return {
      personId: person._id,
      chatId: person.telegramChatId,
      body: args.body,
    };
  },
});

export const solicitOptions = internalMutation({
  args: { body: v.string() },
  returns: v.array(
    v.object({
      personId: v.id("people"),
      chatId: v.string(),
      body: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    const vendorPeople = await contractors(ctx);
    if (vendorPeople.length === 0) {
      return [];
    }
    const { recommendationReportedAt: _closedRound, ...roundMetadata } = state.metadata;
    await ctx.db.patch(state._id, {
      phase: "soliciting_quotes",
      metadata: roundMetadata,
    });
    return vendorPeople
      .filter((person) => person.telegramChatId)
      .map((person) => ({
        personId: person._id,
        chatId: person.telegramChatId!,
        body: args.body,
      }));
  },
});

export const recordOption = internalMutation({
  args: {
    personId: v.optional(v.id("people")),
    price: v.optional(v.union(v.number(), v.null())),
    availability: v.optional(v.union(v.string(), v.null())),
    rawMessage: v.string(),
    chatId: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    needClarification: v.boolean(),
    recordedCount: v.number(),
    quotesNeeded: v.number(),
    readyToEvaluate: v.boolean(),
    personId: v.optional(v.id("people")),
  }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    if (!state.workItemId) {
      throw new ConvexError("No active work item for quotes.");
    }
    const existingQuotes = await ctx.db
      .query("contractorQuotes")
      .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
      .take(20);
    const vendorPeople = await contractors(ctx);
    let personId = args.personId;
    const unanswered = vendorPeople.find(
      (person) => !existingQuotes.some((row) => row.personId === person._id && row.extractStatus === "ok"),
    );
    if (!personId) {
      personId = unanswered?._id;
    }
    if (!personId) {
      throw new ConvexError("Could not correlate that contractor reply.");
    }

    const fallback = extractContractorQuote(args.rawMessage);
    const price = args.price ?? fallback.price;
    const availability = args.availability ?? fallback.availability;
    const extractStatus = price !== null ? ("ok" as const) : ("failed" as const);

    const previous = existingQuotes.find((row) => row.personId === personId);
    if (previous) {
      await ctx.db.patch(previous._id, {
        rawMessage: args.rawMessage,
        price: price ?? undefined,
        availability: availability ?? undefined,
        extractStatus,
      });
    } else {
      await ctx.db.insert("contractorQuotes", {
        workItemId: state.workItemId,
        personId,
        rawMessage: args.rawMessage,
        price: price ?? undefined,
        availability: availability ?? undefined,
        extractStatus,
      });
    }

    const refreshed = await ctx.db
      .query("contractorQuotes")
      .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
      .take(20);
    const recordedCount = refreshed.filter((row) => row.extractStatus === "ok").length;
    const quotesNeeded = quotesNeededToRank(vendorPeople.length);
    return {
      ok: extractStatus === "ok",
      needClarification: extractStatus === "failed",
      recordedCount,
      quotesNeeded,
      readyToEvaluate:
        !state.metadata.recommendationReportedAt &&
        isReadyToRank({
          joinedContractors: vendorPeople.length,
          recordedQuotes: recordedCount,
        }),
      personId,
    };
  },
});

export const evaluateOptions = internalMutation({
  args: {},
  returns: v.object({
    winnerPersonId: v.union(v.string(), v.null()),
    ranked: v.array(
      v.object({
        personId: v.string(),
        price: v.union(v.number(), v.null()),
        availability: v.union(v.string(), v.null()),
        viable: v.boolean(),
        rank: v.union(v.number(), v.null()),
        rejectedReason: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const state = await getOrCreateDemoState(ctx);
    if (!state.workItemId) {
      throw new ConvexError("No active work item for evaluation.");
    }
    const quotes = await ctx.db
      .query("contractorQuotes")
      .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
      .take(20);
    const vendorPeople = await contractors(ctx);
    const okQuotes = quotes.filter((row) => row.extractStatus === "ok");
    if (okQuotes.length === 0) {
      return { winnerPersonId: null, ranked: [] };
    }
    const ranked = evaluateContractorOptions(
      okQuotes.map((row) => ({
        personId: row.personId,
        callsign: vendorPeople.find((person) => person._id === row.personId)?.demoCallsign,
        price: row.price ?? null,
        availability: row.availability ?? null,
        rawMessage: row.rawMessage,
      })),
    );
    for (const item of ranked.ranked) {
      const row = quotes.find((quote) => quote.personId === item.personId);
      if (row) {
        await ctx.db.patch(row._id, {
          meetsDeadline: item.meetsDeadline,
          withinBudget: item.withinBudget,
          viable: item.viable,
          rank: item.rank ?? undefined,
          rejectedReason: item.rejectedReason,
        });
      }
    }
    await ctx.db.patch(state._id, {
      selectedContractorPersonId: ranked.winnerPersonId
        ? (ranked.winnerPersonId as Id<"people">)
        : undefined,
      metadata: {
        ...state.metadata,
        recommendationReady: true,
      },
    });
    return {
      winnerPersonId: ranked.winnerPersonId,
      ranked: ranked.ranked.map((item) => ({
        personId: item.personId,
        price: item.price,
        availability: item.availability,
        viable: item.viable,
        rank: item.rank,
        rejectedReason: item.rejectedReason,
      })),
    };
  },
});

export const reportRecommendation = internalMutation({
  args: { summary: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    // One recommendation per sourcing round. record_option reports automatically once every
    // joined contractor has quoted, so a later agent-initiated report_recommendation must not
    // re-arm the manager follow-up or the owner receives a second approval for the same work.
    if (state.metadata.recommendationReportedAt) {
      return { ok: true };
    }
    await ctx.db.patch(state._id, {
      metadata: {
        ...state.metadata,
        pendingManagerFollowUp: true,
        recommendationSummary: args.summary,
        recommendationReportedAt: Date.now(),
      },
    });
    return { ok: true };
  },
});

export const requestApproval = internalMutation({
  args: { reason: v.string() },
  returns: v.object({ approvalId: v.id("approvals") }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    if (!state.workItemId) {
      throw new ConvexError("No work item for approval.");
    }
    const owner = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
      .first();
    if (!owner) {
      throw new ConvexError("Business owner is not registered.");
    }
    const selectedId = state.selectedContractorPersonId;
    const selected = selectedId ? await ctx.db.get(selectedId) : null;
    const quotes = await ctx.db
      .query("contractorQuotes")
      .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
      .take(20);
    const winner = quotes.find((row) => row.personId === selectedId && row.viable);
    if (!selectedId || !winner) {
      throw new ConvexError("No viable ranked contractor is ready for approval.");
    }
    const existingApprovals = await ctx.db
      .query("approvals")
      .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
      .collect();
    const alreadyPending = existingApprovals.find(
      (row) => row.status === "pending" && row.actionType === "confirm_contractor_spend",
    );
    if (alreadyPending) {
      return { approvalId: alreadyPending._id };
    }
    const approvalId = await ctx.db.insert("approvals", {
      workItemId: state.workItemId,
      requestedFromPersonId: owner._id,
      proposedByWorkerId: state.procurementWorkerId ?? state.operationsWorkerId!,
      actionType: "confirm_contractor_spend",
      reason: args.reason,
      riskClass: "high",
      amount: winner?.price
        ? { value: winner.price, currency: DEMO_BUDGET.currency }
        : undefined,
      payload: {
        selectedPersonId: selectedId ?? null,
        selectedName: selected?.displayName ?? "Contractor",
        price: winner?.price ?? null,
        availability: winner?.availability ?? null,
      },
      status: "pending",
      requestedAt: Date.now(),
    });
    await ctx.db.patch(state.workItemId, { status: "awaiting_approval" });
    await ctx.db.patch(state._id, {
      phase: "awaiting_owner_approval",
      approvalId,
      metadata: { ...state.metadata, pendingManagerFollowUp: false },
    });
    return { approvalId };
  },
});

export const resolveApproval = internalMutation({
  args: {
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    actorPersonId: v.optional(v.id("people")),
  },
  returns: v.object({
    status: v.string(),
    confirmed: v.boolean(),
    selectedPersonId: v.optional(v.id("people")),
    tenantPersonId: v.optional(v.id("people")),
  }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    const actor = args.actorPersonId ? await ctx.db.get(args.actorPersonId) : null;
    const owner = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
      .first();
    if (
      !canResolveApproval({
        actorPersonId: actor?._id,
        actorRoleType: actor?.roleType,
        ownerPersonId: owner?._id,
      })
    ) {
      throw new ConvexError("Only the registered Business Owner can resolve this approval.");
    }

    const approvalId = selectPendingApprovalId({
      phase: state.phase,
      approvalId: state.approvalId,
      promotionApprovalId: state.promotionApprovalId,
    });
    if (!approvalId) {
      throw new ConvexError("There is no pending approval.");
    }
    const approval = await ctx.db.get(approvalId as Id<"approvals">);
    if (!approval || approval.status !== "pending") {
      throw new ConvexError("That approval is no longer pending.");
    }

    if (approval.actionType === "promote_worker") {
      await ctx.db.patch(approval._id, { status: args.decision, resolvedAt: Date.now() });
      if (args.decision === "approved" && state.operationsWorkerId) {
        await ctx.db.patch(state.operationsWorkerId, {
          title: DEMO_OPS_WORKER.promotedTitle,
          employmentType: DEMO_OPS_WORKER.employmentTypeOnPromote,
          rank: "employee",
          promotionEligible: false,
        });
        await ctx.db.insert("events", {
          timestamp: Date.now(),
          workerId: state.operationsWorkerId,
          workItemId: state.workItemId,
          eventType: "worker_promoted",
          summary: `${DEMO_OPS_WORKER.name} is now ${DEMO_OPS_WORKER.promotedTitle} (permanent).`,
          metadata: { title: DEMO_OPS_WORKER.promotedTitle, employmentType: "permanent" },
        });
      }
      await ctx.db.patch(state._id, { phase: "completed" });
      return { status: args.decision, confirmed: false };
    }

    if (args.decision === "rejected") {
      await ctx.db.patch(approval._id, { status: "rejected", resolvedAt: Date.now() });
      if (state.workItemId) {
        await ctx.db.patch(state.workItemId, { status: "blocked" });
      }
      await ctx.db.patch(state._id, { phase: "rejected_resourcing" });
      return { status: "rejected", confirmed: false };
    }

    await ctx.db.patch(approval._id, { status: "approved", resolvedAt: Date.now() });
    const refreshed = await ctx.db.get(approval._id);
    if (!refreshed || !canConfirmContractor(refreshed.status)) {
      throw new ConvexError("Contractor confirmation blocked: approval is not approved.");
    }
    if (state.workItemId) {
      await ctx.db.patch(state.workItemId, { status: "in_progress" });
    }
    await ctx.db.patch(state._id, { phase: "awaiting_contractor_done" });
    const tenantId =
      typeof state.metadata.tenantPersonId === "string"
        ? (state.metadata.tenantPersonId as Id<"people">)
        : undefined;
    return {
      status: "approved",
      confirmed: true,
      selectedPersonId: state.selectedContractorPersonId,
      tenantPersonId: tenantId,
    };
  },
});

export const verifyOutcome = internalMutation({
  args: {
    confirmed: v.boolean(),
    notes: v.string(),
    actorPersonId: v.optional(v.id("people")),
  },
  returns: v.object({
    completed: v.boolean(),
    promotionEligible: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    const actor = args.actorPersonId ? await ctx.db.get(args.actorPersonId) : null;
    const tenantId =
      typeof state.metadata.tenantPersonId === "string"
        ? (state.metadata.tenantPersonId as Id<"people">)
        : undefined;
    if (
      !canVerifyOutcome({
        actorPersonId: actor?._id,
        actorRoleType: actor?.roleType,
        tenantPersonId: tenantId,
      })
    ) {
      throw new ConvexError("Only the registered Tenant can verify this outcome.");
    }
    if (state.phase !== "awaiting_tenant_verification" || !state.workItemId) {
      throw new ConvexError("Nothing is waiting on tenant verification.");
    }
    const workItem = await ctx.db.get(state.workItemId);
    if (!workItem || workItem.status !== "verifying") {
      throw new ConvexError("Work cannot close before it is in verification.");
    }
    if (!args.confirmed) {
      await ctx.db.insert("events", {
        timestamp: Date.now(),
        workerId: state.operationsWorkerId,
        workItemId: state.workItemId,
        eventType: "work_verified",
        summary: "Tenant reported the outcome is not fixed.",
        metadata: { confirmed: false, notes: args.notes.slice(0, 240) },
      });
      await ctx.db.patch(state.workItemId, { status: "in_progress" });
      await ctx.db.patch(state._id, { phase: "awaiting_contractor_done" });
      return { completed: false, promotionEligible: false };
    }

    await ctx.db.insert("events", {
      timestamp: Date.now(),
      workerId: state.operationsWorkerId,
      workItemId: state.workItemId,
      eventType: "work_verified",
      summary: "Tenant verified the repair outcome.",
      metadata: { confirmed: true, notes: args.notes.slice(0, 240) },
    });

    await ctx.db.patch(state.workItemId, { status: "completed" });
    if (state.operationsAssignmentId) {
      await ctx.db.patch(state.operationsAssignmentId, { status: "completed" });
    }
    if (state.procurementAssignmentId) {
      await ctx.db.patch(state.procurementAssignmentId, { status: "completed" });
    }

    let promotionEligible = false;
    if (state.operationsWorkerId) {
      const worker = await ctx.db.get(state.operationsWorkerId);
      if (worker) {
        const successfulTasks = worker.successfulTasks + 1;
        promotionEligible =
          worker.employmentType !== "permanent" &&
          isPromotionRecommended(successfulTasks, PROMOTION_SUCCESS_THRESHOLD);
        await ctx.db.patch(worker._id, {
          successfulTasks,
          tasksCompleted: worker.tasksCompleted + 1,
          promotionEligible,
          status: "idle",
        });
      }
    }
    if (state.procurementWorkerId) {
      await ctx.db.patch(state.procurementWorkerId, { status: "idle" });
    }
    await ctx.db.insert("events", {
      timestamp: Date.now(),
      workerId: state.operationsWorkerId,
      workItemId: state.workItemId,
      eventType: "work_completed",
      summary: "Work item completed after tenant verification.",
      metadata: { promotionEligible },
    });
    await ctx.db.patch(state._id, {
      phase: promotionEligible ? "awaiting_promotion" : "completed",
      metadata: {
        ...state.metadata,
        pendingManagerFollowUp: promotionEligible,
      },
    });
    return { completed: true, promotionEligible };
  },
});

export const updateWorkContext = internalMutation({
  args: {
    phase: v.optional(v.string()),
    notes: v.optional(v.string()),
    actorPersonId: v.optional(v.id("people")),
  },
  returns: v.object({ phase: v.string() }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    if (args.phase === "awaiting_tenant_verification") {
      const actor = args.actorPersonId ? await ctx.db.get(args.actorPersonId) : null;
      if (
        !canReportContractorCompletion({
          actorPersonId: actor?._id,
          selectedContractorPersonId: state.selectedContractorPersonId,
        })
      ) {
        throw new ConvexError("Only the selected Contractor can report job completion.");
      }
      if (state.phase !== "awaiting_contractor_done") {
        throw new ConvexError("Work is not waiting on contractor completion.");
      }
      if (state.workItemId) {
        await ctx.db.patch(state.workItemId, { status: "verifying" });
      }
      await ctx.db.patch(state._id, { phase: "awaiting_tenant_verification" });
      return { phase: "awaiting_tenant_verification" };
    }
    if (args.notes && state.workItemId) {
      const workItem = await ctx.db.get(state.workItemId);
      if (workItem) {
        await ctx.db.patch(state.workItemId, {
          context: `${workItem.context}\n${args.notes}`.slice(0, 2000),
        });
      }
    }
    return { phase: state.phase };
  },
});

export const recommendPromotion = internalMutation({
  args: {},
  returns: v.object({
    approvalId: v.optional(v.id("approvals")),
    eligible: v.boolean(),
  }),
  handler: async (ctx) => {
    const state = await getOrCreateDemoState(ctx);
    if (!state.operationsWorkerId || !state.workItemId) {
      return { eligible: false };
    }
    const worker = await ctx.db.get(state.operationsWorkerId);
    if (
      !worker ||
      worker.employmentType === "permanent" ||
      !isPromotionRecommended(worker.successfulTasks, PROMOTION_SUCCESS_THRESHOLD)
    ) {
      return { eligible: false };
    }
    const owner = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
      .first();
    if (!owner) {
      return { eligible: true };
    }
    if (state.promotionApprovalId) {
      const existing = await ctx.db.get(state.promotionApprovalId);
      if (existing && existing.status === "pending") {
        await ctx.db.patch(state._id, { phase: "awaiting_promotion" });
        return { approvalId: existing._id, eligible: true };
      }
    }
    const approvalId = await ctx.db.insert("approvals", {
      workItemId: state.workItemId,
      requestedFromPersonId: owner._id,
      proposedByWorkerId: worker._id,
      actionType: "promote_worker",
      reason: `${worker.name} now has ${worker.successfulTasks} successful operations assignments.`,
      riskClass: "medium",
      payload: { workerId: worker._id, proposedTitle: DEMO_OPS_WORKER.promotedTitle },
      status: "pending",
      requestedAt: Date.now(),
    });
    await ctx.db.patch(state._id, {
      phase: "awaiting_promotion",
      promotionApprovalId: approvalId,
    });
    return { approvalId, eligible: true };
  },
});
