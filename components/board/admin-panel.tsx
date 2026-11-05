"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePageCursor } from "@/components/lib/pagination";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";

export function AdminLink({ current }: { current: boolean }) {
  const { isAuthenticated } = useConvexAuth();
  const isAdmin = useQuery(
    api.admin.currentIsAdmin,
    isAuthenticated ? {} : "skip",
  );
  return isAdmin ? (
    <Link
      href="/dashboard?view=admin"
      aria-current={current ? "page" : undefined}
    >
      <span aria-hidden="true">⚙</span>Admin
    </Link>
  ) : null;
}

export function AdminPanel() {
  const admin = useQuery(api.admin.currentIsAdmin);
  if (admin === undefined)
    return (
      <StatePanel
        kind="loading"
        title="Checking access"
        description="Just a moment."
      />
    );
  if (!admin)
    return (
      <StatePanel
        kind="error"
        title="Administrator access required"
        description="This section is available only to an administrator."
      />
    );
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Community oversight</h2>
          <p>Manage listings, trusted lenders, and loans.</p>
        </div>
      </div>
      <AdminListings />
      <AdminLoans />
      <AdminFailures />
    </>
  );
}

function AdminListings() {
  const paging = usePageCursor();
  const page = useQuery(api.admin.listings, {
    paginationOpts: { numItems: 6, cursor: paging.cursor },
  });
  const setTrusted = useMutation(api.users.setTrusted);
  const archive = useMutation(api.tools.archive);
  const [removing, setRemoving] = useState<Id<"tools"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function trust(userId: Id<"users">, trusted: boolean) {
    setBusy(true);
    setMessage("");
    try {
      await setTrusted({ userId, trusted });
      setMessage(
        trusted ? "Lender marked trusted." : "Trusted status removed.",
      );
    } catch {
      setMessage("Couldn’t update trusted status. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(toolId: Id<"tools">) {
    setBusy(true);
    setMessage("");
    try {
      await archive({ toolId });
      setRemoving((current) => (current === toolId ? null : current));
      setMessage("Listing removed. Existing loan history is preserved.");
    } catch {
      setMessage("Couldn’t remove the listing. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-section">
      <h3>Listings and lenders</h3>
      {message && <p role="status">{message}</p>}
      {!page ? (
        <StatePanel
          kind="loading"
          title="Loading listings"
          description="Just a moment."
        />
      ) : page.page.length === 0 ? (
        <StatePanel
          title="No listings on this page"
          description="There are no active listings here."
        />
      ) : (
        <ul className="admin-list">
          {page.page.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>
                  {item.category} · {item.ownerName} ·{" "}
                  {item.trusted ? "Trusted lender" : "Not marked trusted"}
                </p>
              </div>
              <div className="listing-actions">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => trust(item.ownerId, !item.trusted)}
                  aria-label={`${item.trusted ? "Remove trusted status from" : "Mark as trusted"} ${item.ownerName}, lender ${item.ownerId.slice(-6)}`}
                >
                  {item.trusted ? "Remove trusted" : "Mark trusted"}
                </Button>
                {removing === item.id ? (
                  <>
                    <Button disabled={busy} onClick={() => remove(item.id)}>
                      Confirm removal
                    </Button>
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={() => setRemoving(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="quiet"
                    disabled={busy}
                    onClick={() => setRemoving(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove listing
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        label="Admin listings"
        page={paging.page}
        hasNext={page ? !page.isDone : false}
        loading={!page}
        previous={paging.previous}
        next={() => {
          if (page) paging.next(page.continueCursor);
        }}
      />
    </section>
  );
}

function AdminLoans() {
  const paging = usePageCursor();
  const page = useQuery(api.admin.loans, {
    paginationOpts: { numItems: 10, cursor: paging.cursor },
  });
  return (
    <section className="admin-section">
      <h3>All loans</h3>
      {!page ? (
        <StatePanel
          kind="loading"
          title="Loading loans"
          description="Just a moment."
        />
      ) : page.page.length === 0 ? (
        <StatePanel
          title="No loans on this page"
          description={
            page.isDone
              ? "There are no more loans."
              : "There may be loans on the next page."
          }
        />
      ) : (
        <ul className="admin-list">
          {page.page.map((loan) => (
            <li key={loan.id}>
              <div>
                <strong>{loan.toolName}</strong>
                <p>
                  {loan.lenderName} → {loan.borrowerName} · {loan.startDate} to{" "}
                  {loan.endDate} UTC
                </p>
              </div>
              <span className="status-pill">{loan.status}</span>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        label="Admin loans"
        page={paging.page}
        hasNext={page ? !page.isDone : false}
        loading={!page}
        previous={paging.previous}
        next={() => {
          if (page) paging.next(page.continueCursor);
        }}
      />
    </section>
  );
}

function AdminFailures() {
  const paging = usePageCursor();
  const page = useQuery(api.admin.failures, {
    paginationOpts: { numItems: 6, cursor: paging.cursor },
  });
  const retry = useMutation(api.admin.retryNotification);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function retryEvent(eventId: Id<"automationEvents">) {
    setBusy(true);
    setMessage("");
    try {
      await retry({ eventId });
      setMessage("Delivery queued for retry.");
    } catch {
      setMessage("Couldn’t retry delivery. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-section">
      <h3>Failed notifications</h3>
      <p>Scheduled reminder failures appear in n8n execution history.</p>
      {message && <p role="status">{message}</p>}
      {!page ? (
        <StatePanel
          kind="loading"
          title="Loading failures"
          description="Just a moment."
        />
      ) : page.page.length === 0 ? (
        <StatePanel
          title="No failed notifications on this page"
          description="Exhausted notification retries appear here."
        />
      ) : (
        <ul className="admin-list">
          {page.page.map((event) => (
            <li key={event.id}>
              <div>
                <strong>
                  Request {event.requestId.slice(-6)} · {event.eventStatus}
                </strong>
                <p>
                  {event.reason} · {event.attempts} attempts
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => retryEvent(event.id)}
              >
                Retry delivery
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        label="Failed notifications"
        page={paging.page}
        hasNext={page ? !page.isDone : false}
        loading={!page}
        previous={paging.previous}
        next={() => {
          if (page) paging.next(page.continueCursor);
        }}
      />
    </section>
  );
}
