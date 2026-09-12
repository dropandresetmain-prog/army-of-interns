import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { metadataValidator, tableFields } from "./model/validators";

export default defineSchema({
  companyProfiles: defineTable(tableFields.companyProfiles).index("by_name", ["name"]),
  people: defineTable(tableFields.people)
    .index("by_display_name", ["displayName"])
    .index("by_demo_callsign", ["demoCallsign"])
    .index("by_whatsapp_number", ["whatsappNumber"])
    .index("by_telegram_chat_id", ["telegramChatId"])
    .index("by_role_type", ["roleType"]),
  workers: defineTable(tableFields.workers)
    .index("by_name", ["name"])
    .index("by_status", ["status"]),
  capabilities: defineTable(tableFields.capabilities).index("by_key", ["key"]),
  workItems: defineTable(tableFields.workItems).index("by_status", ["status"]),
  assignments: defineTable(tableFields.assignments)
    .index("by_work_item", ["workItemId"])
    .index("by_worker", ["workerId"]),
  approvals: defineTable(tableFields.approvals)
    .index("by_work_item", ["workItemId"])
    .index("by_status", ["status"]),
  events: defineTable(tableFields.events)
    .index("by_timestamp", ["timestamp"])
    .index("by_work_item", ["workItemId"]),
  toolDefinitions: defineTable(tableFields.toolDefinitions).index("by_key", ["key"]),
  messages: defineTable(tableFields.messages)
    .index("by_provider_message_id", ["provider", "providerMessageId"])
    .index("by_created_at", ["createdAt"])
    .index("by_person", ["personId"]),
  contractorQuotes: defineTable({
    workItemId: v.id("workItems"),
    personId: v.id("people"),
    rawMessage: v.string(),
    price: v.optional(v.number()),
    availability: v.optional(v.string()),
    extractStatus: v.union(v.literal("ok"), v.literal("failed")),
    meetsDeadline: v.optional(v.boolean()),
    withinBudget: v.optional(v.boolean()),
    viable: v.optional(v.boolean()),
    rank: v.optional(v.number()),
    rejectedReason: v.optional(v.string()),
  })
    .index("by_work_item", ["workItemId"])
    .index("by_work_and_person", ["workItemId", "personId"]),
  demoState: defineTable({
    key: v.string(),
    phase: v.string(),
    activeRole: v.optional(v.string()),
    workItemId: v.optional(v.id("workItems")),
    operationsWorkerId: v.optional(v.id("workers")),
    procurementWorkerId: v.optional(v.id("workers")),
    operationsAssignmentId: v.optional(v.id("assignments")),
    procurementAssignmentId: v.optional(v.id("assignments")),
    approvalId: v.optional(v.id("approvals")),
    promotionApprovalId: v.optional(v.id("approvals")),
    selectedContractorPersonId: v.optional(v.id("people")),
    metadata: metadataValidator,
  }).index("by_key", ["key"]),
});
