import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import {
  getTelegramBotIdentity,
  readTelegramOutboundConfig,
  sendTelegramMessage,
  setTelegramWebhook,
  telegramParticipantAddress,
  validateSendTelegramInput,
} from "../src/integrations/telegram";

const sendResultValidator = v.object({
  messageId: v.id("messages"),
  providerMessageId: v.string(),
  status: v.string(),
});

export const sendToChat = internalAction({
  args: {
    chatId: v.string(),
    body: v.string(),
    personId: v.optional(v.id("people")),
  },
  returns: sendResultValidator,
  handler: async (ctx, args): Promise<{
    messageId: Id<"messages">;
    providerMessageId: string;
    status: string;
  }> => {
    const input = validateSendTelegramInput({ chatId: args.chatId, body: args.body });
    const config = readTelegramOutboundConfig(process.env);
    const result = await sendTelegramMessage(config, input);
    const messageId: Id<"messages"> = await ctx.runMutation(
      internal.messaging.recordOutbound,
      {
        providerMessageId: result.providerMessageId,
        participantAddress: telegramParticipantAddress(result.chatId),
        body: result.body,
        status: "sent",
        personId: args.personId,
        provider: "telegram",
        channel: "telegram",
      },
    );
    return {
      messageId,
      providerMessageId: result.providerMessageId,
      status: result.status,
    };
  },
});

/**
 * Application-level outbound: person reference + text.
 * Adapter resolves the Telegram chat id.
 */
export const sendToPerson = action({
  args: {
    personId: v.id("people"),
    body: v.string(),
  },
  returns: sendResultValidator,
  handler: async (ctx, args): Promise<{
    messageId: Id<"messages">;
    providerMessageId: string;
    status: string;
  }> => {
    const person = await ctx.runQuery(internal.demoRuntime.getPerson, {
      personId: args.personId,
    });
    if (!person?.telegramChatId) {
      throw new Error("That person has no Telegram chat mapping.");
    }
    return await ctx.runAction(internal.telegram.sendToChat, {
      chatId: person.telegramChatId,
      body: args.body,
      personId: args.personId,
    });
  },
});

export const configureWebhook = action({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    webhookUrl: v.string(),
    botUsername: v.optional(v.string()),
  }),
  handler: async () => {
    const config = readTelegramOutboundConfig(process.env);
    const siteUrl = process.env.CONVEX_SITE_URL?.replace(/\/$/, "");
    if (!siteUrl) {
      throw new Error("CONVEX_SITE_URL is not available on this deployment.");
    }
    const webhookUrl = `${siteUrl}/telegram/webhook`;
    await setTelegramWebhook(config, webhookUrl);
    const identity = await getTelegramBotIdentity(config);
    return {
      ok: true,
      webhookUrl,
      botUsername: identity.username,
    };
  },
});
