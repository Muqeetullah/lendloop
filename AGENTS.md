<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LendLoop project context

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, and npm.
- Clerk and Convex are connected for development; n8n workflows remain to be built.
- The architecture decision is in `docs/specs/0001-application-architecture/index.md`.

## Build approach

Tracer Bullet: prove a small real path through sign in, data, and the interface first, then extend it in working slices. See `docs/scope/scope.md`.

## Commands

- `npm ci`: install the lockfile dependencies.
- `npm run dev`: start the local application.
- `npm run check`: run lint, TypeScript, and formatting checks.
- `npm run format`: format supported project files.
- `npm run build`: create and type check a production build.
- `npm test`: run simulated Convex backend tests.

## Rules

- Keep TypeScript strict and use the existing `@/*` import alias when it improves clarity.
- Follow App Router conventions and use Tailwind and the interface direction in `design.md` for styling.
- Make interfaces responsive and accessible, with loading, empty, validation, and error states as appropriate.
- Enforce permissions and ownership in Convex functions when those functions are added; interface checks alone are not authorization.
- Validate untrusted inputs on the backend. Return only data needed by each caller.
- Keep credentials and secrets out of source, logs, and exported workflows.
- Keep the scope and architecture records current as implementation decisions become real.
