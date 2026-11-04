import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { validDay } from "./lib/validation";

export const record = internalMutation({
  args: {
    requestId: v.id("requests"),
    day: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
  },
  handler: async (ctx, { requestId, day, status }) => {
    if (!validDay(day)) throw new Error("Invalid reminder day");
    const request = await ctx.db.get("requests", requestId);
    if (!request) throw new Error("Request not found");
    const existing = await ctx.db
      .query("reminderRecords")
      .withIndex("by_key", (q) =>
        q.eq("requestId", requestId).eq("day", day).eq("type", "overdue"),
      )
      .unique();
    if (existing) {
      if (existing.status === "failed" && status === "sent")
        await ctx.db.patch("reminderRecords", existing._id, { status });
      return existing._id;
    }
    return await ctx.db.insert("reminderRecords", {
      requestId,
      day,
      type: "overdue",
      status,
    });
  },
});
