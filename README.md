# LendLoop

A neighborhood tool lending board built for a take home assignment.

## Foundation status

The app has a Next.js, TypeScript, and Tailwind foundation, a Convex data model, and Clerk sign in connected to Convex. Neighbors can browse tools by category, manage their own listings, request loans, respond, and mark approved loans returned. Admin screens and n8n workflows remain planned. See the [project scope](docs/scope/scope.md) and [architecture decision](docs/specs/0001-application-architecture/index.md).

## Run locally

Install Node.js 24, then run:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To check the project, run:

```bash
npm run check
npm test
npm run build
```

`npm run check` runs ESLint, TypeScript, and Prettier. Run `npm run format` to format supported files. Formatting skips generated files, lockfiles, and the project planning and agent context documents.

Running and building the app requires Clerk and Convex development configuration. The simulated backend tests do not require service credentials. The planned self hosted n8n setup will require Docker.

## Dependency audit

The initial npm audit reports a moderate advisory in the development lint toolchain through `minimatch`. `npm audit --omit=dev` reports no production dependency vulnerabilities. Review the advisory and available compatible updates before submission; do not apply a breaking automated downgrade without checking compatibility.

## Clerk and Convex development setup

1. Run `npx convex dev` and sign in to select or create a development project. The first sync can fail until the issuer is configured in step 3; the project is still created.
2. Create a Clerk development application, enable its Convex integration, and copy its publishable and secret keys into your local `.env.local`. See `.env.example` for variable names. Keep real values out of version control.
3. Set `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment to the Clerk Frontend API URL from its dashboard. For example: `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-domain.clerk.accounts.dev`.
4. Optionally set `ADMIN_CLERK_USER_ID` on that Convex deployment to the exact Clerk user ID of the demo administrator. When unset, no user has admin access. Never expose the admin configuration to the browser.
5. Run `npx convex dev` again to sync the schema, functions, and generated bindings. In another terminal, run `npm run dev`, then open `http://localhost:3000` and sign in.

Convex validates the Clerk session audience `convex`. For the current development app, this is configured through the Clerk session claims. The app initializes a Convex user record after a successful authenticated connection.

The current tests use `convex-test`, a simulated backend. They check function behavior, but do not prove deployment level concurrency. Dates use whole UTC calendar days. The n8n HTTP integration is a later scope item.

## Lending safeguards

Dates are inclusive UTC calendar days. Approval rejects overlapping loans and, while a loan is overdue and unreturned, rejects further approvals for that tool. Either participant can mark an approved loan returned. Each account can have at most 10 pending requests, only one pending request per tool, and at most 10 new requests per hour. These limits reduce accidental duplicates and basic flooding; they do not prevent someone from creating multiple accounts.

The public board, signed in tool board, personal listings, and participant request lists load in bounded pages. Request screens explain common failures, and pending requests for removed listings can still be declined. Category filtering is applied on the server. Removing a listing archives it, preserving loan history and allowing approved loans to be returned. Availability refreshes at UTC date changes, within 30 seconds for an active page or on focus. Only the server determines the current date.

Neighbors can optionally set a display name and contact method in their sharing details. Names appear to participants on their requests. Contact details are shown only to the other participant while a loan is approved; they are not included in the public tool board. Existing users without a display name appear as “Neighbor” with a request reference until they set one.
