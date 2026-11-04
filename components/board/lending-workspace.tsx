"use client";

import { Show } from "@clerk/nextjs";
import {
  useConvexAuth,
  useMutation,
  useQuery,
  usePaginatedQuery,
} from "convex/react";
import {
  Component,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useUtcDay } from "@/components/lib/use-utc-day";
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

export function LendingWorkspace() {
  return (
    <Show when="signed-in">
      <section
        className="workspace shell"
        id="workspace"
        aria-labelledby="workspace-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR NEIGHBORHOOD</p>
            <h2 id="workspace-heading">Let’s share something.</h2>
            <p>List a tool, ask to borrow, and keep track of requests.</p>
          </div>
        </div>
        <WorkspaceBoundary>
          <ConnectWorkspace />
        </WorkspaceBoundary>
      </section>
    </Show>
  );
}

function ConnectWorkspace() {
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
  return <Workspace />;
}

function Workspace() {
  const day = useUtcDay();
  const [category, setCategory] = useState("");
  const tools = usePaginatedQuery(
    api.tools.boardPage,
    { refreshKey: day, ...(category ? { category } : {}) },
    { initialNumItems: 12 },
  );
  const incoming = usePaginatedQuery(
    api.requests.journeyPage,
    { side: "incoming" },
    { initialNumItems: 10 },
  );
  const outgoing = usePaginatedQuery(
    api.requests.journeyPage,
    { side: "outgoing" },
    { initialNumItems: 10 },
  );
  const [showForm, setShowForm] = useState(false);
  const [requestTool, setRequestTool] = useState<Id<"tools"> | null>(null);
  if (
    incoming.status === "LoadingFirstPage" ||
    outgoing.status === "LoadingFirstPage"
  )
    return (
      <StatePanel
        kind="loading"
        title="Gathering your tools"
        description="Just a moment."
      />
    );
  return (
    <>
      <ProfileEditor />
      <div className="workspace-heading">
        <div>
          <h3>Neighborhood tools</h3>
          <p>Availability is based on today in UTC.</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "secondary" : "primary"}
        >
          {showForm ? "Close form" : "+ List a tool"}
        </Button>
      </div>
      {showForm && <ListingForm onDone={() => setShowForm(false)} />}
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
      {tools.status === "LoadingFirstPage" ? (
        <StatePanel
          kind="loading"
          title="Loading neighborhood tools"
          description="Just a moment."
        />
      ) : tools.results.length === 0 ? (
        <StatePanel
          title={
            category ? "No tools in this category" : "Be the first to share"
          }
          description={
            category
              ? "Choose another category to see more tools."
              : "Add a tool to get your neighborhood started."
          }
        />
      ) : (
        <ul className="journey-grid">
          {tools.results.map((tool) => (
            <li className="journey-card" key={tool.id}>
              <div className="journey-card__top">
                <span className="tool-card__category">{tool.category}</span>
                <span className="status-pill">
                  {tool.own ? "Your listing · " : ""}
                  {tool.available ? "Available today" : "On loan"}
                </span>
              </div>
              <h4>{tool.name}</h4>
              <p>{tool.description}</p>
              <p className="journey-meta">Condition: {tool.condition}</p>
              {!tool.own && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setRequestTool(requestTool === tool.id ? null : tool.id)
                  }
                >
                  {requestTool === tool.id
                    ? "Close request"
                    : "Request to borrow"}
                </Button>
              )}
              {requestTool === tool.id && (
                <RequestForm
                  toolId={tool.id}
                  onDone={() => setRequestTool(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {(tools.status === "CanLoadMore" || tools.status === "LoadingMore") && (
        <div className="load-more">
          <Button
            variant="secondary"
            disabled={tools.status === "LoadingMore"}
            onClick={() => tools.loadMore(12)}
          >
            {tools.status === "LoadingMore"
              ? "Loading…"
              : "Show more neighborhood tools"}
          </Button>
        </div>
      )}
      <MyListings />
      <div className="request-columns">
        <RequestList
          title="Incoming requests"
          empty="Requests for your tools will appear here."
          requests={incoming.results}
          paginationStatus={incoming.status}
          loadMore={() => incoming.loadMore(10)}
          incoming
        />
        <RequestList
          title="My requests"
          empty="Your requests to borrow will appear here."
          requests={outgoing.results}
          paginationStatus={outgoing.status}
          loadMore={() => outgoing.loadMore(10)}
        />
      </div>
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
    } catch {
      setError(
        "We couldn’t send your request. Check the dates. You can have one pending request per tool, up to 10 pending requests, and make up to 10 requests per hour.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="request-form" onSubmit={submit}>
      <p>Choose inclusive dates in UTC. The owner will review your request.</p>
      <Field type="date" name="startDate" label="From" required />
      <Field type="date" name="endDate" label="Until" required />
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
  contact: string | null;
};
function RequestList({
  title,
  empty,
  requests,
  incoming = false,
  paginationStatus,
  loadMore,
}: {
  title: string;
  empty: string;
  requests: RequestItem[];
  incoming?: boolean;
  paginationStatus:
    "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: () => void;
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
    } catch {
      setError(
        "Couldn’t update the request. It may overlap another loan, have expired, or an overdue loan may need to be returned first.",
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
    } catch {
      setError("Couldn’t mark this loan returned. Please try again.");
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
                <span className="status-pill">{request.status}</span>
              </div>
              {incoming && request.status === "pending" && (
                <div className="request-actions">
                  <Button
                    disabled={busy !== null}
                    aria-label={`Approve ${request.toolName} for ${request.neighborName}, ${request.startDate} to ${request.endDate}, request ${request.id.slice(-6)}`}
                    onClick={() => decide(request.id, "approved")}
                  >
                    Approve
                  </Button>
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
      {(paginationStatus === "CanLoadMore" ||
        paginationStatus === "LoadingMore") && (
        <Button
          variant="secondary"
          disabled={paginationStatus === "LoadingMore"}
          onClick={loadMore}
        >
          {paginationStatus === "LoadingMore"
            ? "Loading…"
            : "Show more requests"}
        </Button>
      )}
    </section>
  );
}
