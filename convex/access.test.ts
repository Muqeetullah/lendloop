/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.{ts,js}");
const api = anyApi;
const listing = {
  name: "Drill",
  category: "Power tools",
  condition: "Good",
  description: "Personal description",
};
const days = { startDate: "2030-01-10", endDate: "2030-01-12" };

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
  await owner.mutation(api.users.ensureCurrent, {});
  await borrower.mutation(api.users.ensureCurrent, {});
  await stranger.mutation(api.users.ensureCurrent, {});
  await admin.mutation(api.users.ensureCurrent, {});
  const toolId = await owner.mutation(api.tools.create, listing);
  return { t, owner, borrower, stranger, admin, toolId };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-01-09T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("lending access and invariants", () => {
  it("limits public data and rejects anonymous and cross user listing writes", async () => {
    const { t, stranger, toolId } = await setup();
    expect(
      await t
        .query(api.tools.publicAvailable, {
          paginationOpts: { numItems: 20, cursor: null },
        })
        .then((result) => result.page),
    ).toEqual([{ name: "Drill", category: "Power tools" }]);
    await expect(t.mutation(api.tools.create, listing)).rejects.toThrow(
      "Authentication required",
    );
    await expect(
      stranger.mutation(api.tools.edit, { toolId, ...listing }),
    ).rejects.toThrow("Not authorized");
    await expect(
      stranger.mutation(api.tools.archive, { toolId }),
    ).rejects.toThrow("Not authorized");
  });

  it("limits journey views to the signed in participant", async () => {
    const { t, owner, borrower, stranger, toolId } = await setup();
    await expect(t.query(api.tools.board, {})).rejects.toThrow(
      "Authentication required",
    );
    const board = await borrower.query(api.tools.board, {});
    expect(board).toMatchObject([
      { name: "Drill", own: false, available: true },
    ]);
    expect(board[0]).not.toHaveProperty("ownerId");
    expect((await owner.query(api.tools.board, {}))[0].own).toBe(true);
    const requestId = await borrower.mutation(api.requests.create, {
      toolId,
      ...days,
    });
    expect(
      await stranger.query(api.requests.journey, { side: "incoming" }),
    ).toEqual([]);
    expect(
      await stranger.query(api.requests.journey, { side: "outgoing" }),
    ).toEqual([]);
    expect(
      await borrower.query(api.requests.journey, { side: "outgoing" }),
    ).toMatchObject([{ id: requestId, toolName: "Drill", status: "pending" }]);
    await owner.mutation(api.requests.respond, {
      requestId,
      decision: "approved",
    });
    expect(
      await owner.query(api.requests.journey, { side: "incoming" }),
    ).toMatchObject([{ status: "approved" }]);
    expect(
      await borrower.query(api.requests.journey, { side: "outgoing" }),
    ).toMatchObject([{ status: "approved" }]);
  });

  it("validates dates and prohibits requests for one's own tool", async () => {
    const { owner, borrower, toolId } = await setup();
    await expect(
      owner.mutation(api.requests.create, { toolId, ...days }),
    ).rejects.toThrow("own listing");
    await expect(
      borrower.mutation(api.requests.create, {
        toolId,
        startDate: "2030-02-30",
        endDate: "2030-03-01",
      }),
    ).rejects.toThrow("Invalid date range");
    await expect(
      borrower.mutation(api.requests.create, {
        toolId,
        startDate: "2030-01-12",
        endDate: "2030-01-10",
      }),
    ).rejects.toThrow("Invalid date range");
  });

  it("enforces lender decisions, overlapping approvals, participant returns, and history", async () => {
    const { t, owner, borrower, stranger, toolId } = await setup();
    const requestId = await borrower.mutation(api.requests.create, {
      toolId,
      ...days,
    });
    const conflictingId = await stranger.mutation(api.requests.create, {
      toolId,
      startDate: "2030-01-12",
      endDate: "2030-01-13",
    });
    await expect(
      stranger.mutation(api.requests.respond, {
        requestId,
        decision: "approved",
      }),
    ).rejects.toThrow("Not authorized");
    expect(await stranger.query(api.requests.mine, {})).toHaveLength(1);
    expect(await stranger.query(api.requests.incoming, {})).toHaveLength(0);
    await owner.mutation(api.requests.respond, {
      requestId,
      decision: "approved",
    });
    await expect(
      owner.mutation(api.requests.respond, {
        requestId: conflictingId,
        decision: "approved",
      }),
    ).rejects.toThrow("overlap");
    await expect(
      stranger.mutation(api.requests.markReturned, { requestId }),
    ).rejects.toThrow("Not authorized");
    await owner.mutation(api.tools.archive, { toolId });
    expect(
      await t
        .query(api.tools.publicAvailable, {
          paginationOpts: { numItems: 20, cursor: null },
        })
        .then((result) => result.page),
    ).toEqual([]);
    await expect(
      owner.mutation(api.requests.respond, {
        requestId: conflictingId,
        decision: "approved",
      }),
    ).rejects.toThrow("Listing unavailable");
    await borrower.mutation(api.requests.markReturned, { requestId });
    await expect(
      borrower.mutation(api.requests.markReturned, { requestId }),
    ).rejects.toThrow("Invalid request transition");
    expect(await borrower.query(api.requests.mine, {})).toMatchObject([
      { status: "returned", toolId },
    ]);
  });

  it("updates public availability and permits a separate loan after return", async () => {
    const { t, owner, borrower, stranger, toolId } = await setup();
    const first = await borrower.mutation(api.requests.create, {
      toolId,
      ...days,
    });
    await owner.mutation(api.requests.respond, {
      requestId: first,
      decision: "approved",
    });
    expect(
      await t
        .query(api.tools.publicAvailable, {
          paginationOpts: { numItems: 20, cursor: null },
        })
        .then((result) => result.page),
    ).toHaveLength(1);
    vi.setSystemTime(new Date("2030-01-11T12:00:00Z"));
    expect(
      await t
        .query(api.tools.publicAvailable, {
          paginationOpts: { numItems: 20, cursor: null },
        })
        .then((result) => result.page),
    ).toEqual([]);
    vi.setSystemTime(new Date("2030-01-13T12:00:00Z"));
    expect(
      await t
        .query(api.tools.publicAvailable, {
          paginationOpts: { numItems: 20, cursor: null },
        })
        .then((result) => result.page),
    ).toEqual([]);
    await owner.mutation(api.requests.markReturned, { requestId: first });
    expect(
      await t
        .query(api.tools.publicAvailable, {
          paginationOpts: { numItems: 20, cursor: null },
        })
        .then((result) => result.page),
    ).toHaveLength(1);
    const next = await stranger.mutation(api.requests.create, {
      toolId,
      startDate: "2030-01-13",
      endDate: "2030-01-14",
    });
    await owner.mutation(api.requests.respond, {
      requestId: next,
      decision: "approved",
    });
    expect(await stranger.query(api.requests.mine, {})).toMatchObject([
      { status: "approved" },
    ]);
  });

  it("blocks new approvals while an earlier loan is overdue and unreturned", async () => {
    const { owner, borrower, stranger, toolId } = await setup();
    const first = await borrower.mutation(api.requests.create, {
      toolId,
      ...days,
    });
    await owner.mutation(api.requests.respond, {
      requestId: first,
      decision: "approved",
    });
    vi.setSystemTime(new Date("2030-01-13T12:00:00Z"));
    const next = await stranger.mutation(api.requests.create, {
      toolId,
      startDate: "2030-01-13",
      endDate: "2030-01-14",
    });
    await expect(
      owner.mutation(api.requests.respond, {
        requestId: next,
        decision: "approved",
      }),
    ).rejects.toThrow("overdue");
    await borrower.mutation(api.requests.markReturned, { requestId: first });
    await owner.mutation(api.requests.respond, {
      requestId: next,
      decision: "approved",
    });
  });

  it("prevents duplicate pending requests and limits repeated submissions", async () => {
    const { owner, borrower, toolId } = await setup();
    const first = await borrower.mutation(api.requests.create, {
      toolId,
      ...days,
    });
    await expect(
      borrower.mutation(api.requests.create, { toolId, ...days }),
    ).rejects.toThrow("already have a pending");
    await owner.mutation(api.requests.respond, {
      requestId: first,
      decision: "declined",
    });
    for (let i = 0; i < 9; i++) {
      const requestId = await borrower.mutation(api.requests.create, {
        toolId,
        ...days,
      });
      await owner.mutation(api.requests.respond, {
        requestId,
        decision: "declined",
      });
    }
    await expect(
      borrower.mutation(api.requests.create, { toolId, ...days }),
    ).rejects.toThrow("Too many requests");
    vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
    await borrower.mutation(api.requests.create, { toolId, ...days });
  });

  it("caps pending requests even across different tools", async () => {
    const { owner, borrower, toolId } = await setup();
    await borrower.mutation(api.requests.create, { toolId, ...days });
    for (let i = 0; i < 9; i++) {
      const another = await owner.mutation(api.tools.create, {
        ...listing,
        name: `Tool ${i}`,
      });
      await borrower.mutation(api.requests.create, {
        toolId: another,
        ...days,
      });
    }
    const extra = await owner.mutation(api.tools.create, {
      ...listing,
      name: "Extra",
    });
    await expect(
      borrower.mutation(api.requests.create, { toolId: extra, ...days }),
    ).rejects.toThrow("limit of 10 pending");
  });

  it("returns public tools in bounded pages", async () => {
    const { t, owner } = await setup();
    await owner.mutation(api.tools.create, { ...listing, name: "Saw" });
    const first = await t.query(api.tools.publicAvailable, {
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(first.page).toHaveLength(1);
    expect(first.isDone).toBe(false);
    const second = await t.query(api.tools.publicAvailable, {
      paginationOpts: { numItems: 1, cursor: first.continueCursor },
    });
    expect(second.page).toHaveLength(1);
    expect([...first.page, ...second.page].map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["Drill", "Saw"]),
    );
    await expect(
      t.query(api.tools.publicAvailable, {
        paginationOpts: { numItems: 51, cursor: null },
      }),
    ).rejects.toThrow("Invalid page request");
  });

  it("paginates requests and shares contact details only with approved participants", async () => {
    const { t, owner, borrower, stranger, toolId } = await setup();
    await owner.mutation(api.users.updateProfile, {
      displayName: "Owner",
      contact: "owner@example.test",
    });
    await borrower.mutation(api.users.updateProfile, {
      displayName: "Borrower",
      contact: "borrower@example.test",
    });
    const first = await borrower.mutation(api.requests.create, {
      toolId,
      ...days,
    });
    const opts = { numItems: 1, cursor: null };
    const pending = await owner.query(api.requests.journeyPage, {
      side: "incoming",
      paginationOpts: opts,
    });
    expect(pending.page).toMatchObject([
      { neighborName: "Borrower", contact: null },
    ]);
    expect(
      (
        await stranger.query(api.requests.journeyPage, {
          side: "incoming",
          paginationOpts: opts,
        })
      ).page,
    ).toEqual([]);
    expect(
      (await t.query(api.tools.publicAvailable, { paginationOpts: opts })).page,
    ).toEqual([{ name: "Drill", category: "Power tools" }]);
    await owner.mutation(api.requests.respond, {
      requestId: first,
      decision: "approved",
    });
    expect(
      (
        await owner.query(api.requests.journeyPage, {
          side: "incoming",
          paginationOpts: opts,
        })
      ).page,
    ).toMatchObject([
      { neighborName: "Borrower", contact: "borrower@example.test" },
    ]);
    expect(
      (
        await borrower.query(api.requests.journeyPage, {
          side: "outgoing",
          paginationOpts: opts,
        })
      ).page,
    ).toMatchObject([{ neighborName: "Owner", contact: "owner@example.test" }]);
    const second = await stranger.mutation(api.requests.create, {
      toolId,
      startDate: "2030-01-20",
      endDate: "2030-01-21",
    });
    const page1 = await owner.query(api.requests.journeyPage, {
      side: "incoming",
      paginationOpts: opts,
    });
    expect(page1.isDone).toBe(false);
    const page2 = await owner.query(api.requests.journeyPage, {
      side: "incoming",
      paginationOpts: { numItems: 1, cursor: page1.continueCursor },
    });
    expect([...page1.page, ...page2.page].map((item) => item.id)).toEqual(
      expect.arrayContaining([first, second]),
    );
    await expect(
      t.query(api.requests.journeyPage, {
        side: "incoming",
        paginationOpts: opts,
      }),
    ).rejects.toThrow("Authentication required");
  });

  it("refreshes paginated availability for a new UTC day and excludes private data", async () => {
    const { t, owner, borrower, toolId } = await setup();
    const requestId = await borrower.mutation(api.requests.create, {
      toolId,
      ...days,
    });
    await owner.mutation(api.requests.respond, {
      requestId,
      decision: "approved",
    });
    const opts = { numItems: 1, cursor: null };
    const first = await t.query(api.tools.publicAvailable, {
      paginationOpts: opts,
      refreshKey: "2030-01-09",
    });
    expect(first.page).toEqual([{ name: "Drill", category: "Power tools" }]);
    vi.setSystemTime(new Date("2030-01-10T00:00:01Z"));
    const second = await t.query(api.tools.publicAvailable, {
      paginationOpts: opts,
      refreshKey: "2030-01-10",
    });
    expect(second.page).toEqual([]);
  });

  it("keeps admin access server controlled", async () => {
    vi.stubEnv("ADMIN_CLERK_USER_ID", "admin");
    const { t, owner, borrower, admin, toolId } = await setup();
    const borrowerId = await borrower.mutation(api.users.ensureCurrent, {});
    await expect(borrower.query(api.requests.allForAdmin, {})).rejects.toThrow(
      "Not authorized",
    );
    await expect(
      borrower.mutation(api.users.setTrusted, {
        userId: borrowerId,
        trusted: true,
      }),
    ).rejects.toThrow("Not authorized");
    expect((await borrower.query(api.users.current, {})).role).toBe("user");
    await admin.mutation(api.users.setTrusted, {
      userId: borrowerId,
      trusted: true,
    });
    expect((await borrower.query(api.users.current, {})).trustedLender).toBe(
      true,
    );
    expect((await admin.query(api.users.current, {})).role).toBe("admin");
    await admin.mutation(api.tools.archive, { toolId });
    expect(
      await t
        .query(api.tools.publicAvailable, {
          paginationOpts: { numItems: 20, cursor: null },
        })
        .then((result) => result.page),
    ).toEqual([]);
    expect(await owner.query(api.tools.mine, {})).toMatchObject([
      { archived: true },
    ]);
  });

  it("records one reminder per loan and day and never downgrades sent to failed", async () => {
    const { t, borrower, toolId } = await setup();
    const requestId = await borrower.mutation(api.requests.create, {
      toolId,
      ...days,
    });
    const first = await t.mutation(api.reminders.record, {
      requestId,
      day: "2030-01-13",
      status: "failed",
    });
    const second = await t.mutation(api.reminders.record, {
      requestId,
      day: "2030-01-13",
      status: "sent",
    });
    await t.mutation(api.reminders.record, {
      requestId,
      day: "2030-01-13",
      status: "failed",
    });
    expect(second).toBe(first);
    const records = await t.run(
      async (ctx) => await ctx.db.query("reminderRecords").collect(),
    );
    expect(records).toMatchObject([{ status: "sent" }]);
    expect(records).toHaveLength(1);
  });
});
