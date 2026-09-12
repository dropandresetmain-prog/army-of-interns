import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { publicChannelMessageValidator } from "./model/validators";
import { participantDisplayHint } from "../src/integrations/twilio/phone";

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
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_provider_message_id", (q) =>
        q.eq("provider", "twilio").eq("providerMessageId", args.providerMessageId),
      )
      .unique();
    if (existing) {
      return existing._id;
    }

    let personId = args.personId;
    if (!personId) {
      const matched = await ctx.db
        .query("people")
        .withIndex("by_whatsapp_number", (q) =>
          q.eq("whatsappNumber", args.participantAddress),
        )
        .unique();
      personId = matched?._id;
    }

    const createdAt = Date.now();
    const messageId = await ctx.db.insert("messages", {
      provider: "twilio",
      providerMessageId: args.providerMessageId,
      direction: "outbound",
      channel: "whatsapp",
      participantAddress: args.participantAddress,
      personId,
      body: args.body,
      status: args.status,
      createdAt,
      providerMetadata: args.providerStatus
        ? { providerStatus: args.providerStatus }
        : {},
    });

    await ctx.db.insert("events", {
      timestamp: createdAt,
      eventType: "human_contacted",
      summary: `Outbound WhatsApp: ${args.body.slice(0, 120)}`,
      metadata: {
        messageId,
        provider: "twilio",
        providerMessageId: args.providerMessageId,
        source: "twilio_outbound",
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
