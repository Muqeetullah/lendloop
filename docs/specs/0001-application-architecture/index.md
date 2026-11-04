# 0001. LendLoop application architecture

**Date**: 2026-11-03
**Status**: Accepted

## Summary

LendLoop uses the technologies required by the assignment. Next.js renders the app, Clerk handles identity, Convex holds data and enforces permissions, and n8n runs notifications. Start with a small runnable application and add each integration when its feature is built.

## Requirements

- **AC-1**: The project is a Next.js App Router application using TypeScript and Tailwind CSS.
- **AC-2**: A reviewer can install dependencies, run the local development server, and build the application using documented commands.
- **AC-3**: The architecture reserves backend authorization and data operations for Convex, identity for Clerk, and workflow automation for n8n.
- **AC-4**: Secrets and local generated files are excluded from version control. The foundation does not require real service credentials to build.

## Decision

Use one Next.js project and the managed services required by the assignment. Use npm and its lockfile for reproducible installation. This is a proposed technical foundation for the interview demo, not a production deployment.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Shared types across the app and backend support clarity. |
| Web | Next.js App Router and React | Required framework and a single app for public and signed in views. |
| Styling | Tailwind CSS | Requested styling system for a consistent responsive interface. |
| Identity | Clerk | Required authentication provider. |
| Data and server functions | Convex | Required database and backend; mutations enforce business rules. |
| Automation | Self hosted n8n through Docker Compose | Required workflows can be exported and inspected locally. |
| Notifications | Logged mock initially | Reviewers can exercise the workflow without an email account. |
| Package manager | npm | Available in the local environment and simple for reviewers to run. |
| Verification | TypeScript, ESLint, focused backend and browser tests | Catch regressions in important behavior and permissions. |

## Integration boundaries

The browser talks to Convex through its client. Clerk supplies identity for Convex to validate. Convex functions check roles and ownership before reading or changing protected records. Convex and n8n communicate through authenticated HTTP interfaces. The detailed data model, signature protocol, retry strategy, and screen design are separate scope items.

## Consequences

- Clerk, Convex, and n8n need configuration before their related features can be exercised.
- Docker is needed for the recommended local n8n setup; a reachable webhook address is also needed when Convex runs remotely.
- The foundation is not a finished product and does not claim to implement sign in, data storage, or automation.
- Secrets belong in local environment files or deployment credentials, never source or workflow exports.

## Follow-up

- Design the data and authorization model before implementing the lending journey.
- Design and verify the signed workflow contract, replay handling, retry behavior, and notification idempotency.
- Capture coding conventions after the scaffold exists.

## Rationale

Reasoning and options are in [rationale.md](rationale.md).
