import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  eventDocumentValidator,
  metadataValidator,
  structuredEventTypeValidator,
} from "./model/validators";

export const list = query({
  args: {},
  returns: v.array(eventDocumentValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
  },
});

export const create = mutation({
  args: {
    workerId: v.optional(v.id("workers")),
    workItemId: v.optional(v.id("workItems")),
    eventType: structuredEventTypeValidator,
    summary: v.string(),
    metadata: v.optional(metadataValidator),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    if (args.workerId && !(await ctx.db.get(args.workerId))) {
      throw new ConvexError("The event worker does not exist.");
    }
    if (args.workItemId && !(await ctx.db.get(args.workItemId))) {
      throw new ConvexError("The event work item does not exist.");
    }

    return await ctx.db.insert("events", {
      timestamp: Date.now(),
      workerId: args.workerId,
      workItemId: args.workItemId,
      eventType: args.eventType,
      summary: args.summary,
      metadata: args.metadata ?? {},
    });
  },
});
