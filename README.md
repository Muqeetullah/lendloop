# LendLoop

**Borrow what you need. Lend what you don’t.**

LendLoop is a neighborhood tool-lending board built for a take-home assignment. Visitors can browse available tools, while signed-in neighbors can list tools, arrange loans, and track requests. An administrator can moderate listings, review loans, and mark trusted lenders. Two n8n workflows handle request notifications and overdue reminders.

> **Demo scope:** Notifications are mock records stored in Convex; the app does not send real emails or messages. The admin dashboard and end-to-end Convex–n8n integration still require verification with a configured development deployment. See [Testing](#testing) for what has been checked.

## Contents

- [Features and roles](#features-and-roles)
- [Technology stack](#technology-stack)
- [How the project was handled](#how-the-project-was-handled)
- [Architecture and data](#architecture-and-data)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
- [n8n setup](#n8n-setup)
- [Security and privacy](#security-and-privacy)
- [Automation and reliability](#automation-and-reliability)
- [Testing](#testing)
- [Production improvements](#production-improvements)

## Features and roles

| Visitor                                    | Signed-in user                                              | Administrator                                               |
| ------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Browse available tool names and categories | Create, edit, and archive their own listings                | Archive any listing                                         |
| Sign in or create an account               | Request a tool and see their incoming and outgoing requests | View approved and returned loans                            |
|                                            | Approve or decline requests for their own tools             | Mark or unmark a lender as trusted                          |
|                                            | Mark an approved loan returned as lender or borrower        | Inspect and retry exhausted request-notification deliveries |

The authenticated dashboard separates browsing, listings, requests, incoming requests, and sharing details. Lists are paginated, tools can be filtered by category, and request participants see recent automation activity. Route and global error boundaries offer a retry action.

### Lending rules

- Dates are inclusive UTC calendar days. New requests start today or later, and a user cannot request their own listing.
- Pending requests do not reserve a tool. Approval rejects overlapping approved loans, requests with a start date in the past, and new approvals while an earlier loan is overdue and unreturned.
- Either participant may mark an approved loan returned.
- Removing a listing archives it. Existing request and loan history remains, and an approved loan can still be returned.
- Each borrower may have at most 10 pending requests, only one pending request per tool, and at most 10 new requests in an hour. These per-account limits are basic abuse controls and do not prevent multiple-account abuse.

## Technology stack

| Technology                               | Purpose                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Next.js App Router and React             | Public landing page, authenticated dashboard, routing, and error boundaries                              |
| TypeScript                               | Shared type safety across the interface and backend                                                      |
| Tailwind CSS and project CSS             | Responsive styling and reusable interface components                                                     |
| Clerk                                    | Sign-up, sign-in, sessions, and identity                                                                 |
| Convex                                   | Database, authenticated queries and mutations, HTTP actions, scheduling, and transactional backend logic |
| n8n                                      | Self-hosted request-notification and daily overdue-reminder workflows                                    |
| Docker Compose                           | Reproducible local n8n service configuration                                                             |
| Vitest, Testing Library, and convex-test | UI and simulated backend tests                                                                           |
| ESLint, TypeScript, and Prettier         | Code quality and formatting checks                                                                       |

## How the project was handled

The application was built in small, working slices, starting with an architecture and access model, then proving a real sign-in and lending journey before extending it:

1. Set up the Next.js foundation and coding conventions; define the Convex schema and server-side authorization rules.
2. Connect Clerk and Convex, then build and test the first tool listing, request, and approval path.
3. Add public discovery, listing management, returns, participant contact details, a focused dashboard, and pagination.
4. Add administrator controls, signed n8n integrations, retry and idempotency handling, and loan activity.
5. Document setup, verification, security decisions, and the remaining production work.

The project scope and decisions are recorded in [`docs/scope/scope.md`](docs/scope/scope.md) and [`docs/specs/`](docs/specs/). The scope records which live-service checks are still outstanding.

## Architecture and data

```text
Browser ── Next.js / React ── Clerk session
   │                              │
   └──────── Convex client ───────┘
                  │
          Convex queries and mutations
          (identity, authorization, data)
                  │
          Convex database and scheduler
                  │
       signed webhook       signed HTTP actions
                  └──── n8n ────┘
```

Clerk authenticates the user. Convex validates the configured Clerk issuer and `convex` token audience, then its functions independently enforce roles, ownership, validation, and request transitions. The UI adapts to the user's role, but hidden buttons are not treated as an authorization boundary.

The main Convex tables are:

| Table              | Purpose                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `users`            | Clerk identity reference, optional sharing details, and trusted-lender flag |
| `tools`            | Listing details, owner, and archive state                                   |
| `requests`         | Lender, borrower, tool, date range, and request/loan status                 |
| `automationEvents` | Request-notification recipient, delivery state, attempts, and timestamps    |
| `reminderRecords`  | Per-loan, per-day mock reminder outcome                                     |

Indexes support owner and participant queries, category browsing, overlap checks, overdue paging, and recovery of pending automation events.

## Project structure

```text
lendloop/
├── app/                         # App Router pages, layout, providers, and error boundaries
│   ├── dashboard/               # Authenticated workspace route
│   ├── sign-in/ and sign-up/    # Clerk authentication routes
│   └── globals.css              # Global styles and component styling
├── components/
│   ├── board/                   # Landing page, dashboard, listings, requests, and admin UI
│   ├── ui/                      # Reusable buttons, fields, pagination, and states
│   └── lib/                     # Shared UI helpers
├── convex/
│   ├── schema.ts                # Tables, validators, and indexes
│   ├── users.ts, tools.ts       # User profiles and listing functions
│   ├── requests.ts, admin.ts    # Lending transitions and admin functions
│   ├── automation.ts, http.ts   # Delivery, reminder logic, and signed HTTP endpoints
│   ├── crons.ts, reminders.ts   # Recovery schedule and reminder operations
│   ├── lib/                     # Access, input validation, signatures, and event helpers
│   └── _generated/              # Convex-generated types and bindings
├── n8n/workflows/               # Importable workflow JSON exports
├── docs/scope/ and docs/specs/  # Scope, architecture, and design decisions
├── docker-compose.yml           # Local self-hosted n8n service
├── .env.example                 # App environment variable names
└── .env.n8n.example             # n8n environment variable names
```

Tests are kept alongside the relevant components and Convex functions. [`design.md`](design.md) records the interface direction, and [`AGENTS.md`](AGENTS.md) records repository conventions.

## Local setup

### Prerequisites

- Node.js 24 and npm.
- A Clerk development application and a Convex development deployment.
- Docker Desktop and Docker Compose for n8n.
- For request notifications from cloud-hosted Convex: an HTTPS ingress that forwards **only** `/webhook/lendloop-request` to local n8n. Convex cannot reach your computer's `localhost`. An ingress or tunnel is not supplied by this repository; keep the n8n editor private.

### 1. Install the application

```bash
git clone <your-repository-url>
cd lendloop
npm ci
cp .env.example .env.local
```

### 2. Configure Clerk and Convex

1. Run `npx convex dev`. Sign in and create or select a development deployment. The CLI fills in the local Convex deployment settings. The first sync may fail until the issuer in step 3 is configured.
2. Create a Clerk development application and configure its Convex integration/session claims for the `convex` audience. Copy the Clerk publishable and secret keys into `.env.local`; use `.env.example` for the variable names.
3. In the Convex dashboard, set `CLERK_JWT_ISSUER_DOMAIN` to your Clerk frontend API URL. Set `ADMIN_CLERK_USER_ID` to the exact Clerk user ID of the account you want as administrator. If this variable is absent, no account receives admin access.
4. Run `npx convex dev` again and leave it running to sync backend changes.
5. In a separate terminal, start the app:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000), sign in, and set your optional sharing details in the dashboard. A Convex user record is initialized after the authenticated connection.

Keep real credentials out of Git, issue comments, and exported workflow JSON. The example files contain variable names only; `.env.local` and `.env.n8n` are ignored by Git.

### Environment variables

| Location                        | Variable                                                                     | Purpose                                          |
| ------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `.env.local`                    | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                                          | Clerk publishable key for the browser            |
| `.env.local`                    | `CLERK_SECRET_KEY`                                                           | Clerk server-side secret key                     |
| `.env.local`                    | `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`             | Local authentication routes                      |
| `.env.local`                    | `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex development deployment and URLs           |
| Convex dashboard                | `CLERK_JWT_ISSUER_DOMAIN`                                                    | Clerk issuer accepted by Convex                  |
| Convex dashboard                | `ADMIN_CLERK_USER_ID`                                                        | Exact Clerk user ID for the demo administrator   |
| Convex dashboard                | `N8N_REQUEST_WEBHOOK_URL`                                                    | HTTPS URL of the published notification webhook  |
| Convex dashboard and `.env.n8n` | `CONVEX_TO_N8N_SECRET`                                                       | Signing key for Convex → n8n messages            |
| Convex dashboard and `.env.n8n` | `N8N_TO_CONVEX_SECRET`                                                       | Different signing key for n8n → Convex requests  |
| `.env.n8n`                      | `N8N_ENCRYPTION_KEY`                                                         | Stable key for n8n's encrypted credentials       |
| `.env.n8n`                      | `CONVEX_SITE_URL`                                                            | Convex HTTP actions URL ending in `.convex.site` |
| `.env.n8n`                      | `N8N_WEBHOOK_BASE_URL`                                                       | HTTPS base URL of the webhook-only ingress       |

## n8n setup

The supplied workflows target **self-hosted n8n**, with environment access and the `crypto` built-in enabled by the Compose configuration. They are not intended to be imported unchanged into n8n Cloud.

1. Copy the example file:

   ```bash
   cp .env.n8n.example .env.n8n
   ```

2. Generate three **independent** random values of at least 32 bytes—for example, run `openssl rand -hex 32` once for each of `N8N_ENCRYPTION_KEY`, `CONVEX_TO_N8N_SECRET`, and `N8N_TO_CONVEX_SECRET`. Place them in `.env.n8n` and keep them private. Keep `N8N_ENCRYPTION_KEY` stable across restarts so existing n8n credentials remain decryptable.
3. In `.env.n8n`, set `CONVEX_SITE_URL` to your deployment's `.convex.site` URL and `N8N_WEBHOOK_BASE_URL` to the HTTPS base URL of your webhook-only ingress, without a trailing path. Do not use the `.convex.cloud` URL for HTTP actions.
4. In the Convex dashboard, set both signing secrets to the corresponding values from `.env.n8n`. Set `N8N_REQUEST_WEBHOOK_URL` to `https://YOUR-INGRESS/webhook/lendloop-request`.
5. Start the service:

   ```bash
   docker compose --env-file .env.n8n up -d
   ```

6. Open [http://localhost:5678](http://localhost:5678), complete n8n's local owner setup, import both files in [`n8n/workflows/`](n8n/workflows/), and publish/activate them. The reminder workflow has a manual test trigger and a daily schedule at **09:00 UTC**.

The Compose file binds n8n to loopback and sets `N8N_SECURE_COOKIE=false` for local HTTP. Workflow editors can access workflow environment variables, so restrict access to the editor. Docker's `n8n_data` volume preserves service data. Stop the service with `docker compose --env-file .env.n8n down`.

## Security and privacy

The following controls address risks described in the [OWASP Top 10:2025](https://top10.owasp.org/2025/) and [OWASP API Security Top 10:2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/). They are implementation decisions, not a claim of OWASP certification or production readiness.

| Concern                           | Control in this project                                                                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication                    | Clerk manages sessions. Convex checks the configured issuer and audience before functions use the user's identity.                                                                                                             |
| Object and function authorization | Convex checks ownership and participation on listing and request operations. Admin functions check the configured Clerk user ID on the server; the UI alone does not grant access.                                             |
| Data minimization                 | The public tool query returns only name and category. Contact details are visible only to the other participant while a loan is approved. n8n receives opaque identifiers rather than contact details or listing descriptions. |
| Input and resource bounds         | Convex validators check types; backend logic validates date ranges and text lengths, limits page sizes, and applies per-account request limits.                                                                                |
| Integration integrity             | Both directions use separate HMAC-SHA256 secrets and timestamped signatures. Receivers reject invalid or expired signatures, and Convex HTTP actions validate expected payload fields.                                         |
| Secret handling                   | Real secrets live in local environment files and Convex configuration, not committed workflow exports. The n8n editor must remain restricted because workflow code can read its environment.                                   |
| Failures and visibility           | Request delivery has bounded retries, recovery, and an admin failure view; n8n retains failed executions. UI error boundaries show a retry action without exposing backend details.                                            |
| Replay and duplication            | Signed write-backs are idempotent: a notification event is recorded once, and an overdue reminder is recorded at most once per loan and UTC day.                                                                               |

Timestamp validation limits the replay window; idempotent writes prevent repeated valid callbacks from creating additional mock records. It does not provide a general nonce-based replay cache. The per-account limits are not a complete rate-limiting or anti-abuse system.

## Automation and reliability

### Request notification

1. Creating a request, approving or declining it, or returning a loan atomically writes an automation event with the state change.
2. Convex sends n8n only the event ID, a timestamp, and a signature. The relevant recipient remains associated with the event in Convex.
3. The n8n workflow verifies the signature and calls the signed Convex notification endpoint. Convex records the mock notification once.
4. Convex confirms that the callback recorded the event. It retries delivery up to five times with backoff; a five-minute recovery cron picks up interrupted attempts. Exhausted events appear in the admin dashboard for retry.

### Overdue reminder

1. The n8n schedule runs daily at 09:00 UTC and requests pages of overdue approved loans from Convex.
2. Convex returns the UTC day and only the request IDs needed for the workflow. n8n signs a reminder write-back for each ID.
3. Convex checks that each loan is still approved and overdue, then atomically records at most one mock reminder for that loan and day.
4. n8n retries its HTTP nodes and saves failed executions for inspection. Re-running the workflow on the same day does not create duplicate mock reminder records.

### Signing protocol

Both signatures use HMAC-SHA256 and Unix timestamps in milliseconds, accepted within a five-minute window:

```text
Convex → n8n:  v1.<timestamp>.POST.request-notification.<eventId>
n8n → Convex:  v1.<timestamp>.POST.<path>.<raw JSON body>
```

Convex HTTP actions are `/automation/notification`, `/automation/overdue`, and `/automation/reminder`. The signature is sent in `x-lendloop-signature` and the timestamp in `x-lendloop-timestamp`. The actual notification/reminder side effect in this demo is the idempotent Convex record; it does not represent delivery to an external inbox.

## Testing

### Automated checks

```bash
npm run check   # ESLint, TypeScript, and Prettier
npm test        # Vitest, React Testing Library, and convex-test
npm run build   # Production build
```

The tests cover access control using simulated identities, lending transitions, input and date rules, signature rejection, duplicate write-backs, automation failure handling, and UI behavior. `convex-test` is a simulated backend and does not prove production deployment concurrency.

### Manual checks

1. Sign in with two development accounts. Have one list a tool and the other request it; approve or decline the request and mark an approved loan returned.
2. Configure `ADMIN_CLERK_USER_ID`, sign in as that user, and test trusted status, listing removal, and the loans view. Confirm the other account cannot access the admin view.
3. With n8n and the signed integration configured, create and update a request. Check the participant's **Automation activity** for mock notification status and check failed runs in n8n's Executions view.
4. Approve a loan ending today, leave it unreturned until after the UTC date changes, and run the reminder workflow manually. Check for a mock reminder, then run the workflow again on the same UTC day and verify there is no duplicate.

The exported workflows have been imported and exercised in local n8n against a mock HTTP service, including valid and invalid signatures, multiple and empty pages, and failed HTTP retries. A live administrator session and the complete Convex ↔ n8n deployment path remain to be verified in the configured environment.

## Production improvements

For production, use a managed deployment with TLS, restrict the n8n editor and expose only the webhook, and add edge rate limiting, monitoring, alerts, backup, and data-retention policies. Use a secret manager and a secure administrator provisioning process; rotate keys and review dependency and image updates. Add broader accessibility, integration, and end-to-end tests, including concurrent deployment behavior.

Replace mock notifications with a delivery provider that supports idempotency keys and add outbox reconciliation. Without provider-side idempotency, an external message cannot be guaranteed exactly once across crashes. For healthcare or similarly sensitive information, additionally define the permitted data flows, audit requirements, retention and deletion policies, and appropriate contractual and compliance obligations before processing real data.
