import { v } from "convex/values";

import { query } from "./_generated/server";
import { workerDocumentValidator } from "./model/validators";

export const list = query({
  args: {},
  returns: v.array(workerDocumentValidator),
  handler: async (ctx) => {
    return await ctx.db.query("workers").order("asc").take(100);
  },
});
