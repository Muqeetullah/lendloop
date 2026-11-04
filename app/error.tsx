"use client";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function RouteError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="shell error-page">
      <h1>Page unavailable</h1>
      <StatePanel
        kind="error"
        title="Something went wrong"
        description="We couldn’t load this page. Please try again."
        action={
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
