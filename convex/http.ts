import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifySignedRequest } from "./lib/signature";
import { todayUtc } from "./lib/validation";

const http = httpRouter();
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

async function authenticate(request: Request, path: string) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 8192) return null;
  const body = await request.text();
  if (body.length > 8192) return null;
  const valid = await verifySignedRequest(
    process.env.N8N_TO_CONVEX_SECRET,
    request.headers.get("x-lendloop-timestamp"),
    request.headers.get("x-lendloop-signature"),
    "POST",
    path,
    body,
  );
  return valid ? body : null;
}

http.route({
  path: "/automation/notification",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await authenticate(request, "/automation/notification");
    if (body === null) return json({ error: "Unauthorized" }, 401);
    try {
      const value: unknown = JSON.parse(body);
      if (
        !value ||
        typeof value !== "object" ||
        !("eventId" in value) ||
        typeof value.eventId !== "string" ||
        Object.keys(value).length !== 1
      )
        return json({ error: "Invalid request" }, 400);
      const result = await ctx.runMutation(
        internal.automation.recordNotification,
        { eventId: value.eventId as Id<"automationEvents"> },
      );
      return json({ ok: true, ...result });
    } catch {
      return json({ error: "Invalid event" }, 400);
    }
  }),
});

http.route({
  path: "/automation/overdue",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await authenticate(request, "/automation/overdue");
    if (body === null) return json({ error: "Unauthorized" }, 401);
    try {
      const value: unknown = JSON.parse(body);
      if (
        !value ||
        typeof value !== "object" ||
        !("cursor" in value) ||
        (value.cursor !== null &&
          (typeof value.cursor !== "string" || value.cursor.length > 4096)) ||
        Object.keys(value).length !== 1
      )
        return json({ error: "Invalid request" }, 400);
      const page = await ctx.runQuery(internal.automation.overduePage, {
        paginationOpts: { numItems: 25, cursor: value.cursor as string | null },
      });
      return json({
        day: todayUtc(),
        page: page.page,
        isDone: page.isDone,
        continueCursor: page.continueCursor,
      });
    } catch {
      return json({ error: "Could not fetch overdue loans" }, 400);
    }
  }),
});

http.route({
  path: "/automation/reminder",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await authenticate(request, "/automation/reminder");
    if (body === null) return json({ error: "Unauthorized" }, 401);
    try {
      const value: unknown = JSON.parse(body);
      if (
        !value ||
        typeof value !== "object" ||
        !("requestId" in value) ||
        typeof value.requestId !== "string" ||
        !("day" in value) ||
        typeof value.day !== "string" ||
        Object.keys(value).length !== 2
      )
        return json({ error: "Invalid request" }, 400);
      const result = await ctx.runMutation(
        internal.automation.recordOverdueReminder,
        { requestId: value.requestId as Id<"requests">, day: value.day },
      );
      return json({ ok: true, result });
    } catch {
      return json({ error: "Could not record reminder" }, 400);
    }
  }),
});

export default http;
