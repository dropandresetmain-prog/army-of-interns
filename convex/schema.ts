import { defineSchema, defineTable } from "convex/server";

import { tableFields } from "./model/validators";

export default defineSchema({
  companyProfiles: defineTable(tableFields.companyProfiles).index("by_name", ["name"]),
  people: defineTable(tableFields.people)
    .index("by_display_name", ["displayName"])
    .index("by_demo_callsign", ["demoCallsign"]),
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
});
