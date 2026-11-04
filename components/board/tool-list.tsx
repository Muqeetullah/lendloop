"use client";

import { useConvexConnectionState, usePaginatedQuery } from "convex/react";
import { Component, useEffect, useState, type ReactNode } from "react";
import { useUtcDay } from "@/components/lib/use-utc-day";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

class CollectionBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <StatePanel
          kind="error"
          title="The tool board is taking a break"
          description="We couldn’t load the available tools. Please try again."
          action={
            <Button
              variant="secondary"
              onClick={() => this.setState({ failed: false })}
            >
              Try again
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

function Collection() {
  const day = useUtcDay();
  const {
    results: tools,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.tools.publicAvailable,
    { refreshKey: day },
    { initialNumItems: 20 },
  );
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const [connectionWaited, setConnectionWaited] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setConnectionWaited(true), 10000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isWebSocketConnected && (hasEverConnected || connectionWaited))
    return (
      <StatePanel
        kind="loading"
        title="Reconnecting to the tool board"
        description="We’ll keep trying. Check your internet connection if this takes a while."
      />
    );
  if (status === "LoadingFirstPage")
    return (
      <StatePanel
        kind="loading"
        title="Looking for tools"
        description="Gathering the latest from the neighborhood."
      />
    );
  return (
    <>
      {tools.length === 0 ? (
        <StatePanel
          title="No available tools on this page"
          description={
            status === "Exhausted"
              ? "There aren’t any more available tools right now."
              : "There may be more tools on the next page."
          }
        />
      ) : (
        <ul className="tool-grid" aria-label="Available tools">
          {tools.map((tool, index) => (
            <li
              className="tool-card"
              key={`${tool.name}-${tool.category}-${index}`}
            >
              <div className="tool-card__symbol" aria-hidden="true">
                <ToolIcon />
              </div>
              <div>
                <p className="tool-card__category">{tool.category}</p>
                <h3>{tool.name}</h3>
              </div>
              <span className="tool-card__available">Available</span>
            </li>
          ))}
        </ul>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="load-more">
          <Button
            variant="secondary"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(20)}
          >
            {status === "LoadingMore" ? "Loading…" : "Show more tools"}
          </Button>
        </div>
      )}
    </>
  );
}

function ToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 6.2a5 5 0 0 0-6.1 6.1l-5.1 5.1a2 2 0 0 0 2.8 2.8l5.1-5.1a5 5 0 0 0 6.1-6.1L14 12l-3-3 3.5-2.8Z" />
    </svg>
  );
}

export function ToolList() {
  return (
    <CollectionBoundary>
      <Collection />
    </CollectionBoundary>
  );
}
