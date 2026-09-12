/**
 * @vitest-environment edge-runtime
 *
 * Convex-level regression for the demo orchestration lanes. These exercise the real
 * mutations against the convex-test in-memory database, covering wiring that the pure
 * function tests under src/ cannot reach.
 */
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// agentRuntime/agentSpike/messagingOutbound are "use node" modules that pull in the
// OpenAI agents SDK. The Convex runtime never loads them alongside these mutations,
// and neither should the test harness.
const NODE_ONLY = ["agentRuntime", "agentSpike", "messagingOutbound"];
const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(
    ([path]) => !NODE_ONLY.some((name) => path.includes(name)),
  ),
);

type Harness = TestConvex<typeof schema>;

async function seedDemo(): Promise<Harness> {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const { persistBootstrapDemo } = await import("./seed");
    await persistBootstrapDemo(ctx);
  });
  return t;
}

async function workerNames(t: Harness): Promise<string[]> {
  return await t.run(async (ctx) => {
    const workers = await ctx.db.query("workers").take(50);
    return workers.map((worker) => worker.name);
  });
}

async function demoState(t: Harness) {
  return await t.run(async (ctx) => {
    const state = await ctx.db.query("demoState").first();
    if (!state) {
      throw new Error("demoState was never created.");
    }
    return state;
  });
}

/** Register the tenant with a Telegram chat and file the leaking-toilet work request. */
async function openTenantWork(t: Harness) {
  const { personId: tenantId } = await t.mutation(internal.agentState.ensureDemoTenant, {});
  await t.run(async (ctx) => {
    await ctx.db.patch(tenantId, { telegramChatId: "chat-tenant" });
  });
  const staffed = await t.mutation(internal.agentState.staffWork, {
    objective: "The toilet in unit 12B is leaking onto the floor.",
    requestedByPersonId: tenantId,
    capabilityKeys: ["maintenance_triage", "stakeholder_messaging"],
  });
  return { tenantId, staffed };
}

async function joinContractor(t: Harness, callsign: string, chatId: string) {
  return await t.run(async (ctx) =>
    ctx.db.insert("people", {
      displayName: `Contractor ${callsign}`,
      roleType: "contractor",
      demoCallsign: callsign,
      telegramChatId: chatId,
      active: true,
    }),
  );
}

async function giveOwnerAChat(t: Harness) {
  await t.run(async (ctx) => {
    const owner = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
      .first();
    if (owner) {
      await ctx.db.patch(owner._id, { telegramChatId: "chat-owner" });
    }
  });
}

/**
 * Mirror of the agentRuntime bridge: record_option owns automatic ranking and
 * reporting, and only fires while the mutation says the round is still open.
 */
async function recordQuoteLikeBridge(
  t: Harness,
  input: { personId: Id<"people">; price: number; availability: string; rawMessage: string },
) {
  const result = await t.mutation(internal.agentState.recordOption, {
    personId: input.personId,
    price: input.price,
    availability: input.availability,
    rawMessage: input.rawMessage,
  });
  if (result.ok && result.readyToEvaluate) {
    await t.mutation(internal.agentState.evaluateOptions, {});
    await t.mutation(internal.agentState.reportRecommendation, {
      summary: `Ranked ${result.recordedCount} of ${result.quotesNeeded} joined contractor quotes.`,
    });
  }
  return result;
}

describe("initial staffing", () => {
  test("seeds Shu Zhen as permanent operations and no Daniel", async () => {
    const t = await seedDemo();

    const names = await workerNames(t);
    expect(names).toEqual(expect.arrayContaining(["Alex", "Shu Zhen"]));
    expect(names).not.toContain("Daniel");

    const shuZhen = await t.run(async (ctx) =>
      ctx.db
        .query("workers")
        .withIndex("by_name", (q) => q.eq("name", "Shu Zhen"))
        .first(),
    );
    expect(shuZhen?.employmentType).toBe("permanent");
  });
});

describe("tenant work intake", () => {
  test("a tenant work request stays assigned to Shu Zhen", async () => {
    const t = await seedDemo();
    const { staffed } = await openTenantWork(t);

    expect(staffed.workerName).toBe("Shu Zhen");

    const state = await demoState(t);
    expect(state.phase).toBe("awaiting_tenant_diagnosis");

    const assignedNames = await t.run(async (ctx) => {
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_work_item", (q) => q.eq("workItemId", staffed.workItemId))
        .take(20);
      const names: string[] = [];
      for (const assignment of assignments) {
        const worker = await ctx.db.get(assignment.workerId);
        if (worker) {
          names.push(worker.name);
        }
      }
      return names;
    });

    expect(assignedNames).toEqual(["Shu Zhen"]);
  });
});

describe("procurement staffing", () => {
  test("requestStaffing vendor_sourcing staffs Daniel immediately and only once", async () => {
    const t = await seedDemo();
    await openTenantWork(t);

    expect(await workerNames(t)).not.toContain("Daniel");

    await t.mutation(internal.agentState.requestStaffing, {
      capabilityKeys: ["vendor_sourcing"],
      reason: "Need contractor quotes for the leak.",
    });

    const afterFirst = await workerNames(t);
    expect(afterFirst.filter((name) => name === "Daniel")).toHaveLength(1);

    // Staffing happened inline, so the manager follow-up must not still be armed.
    const state = await demoState(t);
    expect(state.metadata.pendingManagerFollowUp).toBe(false);
    expect(state.metadata.pendingStaffingCapabilityKeys).toEqual([]);
    expect(state.procurementWorkerId).toBeDefined();

    await t.mutation(internal.agentState.requestStaffing, {
      capabilityKeys: ["vendor_sourcing"],
      reason: "Repeat request from a retried agent turn.",
    });
    await t.mutation(internal.agentState.requestStaffing, {
      capabilityKeys: ["vendor_sourcing"],
      reason: "Third retry.",
    });

    const afterRepeats = await workerNames(t);
    expect(afterRepeats.filter((name) => name === "Daniel")).toHaveLength(1);
  });
});

describe("short contractor crew", () => {
  test("no joined contractor leaves the round unopened", async () => {
    const t = await seedDemo();
    await openTenantWork(t);

    const targets = await t.mutation(internal.agentState.solicitOptions, {
      body: "Need a plumber today, budget S$150.",
    });

    expect(targets).toEqual([]);
    // Phase must not advance, so the runtime can re-solicit once someone joins.
    expect((await demoState(t)).phase).toBe("awaiting_tenant_diagnosis");
  });

  test("waiting notice reaches the tenant on the operations escalation path", async () => {
    const t = await seedDemo();
    const { tenantId } = await openTenantWork(t);

    const notice = await t.mutation(internal.agentState.notifyWaitingForContractors, {});

    expect(notice.personId).toBe(tenantId);
    expect(notice.chatId).toBe("chat-tenant");
    expect(notice.body).toMatch(/no contractors are available/i);
    expect(notice.body).not.toMatch(/QR|Daniel/i);
  });

  test("one contractor plus one quote is ready to rank", async () => {
    const t = await seedDemo();
    await openTenantWork(t);
    const contractorId = await joinContractor(t, "CONTRACTOR_A", "chat-contractor-a");

    const targets = await t.mutation(internal.agentState.solicitOptions, {
      body: "Need a plumber today, budget S$150.",
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.chatId).toBe("chat-contractor-a");
    expect((await demoState(t)).phase).toBe("soliciting_quotes");

    const recorded = await t.mutation(internal.agentState.recordOption, {
      personId: contractorId,
      price: 120,
      availability: "today 4pm",
      rawMessage: "Can come today 4pm, 120 dollars.",
    });

    expect(recorded.ok).toBe(true);
    expect(recorded.quotesNeeded).toBe(1);
    expect(recorded.recordedCount).toBe(1);
    expect(recorded.readyToEvaluate).toBe(true);

    const ranked = await t.mutation(internal.agentState.evaluateOptions, {});
    expect(ranked.winnerPersonId).toBe(contractorId);
  });
});

describe("stakeholder targeting", () => {
  test("cross-lane sends resolve to no Telegram target", async () => {
    const t = await seedDemo();
    const { tenantId } = await openTenantWork(t);
    const contractorId = await joinContractor(t, "CONTRACTOR_A", "chat-contractor-a");
    await giveOwnerAChat(t);

    // Positive control: operations may text the tenant.
    const toTenant = await t.mutation(internal.agentState.sendIntent, {
      roleType: "tenant",
      body: "Does it leak continuously or only after flushing?",
      agentKind: "operations",
      inboundPersonId: tenantId,
    });
    expect(toTenant.chatId).toBe("chat-tenant");
    expect(toTenant.personId).toBe(tenantId);

    // Operations must not copy tenant traffic to the owner, under any spelling.
    for (const roleType of ["business_owner", "owner", "OWNER", "Tim", "None"]) {
      const blocked = await t.mutation(internal.agentState.sendIntent, {
        roleType,
        body: "FYI the tenant reported a leak.",
        agentKind: "operations",
        inboundPersonId: tenantId,
      });
      expect(blocked.chatId, `operations -> ${roleType}`).toBeUndefined();
      expect(blocked.personId, `operations -> ${roleType}`).toBeUndefined();
    }

    // Operations must not hand owner or tenant copy to a contractor mid-sourcing.
    const opsToContractor = await t.mutation(internal.agentState.sendIntent, {
      roleType: "contractor",
      body: "The owner said the budget is soft.",
      agentKind: "operations",
      inboundPersonId: tenantId,
    });
    expect(opsToContractor.chatId).toBeUndefined();

    // Procurement talks to contractors only.
    const procurementToTenant = await t.mutation(internal.agentState.sendIntent, {
      roleType: "tenant",
      body: "Here are the quotes I collected.",
      agentKind: "procurement",
      inboundPersonId: contractorId,
    });
    expect(procurementToTenant.chatId).toBeUndefined();

    const procurementToOwner = await t.mutation(internal.agentState.sendIntent, {
      roleType: "business_owner",
      body: "Approve 120?",
      agentKind: "procurement",
      inboundPersonId: contractorId,
    });
    expect(procurementToOwner.chatId).toBeUndefined();

    const procurementToContractor = await t.mutation(internal.agentState.sendIntent, {
      roleType: "contractor",
      body: "Thanks, noted.",
      agentKind: "procurement",
      inboundPersonId: contractorId,
    });
    expect(procurementToContractor.chatId).toBe("chat-contractor-a");
  });

  test("an unresolvable send never falls back to the inbound chat", async () => {
    const t = await seedDemo();
    const { tenantId } = await openTenantWork(t);

    const invented = await t.mutation(internal.agentState.sendIntent, {
      roleType: "Tim",
      body: "Routing this to whoever.",
      agentKind: "operations",
      inboundPersonId: tenantId,
    });

    // No personId and no chatId means the agentRuntime sendResolved helper is a
    // no-op, rather than echoing owner copy back into the tenant chat.
    expect(invented.personId).toBeUndefined();
    expect(invented.chatId).toBeUndefined();
    expect(invented.body).toBe("Routing this to whoever.");
  });
});

describe("single-owner ranking and reporting", () => {
  test("repeat quotes and repeat agent calls do not duplicate approvals", async () => {
    const t = await seedDemo();
    await openTenantWork(t);
    const contractorA = await joinContractor(t, "CONTRACTOR_A", "chat-contractor-a");
    await giveOwnerAChat(t);
    await t.mutation(internal.agentState.solicitOptions, {
      body: "Need a plumber today, budget S$150.",
    });

    const first = await recordQuoteLikeBridge(t, {
      personId: contractorA,
      price: 120,
      availability: "today 4pm",
      rawMessage: "Can come today 4pm, 120 dollars.",
    });
    expect(first.readyToEvaluate).toBe(true);

    const armed = await demoState(t);
    expect(armed.metadata.pendingManagerFollowUp).toBe(true);
    const firstSummary = armed.metadata.recommendationSummary;

    // The model may also call report_recommendation itself. That must be a no-op.
    await t.mutation(internal.agentState.reportRecommendation, {
      summary: "I recommend Contractor A at 120.",
    });
    const afterModelReport = await demoState(t);
    expect(afterModelReport.metadata.recommendationSummary).toBe(firstSummary);

    await t.mutation(internal.agentState.consumeManagerFollowUp, {});

    // A second contractor joining and quoting must not re-arm the manager.
    const contractorB = await joinContractor(t, "CONTRACTOR_B", "chat-contractor-b");
    const second = await recordQuoteLikeBridge(t, {
      personId: contractorB,
      price: 90,
      availability: "today 6pm",
      rawMessage: "I can do it today 6pm for 90.",
    });
    expect(second.ok).toBe(true);
    expect(second.readyToEvaluate).toBe(false);
    expect((await demoState(t)).metadata.pendingManagerFollowUp).toBe(false);

    // Approvals are opened once, even when the manager follow-up runs twice.
    const firstApproval = await t.mutation(internal.agentState.requestApproval, {
      reason: "Contractor A at S$120 today.",
    });
    const secondApproval = await t.mutation(internal.agentState.requestApproval, {
      reason: "Contractor A at S$120 today (retry).",
    });
    expect(secondApproval.approvalId).toBe(firstApproval.approvalId);

    const approvalCount = await t.run(async (ctx) => {
      const rows = await ctx.db.query("approvals").take(20);
      return rows.filter((row) => row.actionType === "confirm_contractor_spend").length;
    });
    expect(approvalCount).toBe(1);
  });

  test("a fresh solicitation opens a new reporting round", async () => {
    const t = await seedDemo();
    await openTenantWork(t);
    const contractorA = await joinContractor(t, "CONTRACTOR_A", "chat-contractor-a");
    await t.mutation(internal.agentState.solicitOptions, { body: "Quotes please." });
    await recordQuoteLikeBridge(t, {
      personId: contractorA,
      price: 120,
      availability: "today 4pm",
      rawMessage: "Today 4pm, 120.",
    });
    expect((await demoState(t)).metadata.recommendationReportedAt).toBeDefined();

    // After a rejection the manager re-sources, which must allow one more report.
    await t.mutation(internal.agentState.solicitOptions, {
      body: "Re-sourcing, quotes please.",
    });
    expect((await demoState(t)).metadata.recommendationReportedAt).toBeUndefined();

    const reopened = await t.mutation(internal.agentState.recordOption, {
      personId: contractorA,
      price: 110,
      availability: "today 5pm",
      rawMessage: "Today 5pm, 110.",
    });
    expect(reopened.readyToEvaluate).toBe(true);
  });

  test("owner rejection clears the recommendation round marker without re-soliciting", async () => {
    const t = await seedDemo();
    await openTenantWork(t);
    const contractorA = await joinContractor(t, "CONTRACTOR_A", "chat-contractor-a");
    await giveOwnerAChat(t);
    await t.mutation(internal.agentState.solicitOptions, { body: "Quotes please." });
    await recordQuoteLikeBridge(t, {
      personId: contractorA,
      price: 120,
      availability: "today 4pm",
      rawMessage: "Today 4pm, 120.",
    });
    expect((await demoState(t)).metadata.recommendationReportedAt).toBeDefined();

    await t.mutation(internal.agentState.requestApproval, {
      reason: "Contractor A at S$120 today.",
    });
    const ownerId = await t.run(async (ctx) => {
      const owner = await ctx.db
        .query("people")
        .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
        .first();
      if (!owner) {
        throw new Error("OWNER was not seeded.");
      }
      return owner._id;
    });
    await t.mutation(internal.agentState.resolveApproval, {
      decision: "rejected",
      actorPersonId: ownerId,
    });

    const afterReject = await demoState(t);
    expect(afterReject.phase).toBe("rejected_resourcing");
    expect(afterReject.metadata.recommendationReportedAt).toBeUndefined();

    // Re-rank without a fresh solicit must not be silently blocked.
    const reopened = await t.mutation(internal.agentState.recordOption, {
      personId: contractorA,
      price: 95,
      availability: "today 3pm",
      rawMessage: "Today 3pm, 95.",
    });
    expect(reopened.readyToEvaluate).toBe(true);
  });
});
