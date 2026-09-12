/**
 * @vitest-environment edge-runtime
 *
 * Disposable in-memory proof that resetDemo returns the board to the permanent
 * crew only. Not a cloud deployment — safe to run without touching live data.
 */
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const NODE_ONLY = ["agentRuntime", "agentSpike", "messagingOutbound"];
const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(
    ([path]) => !NODE_ONLY.some((name) => path.includes(name)),
  ),
);

const PROOF_SECRET = "dispose-reset-proof-secret";

type Harness = TestConvex<typeof schema>;

describe("resetDemo disposable proof", () => {
  beforeEach(() => {
    process.env.DEMO_ADMIN_SECRET = PROOF_SECRET;
  });

  afterEach(() => {
    delete process.env.DEMO_ADMIN_SECRET;
  });

  test("wipes Daniel, tenant, and contractors; unbinds owner; keeps Alex + Shu Zhen", async () => {
    const t: Harness = convexTest(schema, modules);

    await t.mutation(api.seed.bootstrapDemo, { adminSecret: PROOF_SECRET });

    const { personId: tenantId } = await t.mutation(
      internal.agentState.ensureDemoTenant,
      {},
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(tenantId, { telegramChatId: "chat-tenant-proof" });
      const owner = await ctx.db
        .query("people")
        .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", "OWNER"))
        .first();
      if (!owner) {
        throw new Error("Owner missing before reset proof");
      }
      await ctx.db.patch(owner._id, { telegramChatId: "chat-owner-proof" });
    });

    await t.mutation(internal.agentState.staffWork, {
      objective: "The toilet in unit 12B is leaking onto the floor.",
      requestedByPersonId: tenantId,
      capabilityKeys: ["maintenance_triage", "stakeholder_messaging"],
    });

    await t.mutation(internal.agentState.requestStaffing, {
      capabilityKeys: ["vendor_sourcing"],
      reason: "Need contractor quotes for the leak.",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("people", {
        displayName: "Contractor A",
        roleType: "contractor",
        demoCallsign: "CONTRACTOR_A",
        telegramChatId: "chat-contractor-a-proof",
        active: true,
      });
    });

    const beforeWorkers = await t.query(api.workers.list, {});
    const beforeNames = beforeWorkers.map((worker) => worker.name).sort();
    expect(beforeNames).toEqual(["Alex", "Daniel", "Shu Zhen"]);

    const beforeSnapshot = await t.query(
      api.demoRuntime.getCommandCentreSnapshot,
      {},
    );
    expect(beforeSnapshot.participants.ownerReady).toBe(true);
    expect(beforeSnapshot.participants.tenant.joined).toBeGreaterThanOrEqual(1);
    expect(beforeSnapshot.participants.contractors.joined).toBeGreaterThanOrEqual(1);

    // Simulate historical identity drift so we can see whether the Alex
    // re-patch in resetTransientDemoRecords actually repairs anything.
    await t.run(async (ctx) => {
      const alex = await ctx.db
        .query("workers")
        .withIndex("by_name", (q) => q.eq("name", "Alex"))
        .first();
      if (!alex) {
        throw new Error("Alex missing before corruption probe");
      }
      await ctx.db.patch(alex._id, {
        title: "CORRUPTED",
        employmentType: "intern",
        rank: "intern",
      });
    });

    await t.mutation(api.demoRuntime.resetDemo, {});

    const afterWorkers = await t.query(api.workers.list, {});
    expect(afterWorkers.map((worker) => worker.name).sort()).toEqual([
      "Alex",
      "Shu Zhen",
    ]);

    const alex = afterWorkers.find((worker) => worker.name === "Alex");
    expect(alex).toMatchObject({
      title: "General Manager",
      employmentType: "permanent",
      rank: "manager",
    });

    const shuZhen = afterWorkers.find((worker) => worker.name === "Shu Zhen");
    expect(shuZhen).toMatchObject({
      title: "Property Operations Executive",
      employmentType: "permanent",
      rank: "employee",
    });

    const people = await t.run(async (ctx) => ctx.db.query("people").take(50));
    const roles = people.map((person) => person.roleType).sort();
    expect(roles).toEqual(["business_owner"]);
    expect(people.some((person) => person.demoCallsign === "TENANT")).toBe(false);
    expect(people.some((person) => person.roleType === "contractor")).toBe(false);
    expect(afterWorkers.some((worker) => worker.name === "Daniel")).toBe(false);
    expect(people[0]?.telegramChatId).toBeUndefined();

    const afterSnapshot = await t.query(
      api.demoRuntime.getCommandCentreSnapshot,
      {},
    );
    expect(afterSnapshot.participants.ownerReady).toBe(false);
    expect(afterSnapshot.participants.tenant).toEqual({
      joined: 0,
      required: 1,
    });
    expect(afterSnapshot.participants.contractors).toEqual({
      joined: 0,
      required: 3,
    });
  });

  test("no live demo path mutates Alex title/employmentType/rank", async () => {
    const t: Harness = convexTest(schema, modules);
    await t.mutation(api.seed.bootstrapDemo, { adminSecret: PROOF_SECRET });

    const { personId: tenantId } = await t.mutation(
      internal.agentState.ensureDemoTenant,
      {},
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(tenantId, { telegramChatId: "chat-tenant-id-probe" });
    });
    await t.mutation(internal.agentState.staffWork, {
      objective: "The toilet keeps leaking.",
      requestedByPersonId: tenantId,
      capabilityKeys: ["maintenance_triage", "stakeholder_messaging"],
    });
    await t.mutation(internal.agentState.requestStaffing, {
      capabilityKeys: ["vendor_sourcing"],
      reason: "quotes",
    });

    const alex = (await t.query(api.workers.list, {})).find(
      (worker) => worker.name === "Alex",
    );
    expect(alex).toMatchObject({
      title: "General Manager",
      employmentType: "permanent",
      rank: "manager",
    });
  });
});
