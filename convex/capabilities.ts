import { v } from "convex/values";

import { query } from "./_generated/server";
import { capabilityDocumentValidator } from "./model/validators";

export const list = query({
  args: {},
  returns: v.array(capabilityDocumentValidator),
  handler: async (ctx) => {
    return await ctx.db.query("capabilities").take(100);
  },
});
