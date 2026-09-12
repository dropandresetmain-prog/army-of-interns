import { v } from "convex/values";

import { query } from "./_generated/server";
import { assignmentDocumentValidator } from "./model/validators";

export const list = query({
  args: {},
  returns: v.array(assignmentDocumentValidator),
  handler: async (ctx) => {
    return await ctx.db.query("assignments").order("desc").take(100);
  },
});
