import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  channelMessageDocumentValidator,
  messageChannelValidator,
  messageProviderValidator,
  publicChannelMessageValidator,
} from "./model/validators";
import { participantDisplayHint } from "../src/integrations/twilio/phone";
import { participantDisplayHint as telegramDisplayHint } from "../src/integrations/telegram/identity";
import { parseStartRole } from "../src/scenarios/propertyMaintenance";

const ingestResultValidator = v.object({
  outcome: v.union(v.literal("accepted"), v.literal("duplicate")),
  messageId: v.id("messages"),
  personId: v.optional(v.id("people")),
  createdPerson: v.boolean(),
  eventId: v.optional(v.id("events")),
});

type IngestResult = {
  outcome: "accepted" | "duplicate";
  messageId: Id<"messages">;
  personId?: Id<"people">;
  createdPerson: boolean;
  eventId?: Id<"events">;
};

async function toPublicMessage(ctx: QueryCtx | MutationCtx, message: Doc<"messages">) {
  const person = message.personId ? await ctx.db.get(message.personId) : null;
  return {
    _id: message._id,
    _creationTime: message._creationTime,
    provider: message.provider,
    providerMessageId: message.providerMessageId,
    direction: message.direction,
    channel: message.channel,
    personId: message.personId,
    personDisplayName: person?.displayName ?? null,
    body: message.body,
    status: message.status,
    createdAt: message.createdAt,
    correlated: Boolean(message.personId),
  };
}

async function ingestInboundMessage(
  ctx: MutationCtx,
  args: {
    providerMessageId: string;
    participantAddress: string;
    body: string;
    profileName?: string;
  },
): Promise<IngestResult> {
  const existing = await ctx.db
    .query("messages")
    .withIndex("by_provider_message_id", (q) =>
      q.eq("provider", "twilio").eq("providerMessageId", args.providerMessageId),
    )
    .unique();

  if (existing) {
    return {
      outcome: "duplicate",
      messageId: existing._id,
      personId: existing.personId,
      createdPerson: false,
    };
  }

  const matched = await ctx.db
    .query("people")
    .withIndex("by_whatsapp_number", (q) => q.eq("whatsappNumber", args.participantAddress))
    .unique();

  let createdPerson = false;
  let personId = matched?._id;
  if (!personId) {
    personId = await ctx.db.insert("people", {
      displayName: args.profileName?.trim() || participantDisplayHint(args.participantAddress),
      roleType: "participant",
      whatsappNumber: args.participantAddress,
      active: true,
      scenarioMetadata: {
        source: "whatsapp_inbound_correlation",
      },
    });
    createdPerson = true;
  }

  const createdAt = Date.now();
  const messageId = await ctx.db.insert("messages", {
    provider: "twilio",
    providerMessageId: args.providerMessageId,
    direction: "inbound",
    channel: "whatsapp",
    participantAddress: args.participantAddress,
    personId,
    body: args.body,
    status: "received",
    createdAt,
    providerMetadata: args.profileName ? { profileName: args.profileName } : {},
  });

  const eventId = await ctx.db.insert("events", {
    timestamp: createdAt,
    eventType: "human_response_received",
    summary: `Inbound WhatsApp: ${args.body.slice(0, 120) || "(empty)"}`,
    metadata: {
      messageId,
      provider: "twilio",
      providerMessageId: args.providerMessageId,
      personId,
      source: "twilio_webhook",
    },
  });

  return {
    outcome: "accepted",
    messageId,
    personId,
    createdPerson,
    eventId,
  };
}

export const listRecent = query({
  args: {},
  returns: v.array(publicChannelMessageValidator),
  handler: async (ctx) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_created_at")
      .order("desc")
      .take(50);

    return await Promise.all(messages.map((message) => toPublicMessage(ctx, message)));
  },
});

/**
 * Idempotent inbound ingest. Duplicate Twilio MessageSid returns the existing
 * row without creating a second event or any downstream side effects.
 */
export const ingestInbound = internalMutation({
  args: {
    providerMessageId: v.string(),
    participantAddress: v.string(),
    body: v.string(),
    profileName: v.optional(v.string()),
  },
  returns: ingestResultValidator,
  handler: async (ctx, args) => {
    return await ingestInboundMessage(ctx, args);
  },
});

export const recordOutbound = internalMutation({
  args: {
    providerMessageId: v.string(),
    participantAddress: v.string(),
    body: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    personId: v.optional(v.id("people")),
    providerStatus: v.optional(v.string()),
    provider: v.optional(messageProviderValidator),
    channel: v.optional(messageChannelValidator),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const provider = args.provider ?? "twilio";
    const channel = args.channel ?? "whatsapp";
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_provider_message_id", (q) =>
        q.eq("provider", provider).eq("providerMessageId", args.providerMessageId),
      )
      .unique();
    if (existing) {
      return existing._id;
    }

    let personId = args.personId;
    if (!personId && provider === "twilio") {
      const matched = await ctx.db
        .query("people")
        .withIndex("by_whatsapp_number", (q) =>
          q.eq("whatsappNumber", args.participantAddress),
        )
        .unique();
      personId = matched?._id;
    }
    if (!personId && provider === "telegram") {
      const chatId = args.participantAddress.replace(/^tg:/, "");
      const matched = await ctx.db
        .query("people")
        .withIndex("by_telegram_chat_id", (q) => q.eq("telegramChatId", chatId))
        .first();
      personId = matched?._id;
    }

    const createdAt = Date.now();
    const messageId = await ctx.db.insert("messages", {
      provider,
      providerMessageId: args.providerMessageId,
      direction: "outbound",
      channel,
      participantAddress: args.participantAddress,
      personId,
      body: args.body,
      status: args.status,
      createdAt,
      providerMetadata: args.providerStatus
        ? { providerStatus: args.providerStatus }
        : {},
    });

    const label = channel === "telegram" ? "Telegram" : "WhatsApp";
    await ctx.db.insert("events", {
      timestamp: createdAt,
      eventType: "human_contacted",
      summary: `Outbound ${label}: ${args.body.slice(0, 120)}`,
      metadata: {
        messageId,
        provider,
        providerMessageId: args.providerMessageId,
        source: `${provider}_outbound`,
      },
    });

    return messageId;
  },
});

/** S2 realtime probe — inserts a structured event so the UI can update without refresh. */
export const insertRealtimeProbe = mutation({
  args: {
    summary: v.optional(v.string()),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("events", {
      timestamp: Date.now(),
      eventType: "tool_called",
      summary: args.summary ?? `S2 realtime probe ${Date.now()}`,
      metadata: { source: "s2_realtime_probe" },
    });
  },
});

export const getMessage = internalQuery({
  args: { messageId: v.id("messages") },
  returns: v.union(channelMessageDocumentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

export const ingestTelegram = internalMutation({
  args: {
    providerMessageId: v.string(),
    participantAddress: v.string(),
    chatId: v.string(),
    body: v.string(),
    displayNameHint: v.optional(v.string()),
    telegramUserId: v.optional(v.string()),
    isPrivateChat: v.boolean(),
  },
  returns: ingestResultValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_provider_message_id", (q) =>
        q.eq("provider", "telegram").eq("providerMessageId", args.providerMessageId),
      )
      .unique();

    if (existing) {
      return {
        outcome: "duplicate" as const,
        messageId: existing._id,
        personId: existing.personId,
        createdPerson: false,
      };
    }

    if (!args.isPrivateChat) {
      const createdAt = Date.now();
      const messageId = await ctx.db.insert("messages", {
        provider: "telegram",
        providerMessageId: args.providerMessageId,
        direction: "inbound",
        channel: "telegram",
        participantAddress: args.participantAddress,
        body: args.body,
        status: "received",
        createdAt,
        providerMetadata: { ignored: "non_private_chat" },
      });
      return {
        outcome: "accepted" as const,
        messageId,
        createdPerson: false,
      };
    }

    const matches = await ctx.db
      .query("people")
      .withIndex("by_telegram_chat_id", (q) => q.eq("telegramChatId", args.chatId))
      .take(20);

    const startRole = parseStartRole(args.body);
    let createdPerson = false;
    let person =
      startRole === null
        ? (matches.find(
            (candidate) => candidate.active && candidate.roleType !== "participant",
          ) ?? matches.find((candidate) => candidate.active) ?? matches[0])
        : undefined;

    // Role-bearing /start messages are registered by demoRuntime before any
    // generic participant may claim the Telegram chat.
    if (!person && startRole === null) {
      const personId = await ctx.db.insert("people", {
        displayName:
          args.displayNameHint?.trim() || telegramDisplayHint(undefined, args.chatId),
        roleType: "participant",
        telegramChatId: args.chatId,
        active: true,
        scenarioMetadata: {
          source: "telegram_inbound_correlation",
          telegramUserId: args.telegramUserId ?? null,
        },
      });
      createdPerson = true;
      const created = await ctx.db.get(personId);
      if (!created) {
        throw new Error("Failed to persist Telegram participant.");
      }
      person = created;
    }

    const createdAt = Date.now();
    const messageId = await ctx.db.insert("messages", {
      provider: "telegram",
      providerMessageId: args.providerMessageId,
      direction: "inbound",
      channel: "telegram",
      participantAddress: args.participantAddress,
      personId: person?._id,
      body: args.body,
      status: "received",
      createdAt,
      providerMetadata: {
        displayNameHint: args.displayNameHint ?? null,
        telegramUserId: args.telegramUserId ?? null,
      },
    });

    const eventId = await ctx.db.insert("events", {
      timestamp: createdAt,
      eventType: "human_response_received",
      summary: `Inbound Telegram: ${args.body.slice(0, 120) || "(empty)"}`,
      metadata: {
        messageId,
        provider: "telegram",
        providerMessageId: args.providerMessageId,
        personId: person?._id ?? null,
        source: "telegram_webhook",
      },
    });

    return {
      outcome: "accepted" as const,
      messageId,
      personId: person?._id,
      createdPerson,
      eventId,
    };
  },
});

/** Test helper: simulate an inbound Twilio delivery without HTTP (local verification). */
export const simulateInbound = mutation({
  args: {
    providerMessageId: v.string(),
    participantAddress: v.string(),
    body: v.string(),
    profileName: v.optional(v.string()),
  },
  returns: ingestResultValidator,
  handler: async (ctx, args) => {
    return await ingestInboundMessage(ctx, args);
  },
});
