"use node";

import { Runner } from "@openai/agents";
import { v } from "convex/values";

import type { AgentBridge } from "../src/agents/bridge";
import { activityForFallback, activityForTool } from "../src/agents/events";
import { createManagerAgent, createWorkerAgent } from "../src/agents/factory";
import { createOpenRouterProvider } from "../src/agents/openRouter";
import { kindFromWorker } from "../src/agents/messageTargeting";
import { inboundAgentPrompt, managerFollowUpPrompt } from "../src/agents/prompts";
import { selectAgentKind } from "../src/agents/routing";
import type { RuntimeSnapshot } from "../src/agents/types";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";

const MANAGER_MAX_TURNS = 8;
const WORKER_MAX_TURNS = 6;
const MAX_DELEGATION_DEPTH = 2;

function findWorker(snapshot: RuntimeSnapshot, kind: "manager" | "operations" | "procurement") {
  if (kind === "manager") {
    return snapshot.workers.find((worker) => worker.rank === "manager" || worker.name === "Alex");
  }
  if (kind === "operations") {
    return (
      snapshot.workers.find((worker) => worker.name === "Shu Zhen") ??
      snapshot.workers.find((worker) => worker.capabilityKeys.includes("maintenance_triage"))
    );
  }
  return (
    snapshot.workers.find((worker) => worker.name === "Daniel") ??
    snapshot.workers.find((worker) => worker.capabilityKeys.includes("vendor_sourcing"))
  );
}

function asPeopleId(value?: string | unknown): Id<"people"> | undefined {
  return typeof value === "string" && value.length > 0
    ? (value as Id<"people">)
    : undefined;
}

function outboundPersonId(outbound: object): Id<"people"> | undefined {
  if (!("personId" in outbound)) {
    return undefined;
  }
  return asPeopleId(outbound.personId);
}

function asWorkerId(value?: string): Id<"workers"> | undefined {
  return value ? (value as Id<"workers">) : undefined;
}

function asWorkItemId(value?: string): Id<"workItems"> | undefined {
  return value ? (value as Id<"workItems">) : undefined;
}

export const handleInbound = internalAction({
  args: {
    messageId: v.id("messages"),
    chatId: v.string(),
  },
  returns: v.object({
    outboundCount: v.number(),
    usedFallback: v.boolean(),
    agentName: v.optional(v.string()),
    model: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    outboundCount: number;
    usedFallback: boolean;
    agentName?: string;
    model?: string;
  }> => {
    const inbound = await ctx.runQuery(internal.agentState.getInboundMessage, {
      messageId: args.messageId,
    });
    if (!inbound) {
      return { outboundCount: 0, usedFallback: false };
    }

    const registered = await ctx.runMutation(internal.demoRuntime.registerTelegramRole, {
      chatId: args.chatId,
      text: inbound.body,
    });
    if (registered.handled) {
      for (const outbound of registered.outbounds) {
        await ctx.runAction(internal.telegram.sendToChat, {
          chatId: outbound.chatId ?? args.chatId,
          body: outbound.body,
          personId: outboundPersonId(outbound),
        });
      }
      return { outboundCount: registered.outbounds.length, usedFallback: false };
    }

    try {
      const result = await runInboundAgents(ctx, {
        chatId: args.chatId,
        body: inbound.body,
        personId: inbound.personId,
      });
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Agent runtime failed";
      console.error("Agent runtime failed, using deterministic fallback:", reason);
      const fallback = activityForFallback(reason);
      await ctx.runMutation(internal.agentState.emitAgentEvent, {
        eventType: fallback.eventType,
        summary: fallback.summary,
        metadata: fallback.metadata,
      });
      const routed = await ctx.runMutation(internal.demoRuntime.routeInbound, {
        messageId: args.messageId,
        chatId: args.chatId,
      });
      if ("extractQuote" in routed && routed.extractQuote) {
        const applied = await ctx.runMutation(internal.demoRuntime.applyExtractedQuote, {
          chatId: args.chatId,
          personId: routed.extractQuote.personId,
          price: null,
          availability: null,
          rawMessage: routed.extractQuote.rawMessage,
        });
        for (const outbound of applied.outbounds) {
          await ctx.runAction(internal.telegram.sendToChat, {
            chatId: outbound.chatId ?? args.chatId,
            body: outbound.body,
            personId: outboundPersonId(outbound),
          });
        }
        return { outboundCount: applied.outbounds.length, usedFallback: true };
      }
      for (const outbound of routed.outbounds) {
        await ctx.runAction(internal.telegram.sendToChat, {
          chatId: outbound.chatId ?? args.chatId,
          body: outbound.body,
          personId: outboundPersonId(outbound),
        });
      }
      return { outboundCount: routed.outbounds.length, usedFallback: true };
    }
  },
});

async function runInboundAgents(
  ctx: ActionCtx,
  input: { chatId: string; body: string; personId?: Id<"people"> },
): Promise<{
  outboundCount: number;
  usedFallback: boolean;
  agentName?: string;
  model?: string;
}> {
  const { provider, model } = createOpenRouterProvider();
  let snapshot = (await ctx.runQuery(internal.agentState.loadRuntimeContext, {})) as RuntimeSnapshot;
  const person = snapshot.people.find((row) => row.id === input.personId);
  const kind = selectAgentKind({
    phase: snapshot.phase,
    roleType: person?.roleType,
    isSelectedContractor:
      person?.roleType === "contractor" &&
      snapshot.selectedContractorPersonId === person.id,
    pendingManagerFollowUp: snapshot.pendingManagerFollowUp,
  });

  const inboundActivity = activityForTool({
    agentName: kind === "manager" ? "Alex" : kind === "operations" ? "Shu Zhen" : "Daniel",
    toolName: "log_action",
    result: "human_response_received",
  });
  await ctx.runMutation(internal.agentState.emitAgentEvent, {
    eventType: "human_response_received",
    summary: `${inboundActivity.metadata.agentName} received an inbound message.`,
    metadata: {
      ...inboundActivity.metadata,
      agentName: inboundActivity.metadata.agentName,
      roleType: person?.roleType ?? null,
    },
  });

  const first = await runKind(ctx, {
    kind,
    snapshot,
    provider,
    model,
    prompt: inboundAgentPrompt({
      kind,
      body: input.body,
      roleType: person?.roleType,
      phase: snapshot.phase,
    }),
    chatId: input.chatId,
    inboundPersonId: input.personId,
  });

  snapshot = (await ctx.runQuery(internal.agentState.loadRuntimeContext, {})) as RuntimeSnapshot;
  let outboundCount = first.outboundCount;
  let agentName = first.agentName;

  if (snapshot.pendingManagerFollowUp) {
    const follow = await runKind(ctx, {
      kind: "manager",
      snapshot,
      provider,
      model,
      prompt: managerFollowUpPrompt({
        phase: snapshot.phase,
        pendingStaffingCapabilityKeys: snapshot.pendingStaffingCapabilityKeys,
      }),
      chatId: input.chatId,
      inboundPersonId: input.personId,
    });
    outboundCount += follow.outboundCount;
    agentName = follow.agentName;
    await ctx.runMutation(internal.agentState.consumeManagerFollowUp, {});
  }

  snapshot = (await ctx.runQuery(internal.agentState.loadRuntimeContext, {})) as RuntimeSnapshot;
  if (!findWorker(snapshot, "procurement") && snapshot.pendingStaffingCapabilityKeys.includes("vendor_sourcing")) {
    const follow = await runKind(ctx, {
      kind: "manager",
      snapshot,
      provider,
      model,
      prompt:
        "vendor_sourcing is still unstaffed. Call staff_work with capabilityKeys [\"vendor_sourcing\"] once, then delegate_worker to Daniel. Then stop.",
      chatId: input.chatId,
      inboundPersonId: input.personId,
    });
    outboundCount += follow.outboundCount;
    agentName = follow.agentName;
    snapshot = (await ctx.runQuery(internal.agentState.loadRuntimeContext, {})) as RuntimeSnapshot;
  }

  if (findWorker(snapshot, "procurement") && snapshot.phase === "awaiting_tenant_diagnosis") {
    const procurement = findWorker(snapshot, "procurement");
    if (procurement && snapshot.quotes.length === 0) {
      const resumed = await runKind(ctx, {
        kind: "procurement",
        snapshot,
        provider,
        model,
        prompt:
          "You are staffed for vendor sourcing. Call solicit_options once with a concise price-and-availability ask. Do not evaluate until every joined contractor has replied. One contractor is enough. Then stop.",
        chatId: input.chatId,
        inboundPersonId: input.personId,
      });
      outboundCount += resumed.outboundCount;
      agentName = resumed.agentName;
    }
  }

  snapshot = (await ctx.runQuery(internal.agentState.loadRuntimeContext, {})) as RuntimeSnapshot;
  if (kind === "manager" && snapshot.phase === "awaiting_tenant_diagnosis") {
    const ops = findWorker(snapshot, "operations");
    if (ops) {
      const resumed = await runKind(ctx, {
        kind: "operations",
        snapshot,
        provider,
        model,
        prompt: `Resume your assignment. The tenant said: ${input.body}. Contact them with one useful diagnostic question.`,
        chatId: input.chatId,
        inboundPersonId: input.personId,
      });
      outboundCount += resumed.outboundCount;
      agentName = resumed.agentName;
    }
  }

  return { outboundCount, usedFallback: false, agentName, model };
}

async function runKind(
  ctx: ActionCtx,
  input: {
    kind: "manager" | "operations" | "procurement";
    snapshot: RuntimeSnapshot;
    provider: ReturnType<typeof createOpenRouterProvider>["provider"];
    model: string;
    prompt: string;
    chatId: string;
    inboundPersonId?: Id<"people">;
  },
): Promise<{ outboundCount: number; agentName: string }> {
  const snapshot = (await ctx.runQuery(internal.agentState.loadRuntimeContext, {})) as RuntimeSnapshot;
  const worker = findWorker(snapshot, input.kind);
  if (!worker) {
    if (input.kind !== "manager") {
      throw new Error(`No ${input.kind} worker is persisted yet.`);
    }
    throw new Error("Alex is not seeded.");
  }

  const liveSnapshot: RuntimeSnapshot = { ...snapshot, actor: worker };
  const bridge = createBridge(ctx, liveSnapshot, input.chatId, input.inboundPersonId);
  const agent = createWorkerAgent(worker, bridge, liveSnapshot);

  const runner = new Runner({
    modelProvider: input.provider,
    tracingDisabled: true,
  });
  try {
    await runner.run(agent, input.prompt, {
      maxTurns: input.kind === "manager" ? MANAGER_MAX_TURNS : WORKER_MAX_TURNS,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name !== "MaxTurnsExceededError") {
      throw error;
    }
    console.error(`${worker.name} hit the turn limit; keeping work already done.`);
    await ctx.runMutation(internal.agentState.emitAgentEvent, {
      eventType: "tool_called",
      summary: `${worker.name} hit the turn limit.`,
      metadata: {
        agentName: worker.name,
        toolName: "runner",
        status: "error",
        result: "max_turns",
      },
    });
  }
  return { outboundCount: bridge.outboundCount, agentName: worker.name };
}

function createBridge(
  ctx: ActionCtx,
  initial: RuntimeSnapshot,
  chatId: string,
  inboundPersonId?: Id<"people">,
): AgentBridge & { outboundCount: number } {
  let snapshot = initial;
  let depth = 0;
  let outboundCount = 0;

  const refresh = async () => {
    snapshot = {
      ...((await ctx.runQuery(internal.agentState.loadRuntimeContext, {
        actorWorkerId: asWorkerId(snapshot.actor?.id),
      })) as RuntimeSnapshot),
      actor: snapshot.actor,
    };
    return snapshot;
  };

  const emit = async (activity: Parameters<AgentBridge["emit"]>[0]) => {
    await ctx.runMutation(internal.agentState.emitAgentEvent, {
      workerId: asWorkerId(snapshot.actor?.id),
      workItemId: asWorkItemId(snapshot.workItem?.id),
      eventType: activity.eventType,
      summary: activity.summary,
      metadata: activity.metadata,
    });
  };

  const sendResolved = async (target: {
    personId?: Id<"people">;
    chatId?: string;
    body: string;
  }) => {
    if (!target.chatId) {
      return;
    }
    await ctx.runAction(internal.telegram.sendToChat, {
      chatId: target.chatId,
      body: target.body,
      personId: target.personId,
    });
    outboundCount += 1;
  };

  const bridge: AgentBridge & { outboundCount: number } = {
    get outboundCount() {
      return outboundCount;
    },
    snapshot: () => snapshot,
    refresh,
    emit,
    staffWork: async (input) => {
      const result = (await ctx.runMutation(internal.agentState.staffWork, {
        objective: input.objective,
        requestedByPersonId: asPeopleId(input.requestedByPersonId) ?? inboundPersonId,
        capabilityKeys: input.capabilityKeys,
      })) as {
        workerId: string;
        workerName: string;
        workItemId: string;
        assignmentId: string;
        capabilityKeys: string[];
      };
      await refresh();
      return result;
    },
    requestStaffing: async (input) => {
      const result = (await ctx.runMutation(internal.agentState.requestStaffing, input)) as {
        ok: boolean;
      };
      await refresh();
      return result;
    },
    staffCapabilities: async (input) => {
      const result = (await ctx.runMutation(internal.agentState.staffWork, {
        objective: snapshot.workItem?.objective ?? input.capabilityKeys.join(", "),
        capabilityKeys: input.capabilityKeys,
      })) as {
        workerId: string;
        workerName: string;
        workItemId: string;
        assignmentId: string;
        capabilityKeys: string[];
      };
      await refresh();
      return result;
    },
    sendMessage: async (input) => {
      const target = (await ctx.runMutation(internal.agentState.sendIntent, {
        personId: asPeopleId(input.personId),
        roleType: input.roleType,
        demoCallsign: input.demoCallsign,
        body: input.body,
        agentKind: kindFromWorker(snapshot.actor),
        inboundPersonId,
      })) as { personId?: Id<"people">; chatId?: string; body: string };
      if (target.chatId) {
        await sendResolved(target);
        return { sent: true, personId: target.personId };
      }
      outboundCount += 1;
      return { sent: false, personId: target.personId };
    },
    solicitOptions: async (input) => {
      const targets = (await ctx.runMutation(internal.agentState.solicitOptions, {
        body: input.body,
      })) as Array<{ personId: Id<"people">; chatId: string; body: string }>;
      for (const target of targets) {
        await sendResolved(target);
      }
      if (targets.length === 0) {
        const wait = (await ctx.runMutation(internal.agentState.sendIntent, {
          roleType: "tenant",
          body: "Daniel is ready, but no contractor has joined yet. One contractor QR scan is enough to continue.",
          agentKind: "operations",
          inboundPersonId,
        })) as { personId?: Id<"people">; chatId?: string; body: string };
        await sendResolved(wait);
      }
      await refresh();
      return { contacted: targets.length };
    },
    recordOption: async (input) => {
      const result = (await ctx.runMutation(internal.agentState.recordOption, {
        personId: asPeopleId(input.personId) ?? inboundPersonId,
        price: input.price,
        availability: input.availability,
        rawMessage: input.rawMessage,
        chatId,
      })) as {
        ok: boolean;
        needClarification: boolean;
        recordedCount: number;
        quotesNeeded: number;
        readyToEvaluate: boolean;
      };
      await refresh();
      // The bridge is the single owner of automatic ranking and reporting. agentState gates
      // readyToEvaluate to one sourcing round, and reportRecommendation is idempotent, so a
      // model that also calls evaluate_options/report_recommendation cannot double-report.
      if (result.ok && result.readyToEvaluate) {
        await bridge.evaluateOptions();
        await bridge.reportRecommendation({
          summary: `Ranked ${result.recordedCount} of ${result.quotesNeeded} joined contractor quotes.`,
        });
        await refresh();
      }
      return result;
    },
    evaluateOptions: async () => {
      const result = (await ctx.runMutation(internal.agentState.evaluateOptions, {})) as {
        winnerPersonId: string | null;
        ranked: Array<{
          personId: string;
          price: number | null;
          availability: string | null;
          viable: boolean;
          rank: number | null;
          rejectedReason?: string;
        }>;
      };
      await refresh();
      return result;
    },
    reportRecommendation: async (input) => {
      const result = (await ctx.runMutation(
        internal.agentState.reportRecommendation,
        input,
      )) as { ok: boolean };
      await refresh();
      return result;
    },
    requestApproval: async (input) => {
      const result = (await ctx.runMutation(internal.agentState.requestApproval, input)) as {
        approvalId: string;
      };
      await refresh();
      return result;
    },
    resolveApproval: async (input) => {
      const result = (await ctx.runMutation(internal.agentState.resolveApproval, {
        ...input,
        actorPersonId: inboundPersonId,
      })) as {
        status: string;
        confirmed: boolean;
        selectedPersonId?: Id<"people">;
        tenantPersonId?: Id<"people">;
      };
      await refresh();
      return {
        status: result.status,
        confirmed: result.confirmed,
        selectedPersonId: result.selectedPersonId,
        tenantPersonId: result.tenantPersonId,
      };
    },
    verifyOutcome: async (input) => {
      const result = (await ctx.runMutation(internal.agentState.verifyOutcome, {
        ...input,
        actorPersonId: inboundPersonId,
      })) as {
        completed: boolean;
        promotionEligible: boolean;
      };
      await refresh();
      return result;
    },
    updateWorkContext: async (input) => {
      const result = (await ctx.runMutation(internal.agentState.updateWorkContext, {
        ...input,
        actorPersonId: inboundPersonId,
      })) as {
        phase: string;
      };
      await refresh();
      return result;
    },
    recommendPromotion: async () => {
      const result = (await ctx.runMutation(internal.agentState.recommendPromotion, {})) as {
        approvalId?: string;
        eligible: boolean;
      };
      await refresh();
      return result;
    },
    runWorkerAgent: async (input) => {
      if (depth >= MAX_DELEGATION_DEPTH) {
        throw new Error("Worker delegation limit reached.");
      }
      depth += 1;
      try {
        const current = await refresh();
        const target =
          current.workers.find((worker) => worker.id === input.workerId) ??
          current.workers.find(
            (worker) => worker.name.toLowerCase() === input.workerName?.toLowerCase(),
          );
        if (!target) {
          throw new Error("That worker is not persisted.");
        }
        const workerSnapshot: RuntimeSnapshot = { ...current, actor: target };
        const nested = createBridge(ctx, workerSnapshot, chatId, inboundPersonId);
        const agent = createWorkerAgent(target, nested, workerSnapshot);
        const { provider } = createOpenRouterProvider();
        const runner = new Runner({
          modelProvider: provider,
          tracingDisabled: true,
        });
        const result = await runner.run(agent, input.brief, {
          maxTurns: WORKER_MAX_TURNS,
        });
        outboundCount += nested.outboundCount;
        await refresh();
        return {
          workerName: target.name,
          finalOutput:
            typeof result.finalOutput === "string" ? result.finalOutput : undefined,
        };
      } finally {
        depth -= 1;
      }
    },
  };

  return bridge;
}

export const proveDelegation = action({
  args: {
    objective: v.optional(v.string()),
  },
  returns: v.object({
    pass: v.boolean(),
    model: v.string(),
    agentName: v.optional(v.string()),
    outboundCount: v.number(),
    usedFallback: v.boolean(),
    workerNames: v.array(v.string()),
    eventSummaries: v.array(v.string()),
    eventTypes: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    pass: boolean;
    model: string;
    agentName?: string;
    outboundCount: number;
    usedFallback: boolean;
    workerNames: string[];
    eventSummaries: string[];
    eventTypes: string[];
  }> => {
    await ctx.runMutation(api.seed.bootstrapDemo, {});
    const tenant: { personId: Id<"people"> } = await ctx.runMutation(
      internal.agentState.ensureDemoTenant,
      {},
    );
    await ctx.runMutation(internal.agentState.resetProofState, {});
    const objective =
      args.objective ?? "The toilet keeps leaking onto the floor after we flush.";
    const result = await runInboundAgents(ctx, {
      chatId: "prove-delegation",
      body: objective,
      personId: tenant.personId,
    });
    const snapshot = (await ctx.runQuery(internal.agentState.loadRuntimeContext, {})) as RuntimeSnapshot;
    const events = (await ctx.runQuery(api.events.list, {})) as Array<{
      eventType: string;
      summary: string;
    }>;
    const workerNames = snapshot.workers.map((worker) => worker.name);
    const eventTypes = events.map((event) => event.eventType);
    const eventSummaries = events.slice(0, 20).map((event) => event.summary);
    const delegated =
      workerNames.includes("Shu Zhen") &&
      (eventTypes.includes("assignment_started") || eventTypes.includes("worker_created"));
    const messaged = eventTypes.includes("human_contacted") || result.outboundCount > 0;
    return {
      pass: result.usedFallback === false && delegated && messaged,
      model: result.model ?? createOpenRouterProvider().model,
      agentName: result.agentName,
      outboundCount: result.outboundCount,
      usedFallback: result.usedFallback,
      workerNames,
      eventSummaries,
      eventTypes,
    };
  },
});

export const proveThreeAgent = action({
  args: {},
  returns: v.object({
    pass: v.boolean(),
    model: v.string(),
    usedFallback: v.boolean(),
    workerNames: v.array(v.string()),
    eventSummaries: v.array(v.string()),
    eventTypes: v.array(v.string()),
    outboundCount: v.number(),
  }),
  handler: async (ctx): Promise<{
    pass: boolean;
    model: string;
    usedFallback: boolean;
    workerNames: string[];
    eventSummaries: string[];
    eventTypes: string[];
    outboundCount: number;
  }> => {
    await ctx.runMutation(api.seed.bootstrapDemo, {});
    const tenant = await ctx.runMutation(internal.agentState.ensureDemoTenant, {});
    await ctx.runMutation(internal.agentState.resetProofState, {});
    const first = await runInboundAgents(ctx, {
      chatId: "prove-three-agent",
      body: "The toilet keeps leaking onto the floor after we flush.",
      personId: tenant.personId,
    });
    const second = await runInboundAgents(ctx, {
      chatId: "prove-three-agent",
      body: "It only leaks after I flush. Need someone today if possible.",
      personId: tenant.personId,
    });
    const snapshot = (await ctx.runQuery(internal.agentState.loadRuntimeContext, {})) as RuntimeSnapshot;
    const events = (await ctx.runQuery(api.events.list, {})) as Array<{
      eventType: string;
      summary: string;
    }>;
    const workerNames = snapshot.workers.map((worker) => worker.name);
    const eventTypes = events.map((event) => event.eventType);
    return {
      pass:
        first.usedFallback === false &&
        second.usedFallback === false &&
        workerNames.includes("Shu Zhen") &&
        workerNames.includes("Daniel") &&
        eventTypes.includes("staffing_requested") &&
        eventTypes.includes("human_contacted"),
      model: first.model ?? createOpenRouterProvider().model,
      usedFallback: first.usedFallback || second.usedFallback,
      workerNames,
      eventSummaries: events.slice(0, 24).map((event) => event.summary),
      eventTypes,
      outboundCount: first.outboundCount + second.outboundCount,
    };
  },
});

