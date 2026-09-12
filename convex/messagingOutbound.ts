"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import {
  normalizeWhatsAppAddress,
  readTwilioOutboundConfig,
  sendWhatsAppMessage,
  validateSendWhatsAppInput,
} from "../src/integrations/twilio";

const DEFAULT_TEST_BODY = "Army of Interns test 🫡";

/**
 * Minimal outbound WhatsApp send through the Twilio adapter.
 * Application inputs only — Twilio credentials stay in env.
 */
export const sendWhatsApp = action({
  args: {
    to: v.string(),
    body: v.string(),
  },
  returns: v.object({
    messageId: v.id("messages"),
    providerMessageId: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    messageId: Id<"messages">;
    providerMessageId: string;
    status: string;
  }> => {
    const input = validateSendWhatsAppInput(args);
    const config = readTwilioOutboundConfig(process.env);
    const result = await sendWhatsAppMessage(config, input);

    const messageId: Id<"messages"> = await ctx.runMutation(
      internal.messaging.recordOutbound,
      {
        providerMessageId: result.providerMessageId,
        participantAddress: result.to,
        body: result.body,
        status: "sent",
        providerStatus: result.status,
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
 * S2 proof path: send the fixed test body to TWILIO_TEST_TO (or an explicit `to`).
 */
export const sendTestWhatsApp = action({
  args: {
    to: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  returns: v.object({
    messageId: v.id("messages"),
    providerMessageId: v.string(),
    status: v.string(),
    toHint: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    messageId: Id<"messages">;
    providerMessageId: string;
    status: string;
    toHint: string;
  }> => {
    const to = args.to?.trim() || process.env.TWILIO_TEST_TO?.trim() || "";
    if (!to) {
      throw new Error(
        "No recipient configured. Pass `to` or set TWILIO_TEST_TO in the Convex environment.",
      );
    }

    const body = args.body?.trim() || DEFAULT_TEST_BODY;
    const input = validateSendWhatsAppInput({ to, body });
    const config = readTwilioOutboundConfig(process.env);
    const result = await sendWhatsAppMessage(config, input);
    const participantAddress = normalizeWhatsAppAddress(result.to);
    const digits = participantAddress.replace(/\D/g, "");
    const toHint = `…${digits.slice(-4) || "????"}`;

    const messageId: Id<"messages"> = await ctx.runMutation(
      internal.messaging.recordOutbound,
      {
        providerMessageId: result.providerMessageId,
        participantAddress,
        body: result.body,
        status: "sent",
        providerStatus: result.status,
      },
    );

    return {
      messageId,
      providerMessageId: result.providerMessageId,
      status: result.status,
      toHint,
    };
  },
});
