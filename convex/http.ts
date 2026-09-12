import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { parseTelegramUpdateFromBody } from "../src/integrations/telegram/parseUpdate";
import { parseTwilioInboundWhatsAppFromBody } from "../src/integrations/twilio/parseInbound";

const http = httpRouter();

/**
 * Twilio WhatsApp inbound webhook.
 * Persists correlation state quickly and returns 200. No agent work here.
 */
http.route({
  path: "/twilio/whatsapp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();

    let parsed;
    try {
      parsed = parseTwilioInboundWhatsAppFromBody(rawBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid Twilio payload";
      console.error("Twilio inbound parse failed:", message);
      return new Response(message, { status: 400 });
    }

    const result = await ctx.runMutation(internal.messaging.ingestInbound, {
      providerMessageId: parsed.providerMessageId,
      participantAddress: parsed.participantAddress,
      body: parsed.body,
      profileName: parsed.profileName,
    });

    // Empty 200 is enough for Twilio; duplicate deliveries are acknowledged safely.
    return new Response(
      result.outcome === "duplicate" ? "duplicate" : "accepted",
      {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }),
});

/**
 * Telegram Bot API inbound webhook.
 * Persist + schedule quickly; never do agent work inline.
 */
http.route({
  path: "/telegram/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();

    let parsed;
    try {
      parsed = parseTelegramUpdateFromBody(rawBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid Telegram payload";
      console.error("Telegram inbound parse failed:", message);
      return new Response("ignored", { status: 200 });
    }

    const result = await ctx.runMutation(internal.messaging.ingestTelegram, {
      providerMessageId: parsed.providerMessageId,
      participantAddress: parsed.participantAddress,
      chatId: parsed.chatId,
      body: parsed.body,
      displayNameHint: parsed.displayNameHint,
      telegramUserId: parsed.telegramUserId,
      isPrivateChat: parsed.isPrivateChat,
    });

    if (result.outcome === "accepted" && parsed.isPrivateChat) {
      await ctx.scheduler.runAfter(0, internal.demoActions.routeInbound, {
        messageId: result.messageId,
        chatId: parsed.chatId,
      });
    }

    return new Response(result.outcome === "duplicate" ? "duplicate" : "accepted", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }),
});

export default http;
