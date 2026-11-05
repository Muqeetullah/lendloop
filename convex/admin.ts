import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { adminOrThrow, identityOrThrow, isAdmin } from "./lib/access";

export const currentIsAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await identityOrThrow(ctx);
    return isAdmin(identity.subject);
  },
});

export const listings = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      id: v.id("tools"),
      name: v.string(),
      category: v.string(),
      ownerId: v.id("users"),
      ownerName: v.string(),
      trusted: v.boolean(),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    await adminOrThrow(ctx);
    if (paginationOpts.numItems < 1 || paginationOpts.numItems > 50)
      throw new Error("Invalid page size");
    const page = await ctx.db
      .query("tools")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (tool) => {
          const owner = await ctx.db.get("users", tool.ownerId);
          return {
            id: tool._id,
            name: tool.name,
            category: tool.category,
            ownerId: tool.ownerId,
            ownerName: owner?.displayName || "Neighbor",
            trusted: owner?.trustedLender ?? false,
          };
        }),
      ),
    };
  },
});

export const loans = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      id: v.id("requests"),
      toolName: v.string(),
      lenderName: v.string(),
      borrowerName: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      status: v.union(v.literal("approved"), v.literal("returned")),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    await adminOrThrow(ctx);
    if (paginationOpts.numItems < 1 || paginationOpts.numItems > 50)
      throw new Error("Invalid page size");
    const page = await ctx.db
      .query("requests")
      .order("desc")
      .paginate(paginationOpts);
    const loans = page.page.filter(
      (r): r is typeof r & { status: "approved" | "returned" } =>
        r.status === "approved" || r.status === "returned",
    );
    return {
      ...page,
      page: await Promise.all(
        loans.map(async (loan) => {
          const [tool, lender, borrower] = await Promise.all([
            ctx.db.get("tools", loan.toolId),
            ctx.db.get("users", loan.lenderId),
            ctx.db.get("users", loan.borrowerId),
          ]);
          return {
            id: loan._id,
            toolName: tool?.name ?? "Unavailable listing",
            lenderName: lender?.displayName || "Neighbor",
            borrowerName: borrower?.displayName || "Neighbor",
            startDate: loan.startDate,
            endDate: loan.endDate,
            status: loan.status,
          };
        }),
      ),
    };
  },
});

export const failures = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      id: v.id("automationEvents"),
      requestId: v.id("requests"),
      eventStatus: v.string(),
      attempts: v.number(),
      reason: v.string(),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    await adminOrThrow(ctx);
    if (paginationOpts.numItems < 1 || paginationOpts.numItems > 50)
      throw new Error("Invalid page size");
    const page = await ctx.db
      .query("automationEvents")
      .withIndex("by_delivery_next", (q) => q.eq("delivery", "failed"))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...page,
      page: page.page.map((event) => ({
        id: event._id,
        requestId: event.requestId,
        eventStatus: event.eventStatus,
        attempts: event.attempts,
        reason: event.lastError ?? "Delivery failed",
      })),
    };
  },
});

export const retryNotification = mutation({
  args: { eventId: v.id("automationEvents") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    await adminOrThrow(ctx);
    const event = await ctx.db.get("automationEvents", eventId);
    if (!event || event.delivery !== "failed")
      throw new Error("Failed event not found");
    await ctx.db.patch("automationEvents", eventId, {
      delivery: "pending",
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.automation.deliver, { eventId });
    return null;
  },
});
