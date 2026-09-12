import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const routeInbound = internalAction({
  args: {
    messageId: v.id("messages"),
    chatId: v.string(),
  },
  returns: v.object({
    outboundCount: v.number(),
  }),
  handler: async (ctx, args): Promise<{ outboundCount: number }> => {
    const result = await ctx.runAction(internal.agentRuntime.handleInbound, {
      messageId: args.messageId,
      chatId: args.chatId,
    });
    return { outboundCount: result.outboundCount };
  },
});
