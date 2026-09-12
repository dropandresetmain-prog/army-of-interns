import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
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

export default http;
