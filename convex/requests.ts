import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { mutation, query } from "./_generated/server";
import { adminOrThrow, userOrThrow } from "./lib/access";
import { todayUtc, validDay } from "./lib/validation";

export const create = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const { user } = await userOrThrow(ctx);
    if (
      !validDay(startDate) ||
      !validDay(endDate) ||
      startDate < todayUtc() ||
      endDate < startDate
    )
      throw new Error("Invalid date range");
    const tool = await ctx.db.get("tools", toolId);
    if (!tool || tool.archived) throw new Error("Listing unavailable");
    if (tool.ownerId === user._id)
      throw new Error("Cannot request your own listing");
    const pending = await ctx.db
      .query("requests")
      .withIndex("by_borrower_status", (q) =>
        q.eq("borrowerId", user._id).eq("status", "pending"),
      )
      .take(10);
    if (pending.some((request) => request.toolId === toolId))
      throw new Error("You already have a pending request for this tool");
    if (pending.length >= 10)
      throw new Error("You have reached the limit of 10 pending requests");
    const recent = await ctx.db
      .query("requests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(10);
    if (
      recent.length >= 10 &&
      recent[9]._creationTime > Date.now() - 60 * 60 * 1000
    )
      throw new Error("Too many requests. Please try again later");
    return await ctx.db.insert("requests", {
      toolId,
      lenderId: tool.ownerId,
      borrowerId: user._id,
      startDate,
      endDate,
      status: "pending",
    });
  },
});

export const respond = mutation({
  args: {
    requestId: v.id("requests"),
    decision: v.union(v.literal("approved"), v.literal("declined")),
  },
  handler: async (ctx, { requestId, decision }) => {
    const { user } = await userOrThrow(ctx);
    const request = await ctx.db.get("requests", requestId);
    if (!request || request.lenderId !== user._id)
      throw new Error("Not authorized");
    if (request.status !== "pending")
      throw new Error("Invalid request transition");
    if (decision === "approved") {
      const tool = await ctx.db.get("tools", request.toolId);
      if (!tool || tool.archived) throw new Error("Listing unavailable");
      if (request.startDate < todayUtc())
        throw new Error("Request start date has passed");
      const overdue = await ctx.db
        .query("requests")
        .withIndex("by_tool_status_end", (q) =>
          q
            .eq("toolId", request.toolId)
            .eq("status", "approved")
            .lt("endDate", todayUtc()),
        )
        .first();
      if (overdue)
        throw new Error(
          "An overdue loan must be returned before another request can be approved",
        );
      const approved = await ctx.db
        .query("requests")
        .withIndex("by_tool_status_start", (q) =>
          q
            .eq("toolId", request.toolId)
            .eq("status", "approved")
            .lte("startDate", request.endDate),
        )
        .take(101);
      if (approved.length > 100)
        throw new Error("Too many active reservations to check safely");
      if (approved.some((loan) => request.startDate <= loan.endDate))
        throw new Error("Loan dates overlap");
    }
    await ctx.db.patch("requests", requestId, { status: decision });
  },
});

export const markReturned = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const { user } = await userOrThrow(ctx);
    const request = await ctx.db.get("requests", requestId);
    if (
      !request ||
      (request.lenderId !== user._id && request.borrowerId !== user._id)
    )
      throw new Error("Not authorized");
    if (request.status !== "approved")
      throw new Error("Invalid request transition");
    await ctx.db.patch("requests", requestId, { status: "returned" });
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await userOrThrow(ctx);
    return await ctx.db
      .query("requests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .collect();
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await userOrThrow(ctx);
    return await ctx.db
      .query("requests")
      .withIndex("by_lender", (q) => q.eq("lenderId", user._id))
      .collect();
  },
});

export const allForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await adminOrThrow(ctx);
    return await ctx.db.query("requests").collect();
  },
});

// Each participant sees only their own requests and the associated tool name.
export const journey = query({
  args: { side: v.union(v.literal("incoming"), v.literal("outgoing")) },
  returns: v.array(
    v.object({
      id: v.id("requests"),
      toolName: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("declined"),
        v.literal("returned"),
      ),
    }),
  ),
  handler: async (ctx, { side }) => {
    const { user } = await userOrThrow(ctx);
    const requests =
      side === "incoming"
        ? await ctx.db
            .query("requests")
            .withIndex("by_lender", (q) => q.eq("lenderId", user._id))
            .order("desc")
            .take(100)
        : await ctx.db
            .query("requests")
            .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
            .order("desc")
            .take(100);
    return await Promise.all(
      requests.map(async (request) => ({
        id: request._id,
        toolName:
          (await ctx.db.get("tools", request.toolId))?.name ??
          "Unavailable listing",
        startDate: request.startDate,
        endDate: request.endDate,
        status: request.status,
      })),
    );
  },
});

// Paginated participant-only view for the workspace.
export const journeyPage = query({
  args: {
    side: v.union(v.literal("incoming"), v.literal("outgoing")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      id: v.id("requests"),
      toolName: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("declined"),
        v.literal("returned"),
      ),
      neighborName: v.string(),
      contact: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { side, paginationOpts }) => {
    const { user } = await userOrThrow(ctx);
    if (paginationOpts.numItems < 1 || paginationOpts.numItems > 50)
      throw new Error("Invalid page size");
    const page =
      side === "incoming"
        ? await ctx.db
            .query("requests")
            .withIndex("by_lender", (q) => q.eq("lenderId", user._id))
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db
            .query("requests")
            .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
            .order("desc")
            .paginate(paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (request) => {
          const neighborId =
            side === "incoming" ? request.borrowerId : request.lenderId;
          const neighbor = await ctx.db.get("users", neighborId);
          return {
            id: request._id,
            toolName:
              (await ctx.db.get("tools", request.toolId))?.name ??
              "Unavailable listing",
            startDate: request.startDate,
            endDate: request.endDate,
            status: request.status,
            neighborName: neighbor?.displayName || "Neighbor",
            contact:
              request.status === "approved" ? neighbor?.contact || null : null,
          };
        }),
      ),
    };
  },
});
