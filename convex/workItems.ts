import { v } from "convex/values";

import { query } from "./_generated/server";
import { workItemDocumentValidator } from "./model/validators";

export const list = query({
  args: {},
  returns: v.array(workItemDocumentValidator),
  handler: async (ctx) => {
    return await ctx.db.query("workItems").order("desc").take(100);
  },
});
