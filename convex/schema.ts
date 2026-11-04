import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const requestStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    trustedLender: v.boolean(),
    displayName: v.optional(v.string()),
    contact: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),
  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
    archived: v.boolean(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_archived", ["archived"]),
  requests: defineTable({
    toolId: v.id("tools"),
    lenderId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    status: requestStatus,
  })
    .index("by_tool_status", ["toolId", "status"])
    .index("by_tool_status_start", ["toolId", "status", "startDate"])
    .index("by_tool_status_end", ["toolId", "status", "endDate"])
    .index("by_borrower_status", ["borrowerId", "status"])
    .index("by_lender", ["lenderId"])
    .index("by_borrower", ["borrowerId"]),
  reminderRecords: defineTable({
    requestId: v.id("requests"),
    day: v.string(),
    type: v.literal("overdue"),
    status: v.union(v.literal("sent"), v.literal("failed")),
  }).index("by_key", ["requestId", "day", "type"]),
});
