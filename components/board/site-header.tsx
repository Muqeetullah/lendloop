import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Suspense } from "react";
import Link from "next/link";
import { AccountStatus } from "@/app/account-status";
import { Button } from "@/components/ui/button";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="LendLoop home">
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M14 10.5 11.7 8.2a5.2 5.2 0 0 0-7.4 7.4l4.2 4.2a5.2 5.2 0 0 0 7.4 0l1.2-1.2M18 21.5l2.3 2.3a5.2 5.2 0 0 0 7.4-7.4l-4.2-4.2a5.2 5.2 0 0 0-7.4 0l-1.2 1.2M11.5 20.5l9-9"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        LendLoop<span className="brand__dot">.</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Brand />
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/#tools">Explore tools</Link>
          <Suspense>
            <Show when="signed-in">
              <Link href="/dashboard">Dashboard</Link>
            </Show>
          </Suspense>
          <Link className="site-nav__how" href="/#how-it-works">
            How it works
          </Link>
        </nav>
        <div className="header-account">
          <Suspense
            fallback={<span className="account-loading">Loading account…</span>}
          >
            <Show when="signed-out">
              <SignInButton
                mode="modal"
                forceRedirectUrl="/dashboard"
                signUpForceRedirectUrl="/dashboard"
              >
                <Button
                  variant="secondary"
                  aria-label="Sign in to lend or borrow"
                >
                  <span className="signin-label-long">
                    Sign in to lend or borrow
                  </span>
                  <span className="signin-label-short" aria-hidden="true">
                    Sign in
                  </span>
                  <span aria-hidden="true">↗</span>
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <div className="account">
                <UserButton />
                <AccountStatus />
              </div>
            </Show>
          </Suspense>
        </div>
      </div>
    </header>
  );
}
