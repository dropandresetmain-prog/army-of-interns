import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  canConfirmContractor,
  DEMO_BUDGET,
  DEMO_OPS_WORKER,
  DEMO_PROCUREMENT_WORKER,
  DEMO_STATE_KEY,
  evaluateContractorOptions,
  extractContractorQuote,
  isPromotionRecommended,
  PROMOTION_SUCCESS_THRESHOLD,
  SEEDED_OPS_SUCCESSFUL_TASKS,
} from "../src/scenarios/propertyMaintenance";
import { persistIntakeAndStaff, persistStaffCapabilities } from "./workforce";
import { resetTransientDemoRecords } from "./seed";

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
});

export const resetProofState = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await resetTransientDemoRecords(ctx);
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
    const approval = state?.approvalId ? await ctx.db.get(state.approvalId) : null;
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
      const staffed = await persistStaffCapabilities(ctx, {
        workItemId: state.workItemId,
        capabilityKeys: keys,
        workerPresentation: presentationForKeys(keys),
      });
      const worker = await ctx.db.get(staffed.workerId);
      const presentation = presentationForKeys(keys);
      if (worker && presentation) {
        await ctx.db.patch(worker._id, {
          name: presentation.name,
          title: presentation.title,
        });
      }
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
      return {
        workerId: staffed.workerId,
        workerName: presentation?.name ?? worker?.name ?? "Worker",
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
    await ctx.db.patch(state._id, {
      metadata: {
        ...state.metadata,
        pendingManagerFollowUp: true,
        pendingStaffingCapabilityKeys: args.capabilityKeys,
        staffingReason: args.reason,
      },
    });
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
  },
  returns: v.object({
    personId: v.optional(v.id("people")),
    chatId: v.optional(v.string()),
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    let person = args.personId ? await ctx.db.get(args.personId) : null;
    if (!person && args.demoCallsign) {
      person = await ctx.db
        .query("people")
        .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", args.demoCallsign!))
        .first();
    }
    if (!person && args.roleType) {
      person =
        (await ctx.db
          .query("people")
          .withIndex("by_role_type", (q) => q.eq("roleType", args.roleType!))
          .first()) ?? null;
    }
    if (!person) {
      throw new ConvexError("No matching stakeholder to message.");
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
    await ctx.db.patch(state._id, { phase: "soliciting_quotes" });
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
    return {
      ok: extractStatus === "ok",
      needClarification: extractStatus === "failed",
      recordedCount: refreshed.filter((row) => row.extractStatus === "ok").length,
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
    await ctx.db.patch(state._id, {
      metadata: {
        ...state.metadata,
        pendingManagerFollowUp: true,
        recommendationSummary: args.summary,
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
  args: { decision: v.union(v.literal("approved"), v.literal("rejected")) },
  returns: v.object({
    status: v.string(),
    confirmed: v.boolean(),
    selectedPersonId: v.optional(v.id("people")),
    tenantPersonId: v.optional(v.id("people")),
  }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    const approvalId = state.approvalId ?? state.promotionApprovalId;
    if (!approvalId) {
      throw new ConvexError("There is no pending approval.");
    }
    const approval = await ctx.db.get(approvalId);
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
  },
  returns: v.object({
    completed: v.boolean(),
    promotionEligible: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    if (state.phase !== "awaiting_tenant_verification" || !state.workItemId) {
      throw new ConvexError("Nothing is waiting on tenant verification.");
    }
    const workItem = await ctx.db.get(state.workItemId);
    if (!workItem || workItem.status !== "verifying") {
      throw new ConvexError("Work cannot close before it is in verification.");
    }
    if (!args.confirmed) {
      await ctx.db.patch(state.workItemId, { status: "in_progress" });
      await ctx.db.patch(state._id, { phase: "awaiting_contractor_done" });
      return { completed: false, promotionEligible: false };
    }

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
        promotionEligible = isPromotionRecommended(
          successfulTasks,
          PROMOTION_SUCCESS_THRESHOLD,
        );
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
  },
  returns: v.object({ phase: v.string() }),
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    if (args.phase === "awaiting_tenant_verification") {
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
    if (!worker || !isPromotionRecommended(worker.successfulTasks, PROMOTION_SUCCESS_THRESHOLD)) {
      return { eligible: false };
    }
    const owner = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
      .first();
    if (!owner) {
      return { eligible: true };
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
