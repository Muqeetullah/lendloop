import { Suspense } from "react";
import { SiteHeader } from "@/components/board/site-header";
import {
  LendingWorkspace,
  type DashboardView,
} from "@/components/board/lending-workspace";

const views: DashboardView[] = [
  "tools",
  "listings",
  "requests",
  "incoming",
  "profile",
  "admin",
];

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const requested = (await searchParams).view;
  const view =
    typeof requested === "string" && views.includes(requested as DashboardView)
      ? (requested as DashboardView)
      : "tools";
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="dashboard shell">
        <Suspense fallback={<p role="status">Loading dashboard…</p>}>
          <LendingWorkspace view={view} />
        </Suspense>
      </main>
    </>
  );
}
