import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { extractContractorQuote, parseLlmQuoteJson } from "../src/scenarios/propertyMaintenance";

async function extractQuoteWithModel(rawMessage: string): Promise<{
  price: number | null;
  availability: string | null;
  rawMessage: string;
  usedModel: boolean;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return { ...extractContractorQuote(rawMessage), usedModel: false };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            'Extract contractor quote JSON: {"price": number|null, "availability": string|null}. Price is a number in SGD. No extra keys.',
        },
        { role: "user", content: rawMessage },
      ],
    }),
  });

  if (!response.ok) {
    console.error("OpenRouter quote extraction failed:", response.status);
    return { ...extractContractorQuote(rawMessage), usedModel: false };
  }

  const payload: unknown = await response.json();
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const choices = record && Array.isArray(record.choices) ? record.choices : [];
  const message = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>).message : null;
  const content =
    message && typeof message === "object" && typeof (message as { content?: unknown }).content === "string"
      ? (message as { content: string }).content
      : "";

  return { ...parseLlmQuoteJson(content, rawMessage), usedModel: true };
}

type RouteResult = {
  handled: boolean;
  outbounds: Array<{
    personId?: Id<"people">;
    chatId?: string;
    body: string;
  }>;
  extractQuote?: {
    personId: Id<"people">;
    rawMessage: string;
  };
};

export const routeInbound = internalAction({
  args: {
    messageId: v.id("messages"),
    chatId: v.string(),
  },
  returns: v.object({
    outboundCount: v.number(),
  }),
  handler: async (ctx, args): Promise<{ outboundCount: number }> => {
    let result: RouteResult = await ctx.runMutation(internal.demoRuntime.routeInbound, {
      messageId: args.messageId,
      chatId: args.chatId,
    });

    if (result.extractQuote) {
      const extracted = await extractQuoteWithModel(result.extractQuote.rawMessage);
      result = await ctx.runMutation(internal.demoRuntime.applyExtractedQuote, {
        chatId: args.chatId,
        personId: result.extractQuote.personId,
        price: extracted.price,
        availability: extracted.availability,
        rawMessage: extracted.rawMessage,
      });
    }

    for (const outbound of result.outbounds) {
      const chatId = outbound.chatId ?? args.chatId;
      await ctx.runAction(internal.telegram.sendToChat, {
        chatId,
        body: outbound.body,
        personId: outbound.personId,
      });
    }

    return { outboundCount: result.outbounds.length };
  },
});
