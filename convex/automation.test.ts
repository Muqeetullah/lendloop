/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { signMessage } from "./lib/signature";

const modules = import.meta.glob("./**/*.{ts,js}");
const api = anyApi;
const secret = "test-only-signing-key";

async function signed(
  t: ReturnType<typeof convexTest>,
  path: string,
  body: object,
  timestamp = String(Date.now()),
) {
  const raw = JSON.stringify(body);
  const signature = await signMessage(
    secret,
    `v1.${timestamp}.POST.${path}.${raw}`,
  );
  return await t.fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-lendloop-timestamp": timestamp,
      "x-lendloop-signature": signature,
    },
    body: raw,
  });
}

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({
    subject: "owner",
    issuer: "https://clerk.example",
  });
  const borrower = t.withIdentity({
    subject: "borrower",
    issuer: "https://clerk.example",
  });
  const stranger = t.withIdentity({
    subject: "stranger",
    issuer: "https://clerk.example",
  });
  const admin = t.withIdentity({
    subject: "admin",
    issuer: "https://clerk.example",
  });
  for (const actor of [owner, borrower, stranger, admin])
    await actor.mutation(api.users.ensureCurrent, {});
  const toolId = await owner.mutation(api.tools.create, {
    name: "Drill",
    category: "Power tools",
    condition: "Good",
    description: "Test",
  });
  const requestId = await borrower.mutation(api.requests.create, {
    toolId,
    startDate: "2030-01-10",
    endDate: "2030-01-11",
  });
  return { t, owner, borrower, stranger, admin, toolId, requestId };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-01-09T12:00:00Z"));
  vi.stubEnv("N8N_TO_CONVEX_SECRET", secret);
  vi.stubEnv("ADMIN_CLERK_USER_ID", "admin");
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("signed automation and admin access", () => {
  it("rejects missing, expired and tampered signatures; retries record one notification", async () => {
    const { t, borrower } = await setup();
    const events = await t.run(
      async (ctx) => await ctx.db.query("automationEvents").collect(),
    );
    expect(events).toHaveLength(1);
    const eventId = events[0]._id;
    expect(
      (
        await t.fetch("/automation/notification", {
          method: "POST",
          body: JSON.stringify({ eventId }),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await signed(
          t,
          "/automation/notification",
          { eventId },
          String(Date.now() - 301_000),
        )
      ).status,
    ).toBe(401);
    const timestamp = String(Date.now());
    const signature = await signMessage(
      secret,
      `v1.${timestamp}.POST./automation/notification.${JSON.stringify({ eventId })}`,
    );
    expect(
      (
        await t.fetch("/automation/notification", {
          method: "POST",
          headers: {
            "x-lendloop-timestamp": timestamp,
            "x-lendloop-signature": signature,
          },
          body: JSON.stringify({ eventId: "tampered" }),
        })
      ).status,
    ).toBe(401);
    const first = await signed(t, "/automation/notification", { eventId });
    expect(await first.json()).toEqual({ ok: true, recorded: true });
    const retry = await signed(t, "/automation/notification", { eventId });
    expect(await retry.json()).toEqual({ ok: true, recorded: false });
    const recorded = await t.run(
      async (ctx) => await ctx.db.get("automationEvents", eventId),
    );
    expect(recorded?.delivery).toBe("delivered");
    const page = await borrower.query(api.requests.journeyPage, {
      side: "outgoing",
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(page.page[0].activity).toMatchObject([
      { kind: "notification", status: "delivered" },
    ]);
  });

  it("fetches only overdue approved loans and records one reminder per day", async () => {
    const { t, owner, borrower, requestId } = await setup();
    await owner.mutation(api.requests.respond, {
      requestId,
      decision: "approved",
    });
    vi.setSystemTime(new Date("2030-01-12T12:00:00Z"));
    const overdue = await signed(t, "/automation/overdue", { cursor: null });
    const data = await overdue.json();
    expect(data.day).toBe("2030-01-12");
    expect(data.page).toEqual([{ requestId }]);
    const first = await signed(t, "/automation/reminder", {
      requestId,
      day: data.day,
    });
    expect(await first.json()).toEqual({ ok: true, result: "recorded" });
    const retry = await signed(t, "/automation/reminder", {
      requestId,
      day: data.day,
    });
    expect(await retry.json()).toEqual({
      ok: true,
      result: "already_recorded",
    });
    const records = await t.run(
      async (ctx) => await ctx.db.query("reminderRecords").collect(),
    );
    expect(records).toHaveLength(1);
    await borrower.mutation(api.requests.markReturned, { requestId });
    const noLongerOverdue = await signed(t, "/automation/reminder", {
      requestId,
      day: data.day,
    });
    expect(await noLongerOverdue.json()).toEqual({
      ok: true,
      result: "not_overdue",
    });
  });

  it("limits admin listing, loan and retry actions to the configured administrator", async () => {
    const { t, owner, borrower, admin, toolId, requestId } = await setup();
    const opts = { numItems: 10, cursor: null };
    await expect(
      borrower.query(api.admin.listings, { paginationOpts: opts }),
    ).rejects.toThrow("Not authorized");
    await expect(
      borrower.query(api.admin.loans, { paginationOpts: opts }),
    ).rejects.toThrow("Not authorized");
    const event = (
      await t.run(
        async (ctx) => await ctx.db.query("automationEvents").collect(),
      )
    )[0];
    await expect(
      borrower.mutation(api.admin.retryNotification, { eventId: event._id }),
    ).rejects.toThrow("Not authorized");
    const ownerId = await owner.mutation(api.users.ensureCurrent, {});
    await admin.mutation(api.users.setTrusted, {
      userId: ownerId,
      trusted: true,
    });
    expect(
      (await borrower.query(api.tools.boardPage, { paginationOpts: opts }))
        .page[0].trustedLender,
    ).toBe(true);
    await owner.mutation(api.requests.respond, {
      requestId,
      decision: "approved",
    });
    expect(
      (await admin.query(api.admin.loans, { paginationOpts: opts })).page,
    ).toMatchObject([{ id: requestId, status: "approved" }]);
    await admin.mutation(api.tools.archive, { toolId });
    expect(
      (await admin.query(api.admin.listings, { paginationOpts: opts })).page,
    ).toEqual([]);
  });

  it("leases attempts, exposes exhausted deliveries, and lets an admin retry", async () => {
    const { t, admin, borrower } = await setup();
    const event = (
      await t.run(async (ctx) => ctx.db.query("automationEvents").collect())
    )[0];
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(
        await t.mutation(api.automation.beginAttempt, { eventId: event._id }),
      ).toEqual({ attempts: attempt });
      expect(
        await t.mutation(api.automation.beginAttempt, { eventId: event._id }),
      ).toBeNull();
      await t.mutation(api.automation.finishFailure, {
        eventId: event._id,
        reason: "Webhook delivery failed",
      });
      vi.setSystemTime(Date.now() + 120_001);
    }
    const paginationOpts = { numItems: 10, cursor: null };
    await expect(
      borrower.query(api.admin.failures, { paginationOpts }),
    ).rejects.toThrow("Not authorized");
    expect(
      (await admin.query(api.admin.failures, { paginationOpts })).page,
    ).toMatchObject([{ id: event._id, attempts: 5 }]);
    await admin.mutation(api.admin.retryNotification, { eventId: event._id });
    expect(
      await t.run((ctx) => ctx.db.get("automationEvents", event._id)),
    ).toMatchObject({ delivery: "pending", attempts: 0 });
    expect(
      await t.run(async (ctx) => ctx.db.query("automationEvents").collect()),
    ).toHaveLength(1);
  });
});
