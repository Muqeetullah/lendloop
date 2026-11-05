# LendLoop

LendLoop is a neighborhood tool-lending board. Visitors can browse available tool names and categories; signed-in neighbors can list tools, request dates, approve or decline requests, and mark loans returned. A configured administrator can moderate listings, view loans, and mark lenders trusted. The interface includes paginated lists and recent automation activity.

The application uses Next.js App Router, TypeScript, Tailwind CSS, Clerk, Convex, and self-hosted n8n. Notifications and reminders are **mock notifications recorded in Convex**, not email or messages sent to a real inbox. This keeps the assignment reproducible without an external messaging account.

## Prerequisites

- Node.js 24 and npm.
- A Clerk development application and a Convex development deployment.
- Docker and Docker Compose for the supplied n8n setup.
- An HTTPS endpoint that forwards **only** `/webhook/lendloop-request` to n8n when using a cloud-hosted Convex deployment. Convex cannot call your computer's `localhost`. Keep the n8n editor private.

## App setup

1. Install dependencies with `npm ci` and create `.env.local` from `.env.example`.
2. Run `npx convex dev` to sign in and create or select a development deployment. This fills in Convex's local variables.
3. Create a Clerk development application, configure its Convex integration and session audience `convex`, and add its publishable and secret keys to `.env.local`.
4. In the Convex dashboard, set `CLERK_JWT_ISSUER_DOMAIN` to the Clerk frontend API URL. Set `ADMIN_CLERK_USER_ID` to the exact Clerk user ID of the administrator you choose. With no administrator configured, no account receives admin permissions. Restart `npx convex dev` to sync the backend.
5. Run `npm run dev` in a separate terminal and open [http://localhost:3000](http://localhost:3000). Sign in, then set your sharing details in the dashboard. A signed-in account gets a Convex user record on connection.

The `.env.example` values are placeholders. Never commit real keys, `.env.local`, or `.env.n8n`.

## n8n setup

1. Copy `.env.n8n.example` to `.env.n8n`. Generate three independent random secrets of at least 32 bytes, for example with `openssl rand -hex 32`: one each for `N8N_ENCRYPTION_KEY`, `CONVEX_TO_N8N_SECRET`, and `N8N_TO_CONVEX_SECRET`. Keep the encryption key stable between restarts; changing it prevents n8n from decrypting stored credentials.
2. Set `CONVEX_SITE_URL` to your Convex HTTP actions URL (the deployment's `.convex.site` URL, **not** its `.convex.cloud` URL). Set `N8N_WEBHOOK_BASE_URL` to your HTTPS webhook-only ingress base URL, without a trailing path.
3. In the Convex dashboard, set `CONVEX_TO_N8N_SECRET` and `N8N_TO_CONVEX_SECRET` to the matching n8n values. Set `N8N_REQUEST_WEBHOOK_URL` to `https://YOUR-INGRESS/webhook/lendloop-request`.
4. Start n8n with `docker compose --env-file .env.n8n up -d`. Open [http://localhost:5678](http://localhost:5678), complete n8n's local owner setup, import both JSON files from `n8n/workflows/`, and publish/activate both workflows. The daily reminder schedule runs at 09:00 UTC. The manual trigger on the reminder workflow is useful for testing.
5. Create or update a borrow request. Its participant-facing activity should eventually show a delivered mock notification. For overdue testing, use an approved loan whose end date has passed, then run the reminder workflow manually; repeating the run on the same UTC day must not add another reminder.

The Compose file binds the editor to loopback. `N8N_SECURE_COOKIE=false` is for local HTTP only. The workflows require self-hosted n8n with the `crypto` built-in and environment access enabled as configured in Compose; they are not intended to be imported unchanged into n8n Cloud. Restrict n8n editor access: trusted workflow authors can access the workflow environment. Docker data persists in the `n8n_data` volume. To stop the service, use `docker compose --env-file .env.n8n down`.

### Configuration reference

| Location     | Variable                                                                           | Purpose                                              |
| ------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`                            | Clerk development application keys                   |
| `.env.local` | `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`       | Development deployment and URLs                      |
| Convex       | `CLERK_JWT_ISSUER_DOMAIN`, `ADMIN_CLERK_USER_ID`                                   | Token issuer and server-controlled administrator     |
| Convex       | `N8N_REQUEST_WEBHOOK_URL`, `CONVEX_TO_N8N_SECRET`, `N8N_TO_CONVEX_SECRET`          | Webhook address and integration signing keys         |
| `.env.n8n`   | `N8N_ENCRYPTION_KEY`, `CONVEX_SITE_URL`, `N8N_WEBHOOK_BASE_URL`, both signing keys | Persistent n8n encryption and workflow configuration |

## How automation works

A request creation or status transition atomically writes an event with the request. Convex schedules delivery to n8n and sends only an opaque event ID, timestamp, and signature. The n8n webhook validates the signature and calls a signed Convex endpoint to record the mock notification for the intended recipient. The event is retried up to five times with backoff; a recovery cron picks up interrupted attempts. Exhausted deliveries appear in the admin dashboard, where they can be retried. A successful HTTP response without the expected write-back does not count as delivery.

The daily workflow pages through approved loans past their end date, receiving only request IDs and the current UTC day. It calls a signed write-back for each reminder. The database transaction checks that the loan remains overdue and records at most one mock reminder per loan and UTC day. Repeated workflow executions and HTTP retries therefore do not duplicate mock records. n8n retries HTTP nodes and retains failed executions for inspection in its Executions view; check that view for failed scheduled runs. The mock record is the notification side effect, not a claim that an external message was delivered.

Each direction has a separate HMAC-SHA256 secret. Convex-to-n8n signs `v1.<timestamp>.POST.request-notification.<eventId>`. n8n-to-Convex signs `v1.<timestamp>.POST.<path>.<raw JSON body>`. Timestamps are Unix milliseconds and signatures expire after five minutes. The HTTP endpoints reject invalid signatures and unexpected fields. Signed callbacks are safe to replay because their writes are idempotent. Only request participants see their recent activity; admin-only queries and mutations enforce authorization in Convex, independently of the UI. The public listing returns only tool names and categories.

## Lending rules

Loan dates are inclusive UTC calendar days. Pending requests do not reserve a tool. Approval rejects overlapping loans and further approvals while a tool is overdue and unreturned. Either participant can mark an approved loan returned. Each account can have at most 10 pending requests, only one pending request per tool, and at most 10 new requests per hour. Removing a listing archives it, preserving request history and allowing approved loans to be returned. These basic limits do not prevent abuse through multiple accounts.

Neighbors can optionally provide a display name and contact method. Contact details are shown only to the other participant while a loan is approved and are never passed to n8n. Public and dashboard lists are paginated; category filtering is performed on the server.

## Verification

```bash
npm run check   # ESLint, TypeScript, and formatting
npm test        # simulated Convex and UI tests
npm run build
```

The tests use `convex-test` and simulated identities. They cover authorization, lending transitions, signature rejection, duplicate write-backs, and participant activity; they do not prove production deployment concurrency. Review the n8n execution history as well as the app when testing the complete integration.

## Production considerations

Use a managed deployment, TLS and an authenticated, restricted n8n editor; expose only the webhook, add rate limiting, monitor failed executions and exhausted events, and set retention and backup policies for n8n and Convex data. Rotate strong secrets and store them in a secret manager. Review dependency advisories and pin/update images and packages through a controlled process. Replace mock records with a provider supporting idempotency keys and an outbox/reconciliation process; without provider-side idempotency, an external send cannot be guaranteed exactly once across crashes. Add production-grade abuse controls, monitoring, accessibility and end-to-end tests, and a secure administrative provisioning process.

Planning and decisions: [scope](docs/scope/scope.md) and [architecture](docs/specs/0001-application-architecture/index.md).
