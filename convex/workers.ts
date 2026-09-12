import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { workerDocumentValidator } from "./model/validators";

export const list = query({
  args: {},
  returns: v.array(workerDocumentValidator),
  handler: async (ctx) => {
    return await ctx.db.query("workers").order("asc").take(100);
  },
});

/** S2 realtime proof only — inserts a disposable worker row. */
export const createRealtimeProbe = mutation({
  args: {},
  returns: v.id("workers"),
  handler: async (ctx) => {
    const stamp = Date.now();
    return await ctx.db.insert("workers", {
      name: `Probe ${stamp}`,
      title: "Realtime Probe",
      employmentType: "intern",
      rank: "intern",
      status: "idle",
      capabilityIds: [],
      toolPermissionIds: [],
      personality: "Temporary S2 probe worker.",
      communicationStyle: "N/A",
      standingInstructions: ["S2 realtime proof only"],
      tasksCompleted: 0,
      successfulTasks: 0,
      promotionEligible: false,
    });
  },
});