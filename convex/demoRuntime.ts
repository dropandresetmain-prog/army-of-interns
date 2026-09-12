import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  canConfirmContractor,
  CONTRACTOR_SOLICITATION,
  DEMO_BUDGET,
  DEMO_DEADLINE_LABEL,
  DEMO_OPS_WORKER,
  DEMO_OWNER,
  DEMO_PROCUREMENT_WORKER,
  DEMO_STATE_KEY,
  DEMO_TENANT,
  evaluateContractorOptions,
  extractContractorQuote,
  interpretTenantVerificationFallback,
  isContractorDone,
  isPromotionRecommended,
  looksLikeWorkRequest,
  parseOwnerCommand,
  parseStartRole,
  PROMOTION_SUCCESS_THRESHOLD,
  resolveContractorRegistration,
  SEEDED_OPS_SUCCESSFUL_TASKS,
  TENANT_FOLLOW_UP,
} from "../src/scenarios/propertyMaintenance";
import { analyzeRequiredCapabilities } from "../src/core/workforce";
import {
  canReportContractorCompletion,
  canResolveApproval,
  canVerifyOutcome,
} from "../src/agents/authority";
import { persistIntakeAndStaff, persistStaffCapabilities } from "./workforce";
import { persistBootstrapDemo, resetTransientDemoRecords } from "./seed";

const personPublicValidator = v.object({
  _id: v.id("people"),
  displayName: v.string(),
  roleType: v.string(),
  demoCallsign: v.optional(v.string()),
  telegramChatId: v.optional(v.string()),
  active: v.boolean(),
});

const outboundValidator = v.object({
  personId: v.optional(v.id("people")),
  chatId: v.optional(v.string()),
  body: v.string(),
});

const routeResultValidator = v.object({
  handled: v.boolean(),
  outbounds: v.array(outboundValidator),
  extractQuote: v.optional(
    v.object({
      personId: v.id("people"),
      rawMessage: v.string(),
    }),
  ),
});

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

async function emit(
  ctx: MutationCtx,
  args: {
    workerId?: Id<"workers">;
    workItemId?: Id<"workItems">;
    eventType:
      | "work_received"
      | "capabilities_identified"
      | "worker_matched"
      | "staffing_requested"
      | "worker_created"
      | "assignment_started"
      | "human_contacted"
      | "human_response_received"
      | "approval_requested"
      | "approval_resolved"
      | "work_verified"
      | "work_completed"
      | "promotion_recommended"
      | "worker_promoted"
      | "tool_called";
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

async function peopleByRole(ctx: MutationCtx, roleType: string) {
  return await ctx.db
    .query("people")
    .withIndex("by_role_type", (q) => q.eq("roleType", roleType))
    .take(20);
}

async function contractors(ctx: MutationCtx) {
  const rows = await peopleByRole(ctx, "contractor");
  return rows
    .filter((person) => person.active && person.telegramChatId)
    .sort((a, b) => (a.demoCallsign ?? "").localeCompare(b.demoCallsign ?? ""));
}

export const getPerson = internalQuery({
  args: { personId: v.id("people") },
  returns: v.union(personPublicValidator, v.null()),
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person) {
      return null;
    }
    return {
      _id: person._id,
      displayName: person.displayName,
      roleType: person.roleType,
      demoCallsign: person.demoCallsign,
      telegramChatId: person.telegramChatId,
      active: person.active,
    };
  },
});

export const debugSnapshot = query({
  args: {},
  returns: v.object({
    phase: v.string(),
    workItemId: v.optional(v.id("workItems")),
    people: v.array(personPublicValidator),
  }),
  handler: async (ctx) => {
    const state = await ctx.db
      .query("demoState")
      .withIndex("by_key", (q) => q.eq("key", DEMO_STATE_KEY))
      .first();
    const people = await ctx.db.query("people").take(50);
    return {
      phase: state?.phase ?? "idle",
      workItemId: state?.workItemId,
      people: people.map((person) => ({
        _id: person._id,
        displayName: person.displayName,
        roleType: person.roleType,
        demoCallsign: person.demoCallsign,
        telegramChatId: person.telegramChatId,
        active: person.active,
      })),
    };
  },
});

export async function persistTelegramRole(
  ctx: MutationCtx,
  args: { chatId: string; text: string; displayNameHint?: string },
) {
    const role = parseStartRole(args.text);
    if (!role) {
      return { handled: false, outbounds: [] };
    }

    const matches = await ctx.db
      .query("people")
      .withIndex("by_telegram_chat_id", (q) => q.eq("telegramChatId", args.chatId))
      .take(20);
    const isCorrelationPlaceholder = (person: Doc<"people">) =>
      person.roleType === "participant" &&
      person.scenarioMetadata?.source === "telegram_inbound_correlation";
    const releaseOtherPlaceholders = async (keepPersonId: Id<"people">) => {
      for (const person of matches) {
        if (person._id !== keepPersonId && isCorrelationPlaceholder(person)) {
          await ctx.db.patch(person._id, {
            active: false,
            telegramChatId: undefined,
          });
        }
      }
    };

    if (role === "owner") {
      const existing =
        (await ctx.db
          .query("people")
          .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", DEMO_OWNER.demoCallsign))
          .first()) ?? null;
      const personId =
        existing?._id ??
        (await ctx.db.insert("people", {
          displayName: DEMO_OWNER.displayName,
          roleType: DEMO_OWNER.roleType,
          demoCallsign: DEMO_OWNER.demoCallsign,
          telegramChatId: args.chatId,
          active: true,
          scenarioMetadata: { source: "telegram_start" },
        }));
      await ctx.db.patch(personId, {
        displayName: DEMO_OWNER.displayName,
        roleType: DEMO_OWNER.roleType,
        demoCallsign: DEMO_OWNER.demoCallsign,
        telegramChatId: args.chatId,
        active: true,
      });
      await releaseOtherPlaceholders(personId);
      return {
        handled: true,
        outbounds: [
          {
            personId,
            chatId: args.chatId,
            body: "Registered as Tim / Business Owner. Reply in your own words when a recommendation is ready.",
          },
        ],
      };
    }

    if (role === "tenant") {
      const existing =
        (await ctx.db
          .query("people")
          .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", DEMO_TENANT.demoCallsign))
          .first()) ?? null;
      const reusableParticipant = matches.find(isCorrelationPlaceholder);
      const personId =
        existing?._id ?? reusableParticipant?._id ??
        (await ctx.db.insert("people", {
          displayName: DEMO_TENANT.displayName,
          roleType: DEMO_TENANT.roleType,
          demoCallsign: DEMO_TENANT.demoCallsign,
          telegramChatId: args.chatId,
          active: true,
          scenarioMetadata: { source: "telegram_start" },
        }));
      await ctx.db.patch(personId, {
        displayName: DEMO_TENANT.displayName,
        roleType: DEMO_TENANT.roleType,
        demoCallsign: DEMO_TENANT.demoCallsign,
        telegramChatId: args.chatId,
        active: true,
      });
      await releaseOtherPlaceholders(personId);
      return {
        handled: true,
        outbounds: [
          {
            personId,
            chatId: args.chatId,
            body: "Registered as Tenant. Describe the issue when ready (e.g. toilet keeps leaking onto the floor).",
          },
        ],
      };
    }

    const alreadyContractor = matches.find((person) => person.roleType === "contractor");
    const existingContractors = await ctx.db
      .query("people")
      .withIndex("by_role_type", (q) => q.eq("roleType", "contractor"))
      .take(20);
    const occupied = existingContractors.filter((person) => person.active);
    const resolved = resolveContractorRegistration({
      chatId: args.chatId,
      existingContractors: occupied.map((person) => ({
        telegramChatId: person.telegramChatId,
        displayName: person.displayName,
      })),
    });

    if (alreadyContractor || resolved.action === "reuse") {
      const person = alreadyContractor ?? occupied.find((row) => row.telegramChatId === args.chatId);
      if (person) {
        return {
          handled: true,
          outbounds: [
            {
              personId: person._id,
              chatId: args.chatId,
              body: `Already registered as ${person.displayName}.`,
            },
          ],
        };
      }
    }

    if (resolved.action !== "assign") {
      return {
        handled: true,
        outbounds: [
          {
            chatId: args.chatId,
            body: "All three contractor slots are filled (A, B, C).",
          },
        ],
      };
    }

    const reusableParticipant = matches.find(isCorrelationPlaceholder);
    const existingOtherRole = matches.find(
      (person) => person.roleType !== "contractor" && !isCorrelationPlaceholder(person),
    );
    if (existingOtherRole) {
      return {
        handled: true,
        outbounds: [
          {
            personId: existingOtherRole._id,
            chatId: args.chatId,
            body: `This chat is already registered as ${existingOtherRole.displayName}. Use a different Telegram account for a contractor.`,
          },
        ],
      };
    }

    const next = resolved.identity;
    const personId =
      reusableParticipant?._id ??
      (await ctx.db.insert("people", {
        displayName: next.displayName,
        roleType: "contractor",
        demoCallsign: next.demoCallsign,
        telegramChatId: args.chatId,
        active: true,
        scenarioMetadata: { source: "telegram_start" },
      }));
    await ctx.db.patch(personId, {
      displayName: next.displayName,
      roleType: "contractor",
      demoCallsign: next.demoCallsign,
      telegramChatId: args.chatId,
      active: true,
      scenarioMetadata: { source: "telegram_start" },
    });
    await releaseOtherPlaceholders(personId);

    return {
      handled: true,
      outbounds: [
        {
          personId,
          chatId: args.chatId,
          body: `Registered as ${next.displayName}. Wait for a sourcing request, then reply with price and earliest availability.`,
        },
      ],
    };
}

export const registerTelegramRole = internalMutation({
  args: {
    chatId: v.string(),
    text: v.string(),
    displayNameHint: v.optional(v.string()),
  },
  returns: routeResultValidator,
  handler: persistTelegramRole,
});

async function staffTenantRequest(
  ctx: MutationCtx,
  tenant: Doc<"people">,
  text: string,
) {
  const analysis = analyzeRequiredCapabilities({ objective: text });
  if (analysis.unrecognized && !looksLikeWorkRequest(text)) {
    return null;
  }

  const result = await persistIntakeAndStaff(ctx, {
    text,
    requestedByPersonId: tenant._id,
    context: "Telegram tenant report",
    constraints: [`Budget ≤ ${DEMO_BUDGET.currency} ${DEMO_BUDGET.amount}`, "Needed today"],
    workerPresentation: {
      name: DEMO_OPS_WORKER.name,
      title: DEMO_OPS_WORKER.title,
      seededSuccessfulTasks: SEEDED_OPS_SUCCESSFUL_TASKS,
    },
  });

  const state = await getOrCreateDemoState(ctx);
  await ctx.db.patch(state._id, {
    phase: "awaiting_tenant_diagnosis",
    workItemId: result.workItemId,
    operationsWorkerId: result.workerId,
    operationsAssignmentId: result.assignmentId,
    metadata: {
      ...state.metadata,
      tenantPersonId: tenant._id,
    },
  });

  return result;
}

export const routeInbound = internalMutation({
  args: {
    messageId: v.id("messages"),
    chatId: v.string(),
    extractedQuote: v.optional(
      v.object({
        price: v.union(v.number(), v.null()),
        availability: v.union(v.string(), v.null()),
        rawMessage: v.string(),
      }),
    ),
  },
  returns: routeResultValidator,
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return { handled: true, outbounds: [] };
    }

    const start = await persistTelegramRole(ctx, {
      chatId: args.chatId,
      text: message.body,
      displayNameHint:
        typeof message.providerMetadata?.displayNameHint === "string"
          ? message.providerMetadata.displayNameHint
          : undefined,
    });
    if (start.handled) {
      return start;
    }

    const state = await getOrCreateDemoState(ctx);
    const person = message.personId ? await ctx.db.get(message.personId) : null;
    const owner = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
      .first();
    const tenantId =
      typeof state.metadata.tenantPersonId === "string"
        ? (state.metadata.tenantPersonId as Id<"people">)
        : undefined;
    const ownerCommand = parseOwnerCommand(message.body);

    if (ownerCommand) {
      if (
        !canResolveApproval({
          actorPersonId: person?._id,
          actorRoleType: person?.roleType,
          ownerPersonId: owner?._id,
        })
      ) {
        return { handled: true, outbounds: [{ chatId: args.chatId, body: "Noted." }] };
      }
      return await handleOwnerCommand(ctx, state, args.chatId, ownerCommand);
    }

    if (isContractorDone(message.body)) {
      if (
        !canReportContractorCompletion({
          actorPersonId: person?._id,
          selectedContractorPersonId: state.selectedContractorPersonId,
        })
      ) {
        return { handled: true, outbounds: [{ chatId: args.chatId, body: "Noted." }] };
      }
      return await handleContractorDone(ctx, state, args.chatId);
    }

    if (state.phase === "soliciting_quotes" || state.phase === "rejected_resourcing") {
      if (args.extractedQuote) {
        return await persistContractorQuote(ctx, state, args.chatId, args.extractedQuote);
      }
      const contractor = (await contractors(ctx)).find(
        (row) =>
          row.telegramChatId === args.chatId &&
          (!person || row._id === person._id || row.roleType === "contractor"),
      );
      if (contractor || person?.roleType === "contractor") {
        return {
          handled: true,
          outbounds: [],
          extractQuote: {
            personId: contractor?._id ?? person!._id,
            rawMessage: message.body,
          },
        };
      }
    }

    if (state.phase === "awaiting_tenant_diagnosis") {
      return await handleTenantDiagnosis(ctx, state, args.chatId, message.body);
    }

    if (state.phase === "awaiting_tenant_verification") {
      const verdict = interpretTenantVerificationFallback(message.body);
      if (verdict !== null) {
        if (
          !canVerifyOutcome({
            actorPersonId: person?._id,
            actorRoleType: person?.roleType,
            tenantPersonId: tenantId,
          })
        ) {
          return { handled: true, outbounds: [{ chatId: args.chatId, body: "Noted." }] };
        }
        return await handleTenantVerification(ctx, state, args.chatId, verdict);
      }
    }

    const tenant =
      person?.roleType === "tenant"
        ? person
        : await ctx.db
            .query("people")
            .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "TENANT"))
            .first();

    if (
      (state.phase === "idle" || state.phase === "completed") &&
      tenant &&
      person?.roleType === "tenant" &&
      looksLikeWorkRequest(message.body)
    ) {
      const staffed = await staffTenantRequest(ctx, tenant, message.body);
      if (!staffed) {
        return {
          handled: true,
          outbounds: [
            { chatId: args.chatId, body: "I could not identify a controlled capability yet. Try describing the maintenance issue." },
          ],
        };
      }
      return {
        handled: true,
        outbounds: [
          {
            personId: tenant._id,
            chatId: args.chatId,
            body: TENANT_FOLLOW_UP,
          },
        ],
      };
    }

    return {
      handled: true,
      outbounds: [
        {
          chatId: args.chatId,
          body:
            "Army of Interns received your message. Use /start owner, /start tenant, or /start contractor.",
        },
      ],
    };
  },
});

export const applyExtractedQuote = internalMutation({
  args: {
    chatId: v.string(),
    personId: v.id("people"),
    price: v.union(v.number(), v.null()),
    availability: v.union(v.string(), v.null()),
    rawMessage: v.string(),
  },
  returns: routeResultValidator,
  handler: async (ctx, args) => {
    const state = await getOrCreateDemoState(ctx);
    return await persistContractorQuote(ctx, state, args.chatId, {
      price: args.price,
      availability: args.availability,
      rawMessage: args.rawMessage,
      personId: args.personId,
    });
  },
});

async function persistContractorQuote(
  ctx: MutationCtx,
  state: Doc<"demoState">,
  chatId: string,
  quote: {
    price: number | null;
    availability: string | null;
    rawMessage: string;
    personId?: Id<"people">;
  },
) {
  if (!state.workItemId) {
    return { handled: true, outbounds: [{ chatId, body: "No active work item for quotes." }] };
  }

  const existingQuotes = await ctx.db
    .query("contractorQuotes")
    .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
    .take(20);

  const vendorPeople = await contractors(ctx);
  let personId = quote.personId;
  const unanswered = vendorPeople.find(
    (person) => !existingQuotes.some((row) => row.personId === person._id && row.extractStatus === "ok"),
  );
  if (personId) {
    const alreadyOk = existingQuotes.some(
      (row) => row.personId === personId && row.extractStatus === "ok",
    );
    if (alreadyOk && unanswered) {
      personId = unanswered._id;
    }
  } else {
    personId = unanswered?._id;
  }
  if (!personId) {
    return { handled: true, outbounds: [{ chatId, body: "Could not correlate that contractor reply." }] };
  }

  const fallback = extractContractorQuote(quote.rawMessage);
  const price = quote.price ?? fallback.price;
  const availability = quote.availability ?? fallback.availability;
  const extractStatus = price !== null ? ("ok" as const) : ("failed" as const);

  const previous = existingQuotes.find((row) => row.personId === personId);
  if (previous) {
    await ctx.db.patch(previous._id, {
      rawMessage: quote.rawMessage,
      price: price ?? undefined,
      availability: availability ?? undefined,
      extractStatus,
    });
  } else {
    await ctx.db.insert("contractorQuotes", {
      workItemId: state.workItemId,
      personId,
      rawMessage: quote.rawMessage,
      price: price ?? undefined,
      availability: availability ?? undefined,
      extractStatus,
    });
  }

  if (extractStatus === "failed") {
    await emit(ctx, {
      workItemId: state.workItemId,
      eventType: "tool_called",
      summary: "Contractor quote extraction failed; another reply is allowed.",
      metadata: { personId, rawMessage: quote.rawMessage.slice(0, 160) },
    });
    return {
      handled: true,
      outbounds: [
        {
          personId,
          chatId,
          body: "I could not read a price from that reply. Please send your price and earliest availability again.",
        },
      ],
    };
  }

  const refreshed = await ctx.db
    .query("contractorQuotes")
    .withIndex("by_work_item", (q) => q.eq("workItemId", state.workItemId!))
    .take(20);
  const okQuotes = refreshed.filter((row) => row.extractStatus === "ok");
  if (okQuotes.length < Math.min(3, vendorPeople.length) || vendorPeople.length === 0) {
    return {
      handled: true,
      outbounds: [{ personId, chatId, body: "Got it — recorded your quote." }],
    };
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
    const row = refreshed.find((quoteRow) => quoteRow.personId === item.personId);
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

  const owner =
    (await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
      .first()) ?? null;
  const winner = ranked.ranked.find((item) => item.personId === ranked.winnerPersonId);
  const winnerPerson = winner
    ? await ctx.db.get(winner.personId as Id<"people">)
    : null;

  if (!owner || !winner || !state.workItemId || !state.procurementWorkerId) {
    await ctx.db.patch(state._id, { phase: "rejected_resourcing" });
    return {
      handled: true,
      outbounds: [
        {
          chatId,
          body: "Quotes recorded, but no viable option met the deadline. Reply again or reset the demo.",
        },
      ],
    };
  }

  const approvalId = await ctx.db.insert("approvals", {
    workItemId: state.workItemId,
    requestedFromPersonId: owner._id,
    proposedByWorkerId: state.procurementWorkerId,
    actionType: "confirm_contractor_spend",
    reason: "Owner approval required before confirming a paid contractor.",
    riskClass: "high",
    amount: winner.price
      ? { value: winner.price, currency: DEMO_BUDGET.currency }
      : undefined,
    payload: {
      selectedPersonId: winner.personId,
      selectedName: winnerPerson?.displayName ?? "Contractor",
      price: winner.price,
      availability: winner.availability,
      ranking: ranked.ranked.map((item) => ({
        personId: item.personId,
        price: item.price,
        availability: item.availability,
        viable: item.viable,
        rank: item.rank,
        rejectedReason: item.rejectedReason ?? null,
      })),
    },
    status: "pending",
    requestedAt: Date.now(),
  });

  await ctx.db.patch(state.workItemId, { status: "awaiting_approval" });
  await ctx.db.patch(state._id, {
    phase: "awaiting_owner_approval",
    approvalId,
    selectedContractorPersonId: winner.personId as Id<"people">,
  });

  await emit(ctx, {
    workItemId: state.workItemId,
    workerId: state.procurementWorkerId,
    eventType: "approval_requested",
    summary: `Recommend ${winnerPerson?.displayName ?? "contractor"} at ${DEMO_BUDGET.currency} ${winner.price} (${winner.availability}).`,
    metadata: {
      approvalId,
      selectedPersonId: winner.personId,
      price: winner.price ?? null,
      availability: winner.availability ?? null,
    },
  });

  const lines = ranked.ranked
    .map((item) => {
      const name =
        vendorPeople.find((person) => person._id === item.personId)?.displayName ?? "Contractor";
      const flag = item.viable ? (item.rank === 1 ? "RECOMMENDED" : "viable") : "rejected";
      return `• ${name}: ${item.price ?? "?"} / ${item.availability ?? "?"} (${flag}${item.rejectedReason ? ` — ${item.rejectedReason}` : ""})`;
    })
    .join("\n");

  return {
    handled: true,
    outbounds: [
      { personId, chatId, body: "Got it — recorded your quote." },
      {
        personId: owner._id,
        chatId: owner.telegramChatId ?? chatId,
        body: `Recommendation ready.\n${lines}\n\nReply APPROVE or REJECT.`,
      },
    ],
  };
}

async function handleTenantDiagnosis(
  ctx: MutationCtx,
  state: Doc<"demoState">,
  chatId: string,
  _text: string,
) {
  if (!state.workItemId) {
    return { handled: true, outbounds: [{ chatId, body: "No active work item." }] };
  }

  const staffed = await persistStaffCapabilities(ctx, {
    workItemId: state.workItemId,
    capabilityKeys: ["vendor_sourcing"],
    workerPresentation: {
      name: DEMO_PROCUREMENT_WORKER.name,
      title: DEMO_PROCUREMENT_WORKER.title,
    },
  });

  await ctx.db.patch(state._id, {
    phase: "soliciting_quotes",
    procurementWorkerId: staffed.workerId,
    procurementAssignmentId: staffed.assignmentId,
  });

  const vendorPeople = await contractors(ctx);
  if (vendorPeople.length === 0) {
    return {
      handled: true,
      outbounds: [
        {
          chatId,
          body: "Vendor sourcing is staffed, but no contractors are registered. Ask three people to send /start contractor.",
        },
      ],
    };
  }

  return {
    handled: true,
    outbounds: vendorPeople.map((person) => ({
      personId: person._id,
      chatId: person.telegramChatId!,
      body: CONTRACTOR_SOLICITATION,
    })),
  };
}

async function handleOwnerCommand(
  ctx: MutationCtx,
  state: Doc<"demoState">,
  chatId: string,
  command: "APPROVE" | "REJECT" | "PROMOTE",
) {
  if (command === "PROMOTE" || state.phase === "awaiting_promotion") {
    return await handlePromote(ctx, state, chatId, command === "REJECT" ? "rejected" : "approved");
  }

  if (state.phase !== "awaiting_owner_approval" || !state.approvalId) {
    return {
      handled: true,
      outbounds: [{ chatId, body: "There is no pending spend approval." }],
    };
  }

  const approval = await ctx.db.get(state.approvalId);
  if (!approval || approval.status !== "pending") {
    return {
      handled: true,
      outbounds: [{ chatId, body: "That approval is no longer pending." }],
    };
  }

  if (command === "REJECT") {
    await ctx.db.patch(approval._id, { status: "rejected", resolvedAt: Date.now() });
    if (state.workItemId) {
      await ctx.db.patch(state.workItemId, { status: "blocked" });
    }
    await ctx.db.patch(state._id, { phase: "rejected_resourcing" });
    await emit(ctx, {
      workItemId: state.workItemId,
      workerId: state.procurementWorkerId,
      eventType: "approval_resolved",
      summary: "Owner rejected the recommendation. No contractor was confirmed.",
      metadata: { decision: "rejected", approvalId: approval._id, externalCommitment: false },
    });
    return {
      handled: true,
      outbounds: [
        {
          chatId,
          body: "Rejected. No contractor was confirmed and no external commitment was made. Demo is in a re-source / blocked state.",
        },
      ],
    };
  }

  await ctx.db.patch(approval._id, { status: "approved", resolvedAt: Date.now() });
  const refreshed = await ctx.db.get(approval._id);
  if (!refreshed || !canConfirmContractor(refreshed.status)) {
    throw new ConvexError("Contractor confirmation blocked: approval is not approved.");
  }

  const selectedId = state.selectedContractorPersonId;
  const selected = selectedId ? await ctx.db.get(selectedId) : null;
  const tenantId =
    typeof state.metadata.tenantPersonId === "string"
      ? (state.metadata.tenantPersonId as Id<"people">)
      : undefined;
  const tenant = tenantId ? await ctx.db.get(tenantId) : null;
  const payload = refreshed.payload as {
    price?: number;
    availability?: string;
    selectedName?: string;
  };

  if (state.workItemId) {
    await ctx.db.patch(state.workItemId, { status: "in_progress" });
  }
  await ctx.db.patch(state._id, { phase: "awaiting_contractor_done" });
  await emit(ctx, {
    workItemId: state.workItemId,
    workerId: state.procurementWorkerId,
    eventType: "approval_resolved",
    summary: `Owner approved ${payload.selectedName ?? selected?.displayName ?? "contractor"}.`,
    metadata: { decision: "approved", approvalId: approval._id },
  });

  const outbounds = [];
  if (selected?.telegramChatId) {
    outbounds.push({
      personId: selected._id,
      chatId: selected.telegramChatId,
      body: `You are confirmed for the leaking toilet repair. Price ${DEMO_BUDGET.currency} ${payload.price ?? "agreed"}, arrival ${payload.availability ?? "as discussed"}. Reply DONE when finished.`,
    });
  }
  if (tenant?.telegramChatId) {
    outbounds.push({
      personId: tenant._id,
      chatId: tenant.telegramChatId,
      body: `${selected?.displayName ?? "A contractor"} is confirmed for ${payload.availability ?? "today"}. We'll ask you to verify once they report completion.`,
    });
  }
  outbounds.push({ chatId, body: "Approved. Contractor and tenant are being notified." });
  return { handled: true, outbounds };
}

async function handleContractorDone(
  ctx: MutationCtx,
  state: Doc<"demoState">,
  chatId: string,
) {
  if (state.phase !== "awaiting_contractor_done") {
    return {
      handled: true,
      outbounds: [{ chatId, body: "Noted, but the work item is not waiting on contractor completion." }],
    };
  }
  if (state.workItemId) {
    await ctx.db.patch(state.workItemId, { status: "verifying" });
  }
  await ctx.db.patch(state._id, { phase: "awaiting_tenant_verification" });

  const tenantId =
    typeof state.metadata.tenantPersonId === "string"
      ? (state.metadata.tenantPersonId as Id<"people">)
      : undefined;
  const tenant = tenantId ? await ctx.db.get(tenantId) : null;

  return {
    handled: true,
    outbounds: [
      {
        personId: tenant?._id,
        chatId: tenant?.telegramChatId ?? chatId,
        body: "The contractor reported the repair complete. Is the leak actually fixed?",
      },
    ],
  };
}

async function handleTenantVerification(
  ctx: MutationCtx,
  state: Doc<"demoState">,
  chatId: string,
  confirmed = true,
) {
  if (state.phase !== "awaiting_tenant_verification" || !state.workItemId) {
    return { handled: true, outbounds: [{ chatId, body: "Nothing is waiting on tenant verification." }] };
  }

  const workItem = await ctx.db.get(state.workItemId);
  if (!workItem || workItem.status !== "verifying") {
    return {
      handled: true,
      outbounds: [{ chatId, body: "Work cannot close before it is in verification." }],
    };
  }

  if (!confirmed) {
    await emit(ctx, {
      workItemId: state.workItemId,
      workerId: state.operationsWorkerId,
      eventType: "work_verified",
      summary: "Tenant reported the outcome is not fixed.",
      metadata: { verifiedBy: "tenant", confirmed: false },
    });
    await ctx.db.patch(state.workItemId, { status: "in_progress" });
    await ctx.db.patch(state._id, { phase: "awaiting_contractor_done" });
    return {
      handled: true,
      outbounds: [{ chatId, body: "Understood — we will not close this until it is actually fixed." }],
    };
  }

  await emit(ctx, {
    workItemId: state.workItemId,
    workerId: state.operationsWorkerId,
    eventType: "work_verified",
    summary: "Tenant verified the repair outcome.",
    metadata: { verifiedBy: "tenant", confirmed: true },
  });

  await ctx.db.patch(state.workItemId, { status: "completed" });
  if (state.operationsAssignmentId) {
    await ctx.db.patch(state.operationsAssignmentId, { status: "completed" });
  }
  if (state.procurementAssignmentId) {
    await ctx.db.patch(state.procurementAssignmentId, { status: "completed" });
  }

  if (state.operationsWorkerId) {
    const worker = await ctx.db.get(state.operationsWorkerId);
    if (worker) {
      const successfulTasks = worker.successfulTasks + 1;
      const tasksCompleted = worker.tasksCompleted + 1;
      const promotionEligible =
        worker.employmentType !== "permanent" &&
        isPromotionRecommended(successfulTasks, PROMOTION_SUCCESS_THRESHOLD);
      await ctx.db.patch(worker._id, {
        successfulTasks,
        tasksCompleted,
        promotionEligible,
        status: "idle",
      });
      if (state.procurementWorkerId) {
        const procurement = await ctx.db.get(state.procurementWorkerId);
        if (procurement) {
          await ctx.db.patch(procurement._id, { status: "idle" });
        }
      }

      await emit(ctx, {
        workItemId: state.workItemId,
        workerId: worker._id,
        eventType: "work_completed",
        summary: "Work item completed after tenant verification.",
        metadata: { successfulTasks },
      });

      if (promotionEligible) {
        const owner = await ctx.db
          .query("people")
          .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
          .first();
        if (owner) {
          const promotionApprovalId = await ctx.db.insert("approvals", {
            workItemId: state.workItemId,
            requestedFromPersonId: owner._id,
            proposedByWorkerId: worker._id,
            actionType: "promote_worker",
            reason: `${worker.name} now has ${successfulTasks} successful operations assignments.`,
            riskClass: "medium",
            payload: { workerId: worker._id, proposedTitle: DEMO_OPS_WORKER.promotedTitle },
            status: "pending",
            requestedAt: Date.now(),
          });
          await ctx.db.patch(state._id, {
            phase: "awaiting_promotion",
            promotionApprovalId,
          });
          await emit(ctx, {
            workItemId: state.workItemId,
            workerId: worker._id,
            eventType: "promotion_recommended",
            summary: `Recommend retaining ${worker.name} as ${DEMO_OPS_WORKER.promotedTitle}.`,
            metadata: { successfulTasks, threshold: PROMOTION_SUCCESS_THRESHOLD },
          });
          return {
            handled: true,
            outbounds: [
              { chatId, body: "Thanks — marked as verified and complete." },
              {
                personId: owner._id,
                chatId: owner.telegramChatId ?? chatId,
                body: `${worker.name} has ${successfulTasks} successful operations assignments. Reply PROMOTE to retain her as ${DEMO_OPS_WORKER.promotedTitle}.`,
              },
            ],
          };
        }
      }
    }
  }

  await ctx.db.patch(state._id, { phase: "completed" });
  return {
    handled: true,
    outbounds: [{ chatId, body: "Thanks — marked as verified and complete." }],
  };
}

async function handlePromote(
  ctx: MutationCtx,
  state: Doc<"demoState">,
  chatId: string,
  decision: "approved" | "rejected" = "approved",
) {
  if (!state.promotionApprovalId || !state.operationsWorkerId) {
    return { handled: true, outbounds: [{ chatId, body: "There is no pending promotion." }] };
  }
  const approval = await ctx.db.get(state.promotionApprovalId);
  const worker = await ctx.db.get(state.operationsWorkerId);
  if (!approval || !worker) {
    return { handled: true, outbounds: [{ chatId, body: "Promotion records are missing." }] };
  }
  if (decision === "rejected") {
    await ctx.db.patch(approval._id, { status: "rejected", resolvedAt: Date.now() });
    await ctx.db.patch(state._id, { phase: "completed" });
    await emit(ctx, {
      workItemId: state.workItemId,
      workerId: worker._id,
      eventType: "approval_resolved",
      summary: "Owner declined the promotion.",
      metadata: { decision: "rejected", actionType: "promote_worker" },
    });
    return {
      handled: true,
      outbounds: [{ chatId, body: `${worker.name} remains in the current role.` }],
    };
  }
  await ctx.db.patch(approval._id, { status: "approved", resolvedAt: Date.now() });
  await ctx.db.patch(worker._id, {
    title: DEMO_OPS_WORKER.promotedTitle,
    employmentType: DEMO_OPS_WORKER.employmentTypeOnPromote,
    rank: "employee",
    promotionEligible: false,
  });
  await ctx.db.patch(state._id, { phase: "completed" });
  await emit(ctx, {
    workItemId: state.workItemId,
    workerId: worker._id,
    eventType: "approval_resolved",
    summary: "Owner approved the promotion.",
    metadata: { decision: "approved", actionType: "promote_worker" },
  });
  await emit(ctx, {
    workItemId: state.workItemId,
    workerId: worker._id,
    eventType: "worker_promoted",
    summary: `${worker.name} is now ${DEMO_OPS_WORKER.promotedTitle} (permanent).`,
    metadata: {
      title: DEMO_OPS_WORKER.promotedTitle,
      employmentType: "permanent",
    },
  });
  return {
    handled: true,
    outbounds: [
      {
        chatId,
        body: `${worker.name} is now ${DEMO_OPS_WORKER.promotedTitle} (PERMANENT).`,
      },
    ],
  };
}

export const resetDemo = mutation({
  args: {},
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx) => {
    const quotes = await ctx.db.query("contractorQuotes").take(200);
    for (const quote of quotes) {
      await ctx.db.delete(quote._id);
    }
    const states = await ctx.db.query("demoState").take(20);
    for (const state of states) {
      await ctx.db.delete(state._id);
    }
    const messages = await ctx.db.query("messages").take(500);
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await resetTransientDemoRecords(ctx);
    await persistBootstrapDemo(ctx);
    await getOrCreateDemoState(ctx);
    return { ok: true };
  },
});

const uiRankValidator = v.union(
  v.literal("intern"),
  v.literal("permanent"),
  v.literal("senior"),
  v.literal("lead"),
  v.literal("manager"),
);

const uiWorkerStatusValidator = v.union(
  v.literal("idle"),
  v.literal("thinking"),
  v.literal("using_tool"),
  v.literal("waiting_human"),
  v.literal("delegating"),
  v.literal("blocked"),
  v.literal("complete"),
);

const commandCentreSnapshotValidator = v.object({
  phase: v.string(),
  workers: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      title: v.string(),
      employmentType: v.union(v.literal("intern"), v.literal("permanent")),
      rank: uiRankValidator,
      managerAgentId: v.optional(v.string()),
      status: uiWorkerStatusValidator,
      capabilities: v.array(v.string()),
    }),
  ),
  workItem: v.optional(
    v.object({
      id: v.string(),
      title: v.string(),
      tenantCallsign: v.string(),
      status: v.string(),
      budget: v.optional(v.number()),
      deadline: v.optional(v.string()),
      assignedWorkerIds: v.array(v.string()),
      waitingOn: v.optional(v.string()),
      completionVerified: v.boolean(),
    }),
  ),
  events: v.array(
    v.object({
      id: v.string(),
      timestamp: v.number(),
      workerId: v.optional(v.string()),
      workItemId: v.optional(v.string()),
      type: v.string(),
      summary: v.string(),
      detail: v.optional(v.string()),
    }),
  ),
  quotes: v.array(
    v.object({
      id: v.string(),
      contractorCallsign: v.string(),
      price: v.optional(v.number()),
      availability: v.string(),
      withinBudget: v.optional(v.boolean()),
      meetsDeadline: v.optional(v.boolean()),
      viable: v.optional(v.boolean()),
      selected: v.optional(v.boolean()),
      recommendation: v.optional(v.string()),
    }),
  ),
  approval: v.optional(
    v.object({
      status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
      action: v.string(),
      requestedFrom: v.string(),
    }),
  ),
  participants: v.object({
    ownerReady: v.boolean(),
    tenant: v.object({ joined: v.number(), required: v.number() }),
    contractors: v.object({ joined: v.number(), required: v.number() }),
  }),
});

function presentationWorkerId(name: string, fallback: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("alex")) {
    return "alex";
  }
  if (normalized.includes("shu")) {
    return "shu-zhen";
  }
  if (normalized.includes("daniel")) {
    return "daniel";
  }
  return fallback;
}

function presentationRank(rank: string): "intern" | "permanent" | "senior" | "lead" | "manager" {
  if (rank === "employee") {
    return "permanent";
  }
  if (rank === "intern" || rank === "senior" || rank === "lead" || rank === "manager") {
    return rank;
  }
  return "intern";
}

function waitingOnForPhase(phase: string): string | undefined {
  switch (phase) {
    case "awaiting_tenant_diagnosis":
      return "Tenant diagnosis";
    case "soliciting_quotes":
      return "Contractor quotes";
    case "awaiting_owner_approval":
      return "Owner approval";
    case "rejected_resourcing":
      return "Re-source after rejection";
    case "awaiting_contractor_done":
      return "Contractor completion";
    case "awaiting_tenant_verification":
      return "Tenant verification";
    case "awaiting_promotion":
      return "Promotion decision";
    default:
      return undefined;
  }
}

function presentationWorkerStatus(
  worker: Doc<"workers">,
  latestEventType: string | undefined,
  workCompleted: boolean,
): "idle" | "thinking" | "using_tool" | "waiting_human" | "delegating" | "blocked" | "complete" {
  if (workCompleted && worker.status === "idle") {
    return "complete";
  }
  if (worker.status === "blocked") {
    return "blocked";
  }
  if (worker.status === "awaiting_approval") {
    return "waiting_human";
  }
  if (latestEventType === "tool_called") {
    return "using_tool";
  }
  if (latestEventType === "human_contacted") {
    return "waiting_human";
  }
  if (latestEventType === "staffing_requested" || latestEventType === "worker_created") {
    return "delegating";
  }
  if (latestEventType === "work_completed" || latestEventType === "worker_promoted") {
    return "complete";
  }
  if (worker.status === "working") {
    return "thinking";
  }
  return "idle";
}

function approvalActionLabel(approval: Doc<"approvals">): string {
  if (approval.actionType === "confirm_contractor_spend") {
    const payload = approval.payload as { selectedName?: string; price?: number };
    const name = payload.selectedName ?? "contractor";
    const price = typeof payload.price === "number" ? ` at ${DEMO_BUDGET.currency} ${payload.price}` : "";
    return `${approval.reason} Proposed: confirm ${name}${price}.`;
  }
  if (approval.actionType === "promote_worker") {
    return approval.reason;
  }
  return approval.reason || approval.actionType;
}

/**
 * Read-only command-centre projection. Does not decide staffing, ranking,
 * approval, or promotion — it only shapes persisted runtime state for the UI.
 */
export const getCommandCentreSnapshot = query({
  args: {},
  returns: commandCentreSnapshotValidator,
  handler: async (ctx: QueryCtx) => {
    const state = await ctx.db
      .query("demoState")
      .withIndex("by_key", (q) => q.eq("key", DEMO_STATE_KEY))
      .first();

    const workers = await ctx.db.query("workers").take(50);
    const capabilities = await ctx.db.query("capabilities").take(50);
    const people = await ctx.db.query("people").take(50);
    const events = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(80);

    const capabilityNameById = new Map(capabilities.map((capability) => [capability._id, capability.name]));
    const presentationIdByWorkerId = new Map(
      workers.map((worker) => [worker._id, presentationWorkerId(worker.name, worker._id)]),
    );

    const workItems = await ctx.db.query("workItems").take(50);
    const workItem = state?.workItemId
      ? await ctx.db.get(state.workItemId)
      : workItems
          .filter((item) => item.status !== "cancelled")
          .sort((a, b) => b._creationTime - a._creationTime)[0] ?? null;
    const assignments = workItem
      ? await ctx.db
          .query("assignments")
          .withIndex("by_work_item", (q) => q.eq("workItemId", workItem._id))
          .take(20)
      : [];
    const quotes = workItem
      ? await ctx.db
          .query("contractorQuotes")
          .withIndex("by_work_item", (q) => q.eq("workItemId", workItem._id))
          .take(20)
      : [];

    const latestEventTypeByWorker = new Map<string, string>();
    for (const event of events) {
      if (event.workerId && !latestEventTypeByWorker.has(event.workerId)) {
        latestEventTypeByWorker.set(event.workerId, event.eventType);
      }
    }

    const workCompleted = workItem?.status === "completed";
    const presentedWorkers = workers.map((worker) => {
      const managerId = worker.managerWorkerId
        ? presentationIdByWorkerId.get(worker.managerWorkerId)
        : worker.name.toLowerCase().includes("alex")
          ? undefined
          : "alex";
      return {
        id: presentationWorkerId(worker.name, worker._id),
        name: worker.name,
        title: worker.title,
        employmentType: worker.employmentType,
        rank: presentationRank(worker.rank),
        managerAgentId: managerId,
        status: presentationWorkerStatus(
          worker,
          latestEventTypeByWorker.get(worker._id),
          workCompleted,
        ),
        capabilities: worker.capabilityIds
          .map((id) => capabilityNameById.get(id))
          .filter((name): name is string => Boolean(name)),
      };
    });

    const tenantPerson =
      people.find((person) => person.demoCallsign === DEMO_TENANT.demoCallsign) ??
      people.find((person) => person.roleType === "tenant");
    const ownerPerson =
      people.find((person) => person.demoCallsign === DEMO_OWNER.demoCallsign) ??
      people.find((person) => person.roleType === "business_owner");
    const contractorPeople = people.filter((person) => person.roleType === "contractor" && person.active);

    const telegramReady = (person?: Doc<"people"> | null) =>
      Boolean(person?.active && person.telegramChatId);

    const currentApprovalId =
      state?.phase === "awaiting_promotion"
        ? state.promotionApprovalId
        : (state?.approvalId ?? state?.promotionApprovalId);
    const approval = currentApprovalId ? await ctx.db.get(currentApprovalId) : null;

    const approvalRejected = approval?.status === "rejected";
    const selectedContractorId = approvalRejected ? undefined : state?.selectedContractorPersonId;

    const presentedQuotes = quotes.map((quote) => {
      const contractor = people.find((person) => person._id === quote.personId);
      const selected = Boolean(
        selectedContractorId && quote.personId === selectedContractorId,
      ) || Boolean(!approvalRejected && selectedContractorId === undefined && quote.rank === 1);
      return {
        id: quote._id,
        contractorCallsign: contractor?.displayName ?? contractor?.demoCallsign ?? "Contractor",
        price: quote.price,
        availability: quote.availability ?? "Awaiting availability",
        withinBudget: quote.withinBudget,
        meetsDeadline: quote.meetsDeadline,
        viable: quote.viable,
        selected,
        recommendation: selected
          ? quote.rejectedReason
            ? undefined
            : "Recommended by procurement"
          : quote.rejectedReason,
      };
    });

    return {
      phase: state?.phase ?? "idle",
      workers: presentedWorkers,
      workItem: workItem
        ? {
            id: workItem._id,
            title: workItem.objective,
            tenantCallsign: tenantPerson?.displayName ?? DEMO_TENANT.displayName,
            status: workItem.status,
            budget: workItem.budget?.amount ?? DEMO_BUDGET.amount,
            deadline:
              workItem.constraints.find((constraint) => /today|deadline/i.test(constraint)) ??
              DEMO_DEADLINE_LABEL,
            assignedWorkerIds: assignments.map(
              (assignment) =>
                presentationIdByWorkerId.get(assignment.workerId) ?? assignment.workerId,
            ),
            waitingOn: waitingOnForPhase(state?.phase ?? "idle"),
            completionVerified: workItem.status === "completed",
          }
        : undefined,
      events: events.map((event) => ({
        id: event._id,
        timestamp: event.timestamp,
        workerId: event.workerId ? presentationIdByWorkerId.get(event.workerId) : undefined,
        workItemId: event.workItemId,
        type: event.eventType,
        summary: event.summary,
      })),
      quotes: presentedQuotes,
      approval: approval
        ? {
            status: approval.status,
            action: approvalActionLabel(approval),
            requestedFrom: ownerPerson?.displayName ?? "Business Owner",
          }
        : undefined,
      participants: {
        ownerReady: telegramReady(ownerPerson),
        tenant: { joined: telegramReady(tenantPerson) ? 1 : 0, required: 1 },
        contractors: {
          joined: Math.min(
            contractorPeople.filter((person) => telegramReady(person)).length,
            3,
          ),
          required: 3,
        },
      },
    };
  },
});

