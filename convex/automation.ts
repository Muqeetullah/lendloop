import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { signMessage } from "./lib/signature";
import { todayUtc } from "./lib/validation";

const maxAttempts = 5;

export const beginAttempt = internalMutation({
  args: { eventId: v.id("automationEvents") },
  returns: v.union(v.null(), v.object({ attempts: v.number() })),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get("automationEvents", eventId);
    if (
      !event ||
      event.delivery !== "pending" ||
      event.nextAttemptAt > Date.now()
    )
      return null;
    if (event.attempts >= maxAttempts) {
      await ctx.db.patch("automationEvents", eventId, {
        delivery: "failed",
        lastError: "Delivery attempts exhausted",
      });
      return null;
    }
    const attempts = event.attempts + 1;
    await ctx.db.patch("automationEvents", eventId, {
      attempts,
      nextAttemptAt: Date.now() + 60_000,
    });
    return { attempts };
  },
});

export const finishFailure = internalMutation({
  args: { eventId: v.id("automationEvents"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { eventId, reason }) => {
    const event = await ctx.db.get("automationEvents", eventId);
    if (!event || event.delivery !== "pending") return null;
    if (event.attempts >= maxAttempts) {
      await ctx.db.patch("automationEvents", eventId, {
        delivery: "failed",
        lastError: reason.slice(0, 120),
      });
    } else {
      const delay = Math.min(15_000 * 2 ** (event.attempts - 1), 120_000);
      await ctx.db.patch("automationEvents", eventId, {
        nextAttemptAt: Date.now() + delay,
        lastError: reason.slice(0, 120),
      });
      await ctx.scheduler.runAfter(delay, internal.automation.deliver, {
        eventId,
      });
    }
    return null;
  },
});

export const eventDelivery = internalQuery({
  args: { eventId: v.id("automationEvents") },
  returns: v.union(
    v.null(),
    v.literal("pending"),
    v.literal("delivered"),
    v.literal("failed"),
  ),
  handler: async (ctx, { eventId }) =>
    (await ctx.db.get("automationEvents", eventId))?.delivery ?? null,
});

// A recorded mock notification is the side effect. This transaction is the idempotency boundary.
export const recordNotification = internalMutation({
  args: { eventId: v.id("automationEvents") },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get("automationEvents", eventId);
    if (!event) throw new Error("Event not found");
    if (event.delivery === "delivered") return { recorded: false };
    await ctx.db.patch("automationEvents", eventId, {
      delivery: "delivered",
      deliveredAt: Date.now(),
      lastError: undefined,
    });
    return { recorded: true };
  },
});

export const deliver = internalAction({
  args: { eventId: v.id("automationEvents") },
  returns: v.null(),
  handler: async (ctx, { eventId }): Promise<null> => {
    const claim: { attempts: number } | null = await ctx.runMutation(
      internal.automation.beginAttempt,
      { eventId },
    );
    if (!claim) return null;
    try {
      const url = process.env.N8N_REQUEST_WEBHOOK_URL;
      const secret = process.env.CONVEX_TO_N8N_SECRET;
      if (!url || !secret) throw new Error("Request webhook is not configured");
      const timestamp = String(Date.now());
      const signature = await signMessage(
        secret,
        `v1.${timestamp}.POST.request-notification.${eventId}`,
      );
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-lendloop-timestamp": timestamp,
          "x-lendloop-signature": signature,
        },
        body: JSON.stringify({ eventId }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok)
        throw new Error(`Webhook returned HTTP ${response.status}`);
      const delivery: string | null = await ctx.runQuery(
        internal.automation.eventDelivery,
        { eventId },
      );
      if (delivery !== "delivered")
        throw new Error("Webhook did not record notification");
    } catch (error) {
      const reason =
        error instanceof Error &&
        /^(Request webhook is not configured|Webhook returned HTTP \d+|Webhook did not record notification)$/.test(
          error.message,
        )
          ? error.message
          : "Webhook delivery failed";
      await ctx.runMutation(internal.automation.finishFailure, {
        eventId,
        reason,
      });
    }
    return null;
  },
});

// Recover actions interrupted after claiming a job. A transactional lease prevents concurrent attempts.
export const recover = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const due = await ctx.db
      .query("automationEvents")
      .withIndex("by_delivery_next", (q) =>
        q.eq("delivery", "pending").lte("nextAttemptAt", Date.now()),
      )
      .take(50);
    for (const event of due)
      await ctx.scheduler.runAfter(0, internal.automation.deliver, {
        eventId: event._id,
      });
    return null;
  },
});

export const overduePage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.object({ requestId: v.id("requests") })),
  handler: async (ctx, { paginationOpts }) => {
    if (paginationOpts.numItems < 1 || paginationOpts.numItems > 25)
      throw new Error("Invalid page size");
    const page = await ctx.db
      .query("requests")
      .withIndex("by_status_end", (q) =>
        q.eq("status", "approved").lt("endDate", todayUtc()),
      )
      .paginate(paginationOpts);
    return {
      ...page,
      page: page.page.map((request) => ({ requestId: request._id })),
    };
  },
});

export const recordOverdueReminder = internalMutation({
  args: { requestId: v.id("requests"), day: v.string() },
  returns: v.union(
    v.literal("recorded"),
    v.literal("already_recorded"),
    v.literal("not_overdue"),
  ),
  handler: async (ctx, { requestId, day }) => {
    if (day !== todayUtc()) throw new Error("Invalid reminder day");
    const request = await ctx.db.get("requests", requestId);
    if (!request || request.status !== "approved" || request.endDate >= day)
      return "not_overdue";
    const existing = await ctx.db
      .query("reminderRecords")
      .withIndex("by_key", (q) =>
        q.eq("requestId", requestId).eq("day", day).eq("type", "overdue"),
      )
      .unique();
    if (existing?.status === "sent") return "already_recorded";
    if (existing)
      await ctx.db.patch("reminderRecords", existing._id, { status: "sent" });
    else
      await ctx.db.insert("reminderRecords", {
        requestId,
        day,
        type: "overdue",
        status: "sent",
      });
    return "recorded";
  },
});
