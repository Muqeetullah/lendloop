import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export async function enqueueRequestEvent(
  ctx: MutationCtx,
  requestId: Id<"requests">,
  recipientId: Id<"users">,
  eventStatus: "pending" | "approved" | "declined" | "returned",
) {
  const eventId = await ctx.db.insert("automationEvents", {
    requestId,
    recipientId,
    eventStatus,
    delivery: "pending",
    attempts: 0,
    nextAttemptAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.automation.deliver, { eventId });
}
