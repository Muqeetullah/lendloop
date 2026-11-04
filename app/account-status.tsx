"use client";

import {
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
} from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

export function AccountStatus() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void ensureCurrent({})
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, ensureCurrent, attempt]);

  if (!isWebSocketConnected && hasEverConnected)
    return <span role="status">Reconnecting your account…</span>;
  if (isLoading || (isAuthenticated && status === "loading"))
    return <span role="status">Connecting your account…</span>;
  if (!isAuthenticated || status === "error")
    return (
      <span role="status">
        Couldn’t connect your account.{" "}
        <button
          className="account__retry"
          onClick={() => {
            if (!isAuthenticated) {
              window.location.reload();
              return;
            }
            setStatus("loading");
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
      </span>
    );
  return (
    <span className="account-status-ready" role="status">
      Account connected
    </span>
  );
}
