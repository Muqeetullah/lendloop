"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Component,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePageCursor } from "@/components/lib/pagination";
import { AdminLink, AdminPanel } from "@/components/board/admin-panel";
import { Pagination } from "@/components/ui/pagination";
import { useUtcDay } from "@/components/lib/use-utc-day";
import { requestErrorMessage } from "@/components/board/request-errors";
import {
  categories,
  ListingForm,
  MyListings,
} from "@/components/board/listing-management";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { StatePanel } from "@/components/ui/state-panel";

class WorkspaceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <StatePanel
        kind="error"
        title="Couldn’t load your workspace"
        description="Please try again."
        action={
          <Button
            variant="secondary"
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </Button>
        }
      />
    ) : (
      this.props.children
    );
  }
}

export type DashboardView =
  "tools" | "listings" | "requests" | "incoming" | "profile" | "admin";
const dashboardLinks: { view: DashboardView; label: string; icon: string }[] = [
  { view: "tools", label: "Browse tools", icon: "⌂" },
  { view: "listings", label: "My listings", icon: "▤" },
  { view: "requests", label: "My requests", icon: "↗" },
  { view: "incoming", label: "Incoming requests", icon: "↙" },
  { view: "profile", label: "Sharing details", icon: "✳" },
];

export function LendingWorkspace({ view }: { view: DashboardView }) {
  return (
    <>
      <Show when="signed-in">
        <div className="dashboard-header">
          <p className="eyebrow">YOUR NEIGHBORHOOD</p>
          <h1>Your LendLoop.</h1>
          <p>A little more sharing, all in one place.</p>
        </div>
        <div className="dashboard-layout">
          <nav className="dashboard-nav" aria-label="Dashboard navigation">
            {dashboardLinks.map((link) => (
              <Link
                key={link.view}
                href={`/dashboard?view=${link.view}`}
                aria-current={view === link.view ? "page" : undefined}
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </Link>
            ))}
            <AdminLink current={view === "admin"} />
          </nav>
          <div className="dashboard-content">
            <WorkspaceBoundary>
              <ConnectWorkspace view={view} />
            </WorkspaceBoundary>
          </div>
        </div>
      </Show>
      <Show when="signed-out">
        <div className="dashboard-signed-out">
          <StatePanel
            title="Sign in to your dashboard"
            description="Sign in to list tools and manage your requests."
            action={
              <SignInButton
                mode="modal"
                forceRedirectUrl={`/dashboard?view=${view}`}
                signUpForceRedirectUrl={`/dashboard?view=${view}`}
              >
                <Button>Sign in to lend or borrow</Button>
              </SignInButton>
            }
          />
        </div>
      </Show>
    </>
  );
}

function ConnectWorkspace({ view }: { view: DashboardView }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensure = useMutation(api.users.ensureCurrent);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void ensure({})
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, ensure, attempt]);
  if (failed)
    return (
      <StatePanel
        kind="error"
        title="Couldn’t connect your account"
        description="Please check your connection and try again."
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </Button>
        }
      />
    );
  if (isLoading || !isAuthenticated || !ready)
    return (
      <StatePanel
        kind="loading"
        title="Preparing your workspace"
        description="Connecting your account to the board."
      />
    );
  return <Workspace view={view} />;
}

function Workspace({ view }: { view: DashboardView }) {
  if (view === "admin") return <AdminPanel />;
  if (view === "listings") return <MyListings />;
  if (view === "requests")
    return <RequestSection key="outgoing" side="outgoing" />;
  if (view === "incoming")
    return <RequestSection key="incoming" side="incoming" />;
  if (view === "profile")
    return (
      <>
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">YOUR PROFILE</p>
            <h2>Sharing details</h2>
            <p>Choose how neighbors can recognize and reach you.</p>
          </div>
        </div>
        <ProfileEditor />
      </>
    );
  return <ToolBrowser />;
}

function ToolBrowser() {
  const day = useUtcDay();
  const [category, setCategory] = useState("");
  const [createSession, setCreateSession] = useState<object | null>(null);
  const [requestTool, setRequestTool] = useState<{
    id: Id<"tools">;
    name: string;
  } | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const requestPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (requestTool) requestPanel.current?.focus();
  }, [requestTool]);
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">THE SHARED SHED</p>
          <h2>Browse tools</h2>
          <p>
            Find something useful nearby. Availability is based on today in UTC.
          </p>
        </div>
        <Button
          onClick={() => setCreateSession((current) => (current ? null : {}))}
          variant={createSession ? "secondary" : "primary"}
        >
          {createSession ? "Close form" : "+ List a tool"}
        </Button>
      </div>
      {createSession && (
        <ListingForm
          onDone={() =>
            setCreateSession((current) =>
              current === createSession ? null : current,
            )
          }
        />
      )}
      <div className="category-filter">
        <label className="field__label" htmlFor="board-category">
          Filter by category
        </label>
        <select
          id="board-category"
          className="field__input"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {requestMessage && (
        <p role="status" className="listing-message">
          {requestMessage}
        </p>
      )}
      {requestTool && (
        <div
          ref={requestPanel}
          tabIndex={-1}
          className="request-draft"
          aria-labelledby="request-draft-heading"
        >
          <div className="request-draft__heading">
            <h3 id="request-draft-heading">Request {requestTool.name}</h3>
            <Button variant="quiet" onClick={() => setRequestTool(null)}>
              Close
            </Button>
          </div>
          <RequestForm
            key={requestTool.id}
            toolId={requestTool.id}
            onDone={() => {
              setRequestMessage(
                "Request sent. You can follow its status under My requests.",
              );
              setRequestTool((current) =>
                current === requestTool ? null : current,
              );
            }}
          />
        </div>
      )}
      <ToolResults
        key={`${category}:${day}`}
        category={category}
        day={day}
        requestTool={requestTool}
        onToggleRequest={(tool) => {
          setRequestMessage("");
          setRequestTool((current) => (current?.id === tool.id ? null : tool));
        }}
      />
    </>
  );
}

function ToolResults({
  category,
  day,
  requestTool,
  onToggleRequest,
}: {
  category: string;
  day: string;
  requestTool: { id: Id<"tools">; name: string } | null;
  onToggleRequest: (tool: { id: Id<"tools">; name: string }) => void;
}) {
  const paging = usePageCursor();
  const tools = useQuery(api.tools.boardPage, {
    refreshKey: day,
    ...(category ? { category } : {}),
    paginationOpts: { numItems: 6, cursor: paging.cursor },
  });
  return (
    <>
      {!tools ? (
        <StatePanel
          kind="loading"
          title="Loading neighborhood tools"
          description="Just a moment."
        />
      ) : tools.page.length === 0 ? (
        <StatePanel
          title={
            category ? "No tools in this category" : "No tools on this page"
          }
          description={
            category
              ? "Choose another category to see more tools."
              : "Try another page or list a tool to get started."
          }
        />
      ) : (
        <ul className="journey-grid">
          {tools.page.map((tool) => (
            <li className="journey-card" key={tool.id}>
              <div className="journey-card__top">
                <span className="tool-card__category">{tool.category}</span>
                <span className="status-pill">
                  {tool.own ? "Your listing · " : ""}
                  {tool.available ? "Available today" : "On loan"}
                </span>
              </div>
              <h3>{tool.name}</h3>
              {tool.trustedLender && (
                <span className="trusted-badge">Trusted lender</span>
              )}
              <p>{tool.description}</p>
              <p className="journey-meta">Condition: {tool.condition}</p>
              {!tool.own && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    onToggleRequest({ id: tool.id, name: tool.name })
                  }
                >
                  {requestTool?.id === tool.id
                    ? "Close request"
                    : "Request to borrow"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination
        label="Neighborhood tools"
        page={paging.page}
        hasNext={tools ? !tools.isDone : false}
        loading={!tools}
        previous={paging.previous}
        next={() => {
          if (tools) paging.next(tools.continueCursor);
        }}
      />
    </>
  );
}

function RequestSection({ side }: { side: "incoming" | "outgoing" }) {
  const paging = usePageCursor();
  const result = useQuery(api.requests.journeyPage, {
    side,
    paginationOpts: { numItems: 5, cursor: paging.cursor },
  });
  const incoming = side === "incoming";
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">{incoming ? "LENDING" : "BORROWING"}</p>
          <h2>{incoming ? "Incoming requests" : "My requests"}</h2>
          <p>
            {incoming
              ? "Review requests for tools you share."
              : "Keep track of tools you have asked to borrow."}
          </p>
        </div>
      </div>
      {!result ? (
        <StatePanel
          kind="loading"
          title="Loading requests"
          description="Just a moment."
        />
      ) : (
        <RequestList
          title={incoming ? "Incoming requests" : "My requests"}
          empty={
            incoming
              ? "Requests for your tools will appear here."
              : "Your requests to borrow will appear here."
          }
          requests={result.page}
          incoming={incoming}
        />
      )}
      <Pagination
        label={incoming ? "Incoming requests" : "My requests"}
        page={paging.page}
        hasNext={result ? !result.isDone : false}
        loading={!result}
        previous={paging.previous}
        next={() => {
          if (result) paging.next(result.continueCursor);
        }}
      />
    </>
  );
}

function ProfileEditor() {
  const profile = useQuery(api.users.profile);
  const update = useMutation(api.users.updateProfile);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!profile) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await update({
        displayName: String(form.get("displayName") ?? ""),
        contact: String(form.get("contact") ?? ""),
      });
      setOpen(false);
      setMessage("Sharing details saved.");
    } catch {
      setMessage("Couldn’t save your details. Check the name and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-panel">
      <div>
        <h3>Your sharing details</h3>
        <p>
          {profile.displayName
            ? `You appear as ${profile.displayName}.`
            : "Add a name so neighbors can recognize you."}{" "}
          Your optional contact is shared only with the other person after a
          loan is approved.
        </p>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(!open);
          setMessage("");
        }}
      >
        {open ? "Close details" : "Edit details"}
      </Button>
      {message && <p role="status">{message}</p>}
      {open && (
        <form className="profile-form" onSubmit={submit}>
          <Field
            label="Name for your neighbors"
            name="displayName"
            defaultValue={profile.displayName}
            maxLength={80}
            required
          />
          <Field
            label="Contact for arranging a handoff (optional)"
            name="contact"
            defaultValue={profile.contact}
            maxLength={160}
            hint="For example, an email address or another way to reach you."
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save details"}
          </Button>
        </form>
      )}
    </div>
  );
}

function RequestForm({
  toolId,
  onDone,
}: {
  toolId: Id<"tools">;
  onDone: () => void;
}) {
  const create = useMutation(api.requests.create);
  const today = useUtcDay();
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startDate = String(form.get("startDate") ?? "");
    const endDate = String(form.get("endDate") ?? "");
    if (
      startDate < new Date().toISOString().slice(0, 10) ||
      endDate < startDate
    ) {
      setError(
        "Choose a start date today or later, and an end date on or after it.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await create({ toolId, startDate, endDate });
      onDone();
    } catch (error) {
      setError(
        requestErrorMessage(
          error,
          "We couldn’t send your request. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="request-form" onSubmit={submit}>
      <p>Choose inclusive dates in UTC. The owner will review your request.</p>
      <Field
        type="date"
        name="startDate"
        label="From"
        min={today}
        value={startDate}
        onChange={(event) => setStartDate(event.target.value)}
        required
      />
      <Field
        type="date"
        name="endDate"
        label="Until"
        min={startDate || today}
        required
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}

type RequestItem = {
  id: Id<"requests">;
  toolName: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "declined" | "returned";
  neighborName: string;
  toolArchived: boolean;
  activity: { kind: "notification" | "reminder"; status: string; at: number }[];
  contact: string | null;
};
function RequestList({
  title,
  empty,
  requests,
  incoming = false,
}: {
  title: string;
  empty: string;
  requests: RequestItem[];
  incoming?: boolean;
}) {
  const respond = useMutation(api.requests.respond);
  const markReturned = useMutation(api.requests.markReturned);
  const [busy, setBusy] = useState<Id<"requests"> | null>(null);
  const [error, setError] = useState("");
  async function decide(
    requestId: Id<"requests">,
    decision: "approved" | "declined",
  ) {
    setBusy(requestId);
    setError("");
    try {
      await respond({ requestId, decision });
    } catch (error) {
      setError(
        requestErrorMessage(
          error,
          "Couldn’t update the request. Please try again.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }
  async function returnLoan(requestId: Id<"requests">) {
    setBusy(requestId);
    setError("");
    try {
      await markReturned({ requestId });
    } catch (error) {
      setError(
        requestErrorMessage(
          error,
          "Couldn’t mark this loan returned. Please try again.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="request-list">
      <h3>{title}</h3>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {requests.length === 0 ? (
        <p className="journey-meta">{empty}</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <li key={request.id}>
              <div>
                <h4>{request.toolName}</h4>
                <p className="journey-meta">
                  {request.startDate} to {request.endDate} · UTC
                </p>
                <p className="journey-meta">
                  {incoming ? "Borrower" : "Lender"}: {request.neighborName} ·
                  Request {request.id.slice(-6)}
                </p>
                {request.status === "approved" && (
                  <p className="journey-meta">
                    {request.contact
                      ? `Contact: ${request.contact}`
                      : "No contact details shared yet."}
                  </p>
                )}
                {request.toolArchived && (
                  <p className="journey-meta">
                    Listing removed
                    {incoming && request.status === "pending"
                      ? "; this request can be declined."
                      : "."}
                  </p>
                )}
                <span className="status-pill">{request.status}</span>
                {request.activity.length > 0 && (
                  <div className="automation-activity">
                    <p>Automation activity</p>
                    <ul>
                      {request.activity.map((item, index) => (
                        <li key={`${item.kind}-${item.at}-${index}`}>
                          {item.kind === "reminder"
                            ? "Mock reminder"
                            : "Mock request notification"}
                          : {item.status} ·{" "}
                          {new Date(item.at).toISOString().slice(0, 10)} UTC
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {incoming && request.status === "pending" && (
                <div className="request-actions">
                  {!request.toolArchived && (
                    <Button
                      disabled={busy !== null}
                      aria-label={`Approve ${request.toolName} for ${request.neighborName}, ${request.startDate} to ${request.endDate}, request ${request.id.slice(-6)}`}
                      onClick={() => decide(request.id, "approved")}
                    >
                      Approve
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    aria-label={`Decline ${request.toolName} for ${request.neighborName}, ${request.startDate} to ${request.endDate}, request ${request.id.slice(-6)}`}
                    onClick={() => decide(request.id, "declined")}
                  >
                    Decline
                  </Button>
                </div>
              )}
              {request.status === "approved" && (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  aria-label={`Mark ${request.toolName}, request ${request.id.slice(-6)}, returned`}
                  onClick={() => returnLoan(request.id)}
                >
                  Mark returned
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
