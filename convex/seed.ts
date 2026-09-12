import { v } from "convex/values";

import { CONTROLLED_CAPABILITIES } from "../src/core/workforce/capabilityCatalog";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";

const DEMO_COMPANY_NAME = "Army of Interns Demo";
const DEMO_OWNER_CALLSIGN = "OWNER";
const DEMO_MANAGER_NAME = "Alex";

export async function persistBootstrapDemo(ctx: MutationCtx) {
    const existingOwner = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", DEMO_OWNER_CALLSIGN))
      .first();
    const ownerPersonId =
      existingOwner?._id ??
      (await ctx.db.insert("people", {
        displayName: "Tim",
        roleType: "business_owner",
        demoCallsign: DEMO_OWNER_CALLSIGN,
        active: true,
      }));

    const existingCompany = await ctx.db
      .query("companyProfiles")
      .withIndex("by_name", (q) => q.eq("name", DEMO_COMPANY_NAME))
      .first();
    const companyId =
      existingCompany?._id ??
      (await ctx.db.insert("companyProfiles", {
        name: DEMO_COMPANY_NAME,
        businessDescription: "A generic SME used to exercise the shared workforce contracts.",
        ownerPersonId,
        operatingPolicies: {},
        approvalPolicies: {},
        terminology: {},
        availableToolIds: [],
      }));

    const existingManager = await ctx.db
      .query("workers")
      .withIndex("by_name", (q) => q.eq("name", DEMO_MANAGER_NAME))
      .first();
    const managerWorkerId =
      existingManager?._id ??
      (await ctx.db.insert("workers", {
        name: DEMO_MANAGER_NAME,
        title: "General Manager",
        employmentType: "permanent",
        rank: "manager",
        status: "idle",
        capabilityIds: [],
        toolPermissionIds: [],
        personality: "Calm, concise, pragmatic, and lightly cheeky.",
        communicationStyle: "Manages outcomes. Does not over-explain.",
        standingInstructions: [
          "Understand the requested outcome before delegating work.",
          "Escalate actions that require human authority.",
        ],
        tasksCompleted: 0,
        successfulTasks: 0,
        promotionEligible: false,
      }));

    let capabilityCount = 0;
    for (const definition of CONTROLLED_CAPABILITIES) {
      const existing = await ctx.db
        .query("capabilities")
        .withIndex("by_key", (q) => q.eq("key", definition.key))
        .first();
      if (!existing) {
        await ctx.db.insert("capabilities", {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          defaultToolPermissionIds: [...definition.defaultToolPermissionIds],
        });
      }
      capabilityCount += 1;
    }

    return {
      companyId,
      ownerPersonId,
      managerWorkerId,
      createdCompany: existingCompany === null,
      createdOwner: existingOwner === null,
      createdManager: existingManager === null,
      capabilityCount,
    };
}

export const bootstrapDemo = mutation({
  args: {},
  returns: v.object({
    companyId: v.id("companyProfiles"),
    ownerPersonId: v.id("people"),
    managerWorkerId: v.id("workers"),
    createdCompany: v.boolean(),
    createdOwner: v.boolean(),
    createdManager: v.boolean(),
    capabilityCount: v.number(),
  }),
  handler: persistBootstrapDemo,
});

/**
 * Clear transient workforce/demo execution state while keeping seeded
 * company, owner, Alex, and controlled capabilities. Used by verification
 * and live demo reset — not a schema change.
 */
export async function resetTransientDemoRecords(ctx: MutationCtx) {
    let deletedWorkers = 0;
    let deletedWorkItems = 0;
    let deletedAssignments = 0;
    let deletedApprovals = 0;
    let deletedEvents = 0;

    const workers = await ctx.db.query("workers").take(500);
    for (const worker of workers) {
      if (worker.name === DEMO_MANAGER_NAME) {
        await ctx.db.patch(worker._id, {
          status: "idle",
          tasksCompleted: 0,
          successfulTasks: 0,
          promotionEligible: false,
        });
        continue;
      }
      await ctx.db.delete(worker._id);
      deletedWorkers += 1;
    }

    const workItems = await ctx.db.query("workItems").take(500);
    for (const workItem of workItems) {
      await ctx.db.delete(workItem._id);
      deletedWorkItems += 1;
    }

    const assignments = await ctx.db.query("assignments").take(500);
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
      deletedAssignments += 1;
    }

    const approvals = await ctx.db.query("approvals").take(500);
    for (const approval of approvals) {
      await ctx.db.delete(approval._id);
      deletedApprovals += 1;
    }

    const events = await ctx.db.query("events").take(500);
    for (const event of events) {
      await ctx.db.delete(event._id);
      deletedEvents += 1;
    }

    return {
      deletedWorkers,
      deletedWorkItems,
      deletedAssignments,
      deletedApprovals,
      deletedEvents,
    };
}

export const resetTransientDemoState = mutation({
  args: {},
  returns: v.object({
    deletedWorkers: v.number(),
    deletedWorkItems: v.number(),
    deletedAssignments: v.number(),
    deletedApprovals: v.number(),
    deletedEvents: v.number(),
  }),
  handler: resetTransientDemoRecords,
});