import { v } from "convex/values";

import { query } from "./_generated/server";
import { companyProfileDocumentValidator } from "./model/validators";

export const get = query({
  args: {},
  returns: v.union(companyProfileDocumentValidator, v.null()),
  handler: async (ctx) => {
    return await ctx.db.query("companyProfiles").first();
  },
});
