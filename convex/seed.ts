import { v } from "convex/values";

import { CONTROLLED_CAPABILITIES } from "../src/core/workforce/capabilityCatalog";
import { mutation } from "./_generated/server";

const DEMO_COMPANY_NAME = "Army of Interns Demo";
const DEMO_OWNER_CALLSIGN = "OWNER";
const DEMO_MANAGER_NAME = "Alex";

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
  handler: async (ctx) => {
    const existingOwner = await ctx.db
      .query("people")
      .withIndex("by_demo_callsign", (q) => q.eq("demoCallsign", DEMO_OWNER_CALLSIGN))
      .first();
    const ownerPersonId =
      existingOwner?._id ??
      (await ctx.db.insert("people", {
        displayName: "Demo Business Owner",
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
        personality: "Calm, pragmatic, and outcome-oriented.",
        communicationStyle: "Concise and clear.",
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
  },
});