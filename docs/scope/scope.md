# Scope: LendLoop

LendLoop is an interview assignment for a neighborhood tool lending board. Neighbors can list tools, request loans, respond to requests, and see the progress of a loan. Automation sends request notifications and overdue reminders.

**Build approach:** Tracer Bullet. Prove a small real path through sign in, data, and the interface first, then extend it in working slices.
**Workflow:** Beta. Verify each important slice in the running app and add focused tests for its risks. These are recommendations, not mandatory commands.

**Working assumptions:** This is a single neighborhood demo with two roles. A mock notification is sufficient. A loan date range uses whole calendar days in one documented application timezone. Pending requests do not reserve a tool; approval checks for overlapping approved loans. Either participant may mark an approved loan returned. These are proposals to review before implementation.

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Architecture and project foundation | Foundation | done |
| 2 | Coding standards and tooling | Foundation | done |
| 3 | Data and access model | Foundation | done |
| 4 | Accessible interface foundation | Foundation | done |
| 5 | First lending journey | Slice 1 | done |
| 6 | Public discovery and listings | Slice 2 | done |
| 7 | Request and loan management | Slice 3 | done |
| 8 | Admin controls | Slice 4 | planned |
| 9 | Request notifications | Slice 5 | planned |
| 10 | Overdue reminders | Slice 6 | planned |
| 11 | Verification and submission | Slice 7 | planned |
| 12 | Loan automation activity | Bonus | planned |

## Foundation

### 1. Architecture and project foundation · done
Record the chosen application architecture and create a runnable project for the assignment.
**Done when:** the architecture and setup are documented and the application starts and builds locally.
- [x] Decide the architecture: `/architect LendLoop architecture`
- [x] Scaffold the application and document local commands.
- [x] Verify the development server, build, and lint checks.

Spec: [Application architecture](../specs/0001-application-architecture/index.md). Code: project root.

### 2. Coding standards and tooling · done
Keep the implementation readable, consistent, and easy to check.
**Done when:** project conventions are recorded and the agreed checks run locally.
- [x] Capture conventions after scaffolding: `/audit`.
- [x] Add and verify lint, type, and formatting commands.

Context: [`AGENTS.md`](../../AGENTS.md). Commands: [`README.md`](../../README.md).

### 3. Data and access model · done
Define users, tools, requests, loan history, automation records, and the rules that protect them.
**Done when:** roles, ownership, request transitions, date overlap, deletion behavior, and reminder uniqueness are defined and enforced by the backend.
- [x] Design the data and access model.
- [x] Implement the backend model and focused simulated tests.
- [x] Connect a development deployment, apply the schema, and verify public access and anonymous denial.
- [x] Connect Clerk and verify a real signed in identity reaches Convex.

Spec: [Data and access model](../specs/0002-data-access-model/index.md). Code: `convex/`.

### 4. Accessible interface foundation · done
Create a minimal and consistent interface that works on small and large screens.
**Done when:** forms and navigation are keyboard accessible and reusable views cover loading, empty, and error states.
- [x] Design the interface foundation.
- [x] Build reusable controls, states, and the public foundation.
- [x] Verify the interface and accessibility at representative widths.

Spec: [Accessible interface foundation](../specs/0003-interface-foundation/index.md). Design: [`design.md`](../../design.md).

## Slice 1: First lending journey

### 5. First lending journey · done
Prove the complete lending path with real sign in, real data, and a usable interface.
**Done when:** one signed in neighbor can list a tool, another can request it, and its owner can approve the request with backend access checks.
- [x] Reuse the accepted data access and interface decisions.
- [x] Build listing, request, and owner response screens with participant only views.
- [x] Verify access rules using distinct simulated identities.
- [x] Address the review findings for overdue loans, request flooding, pagination, participant contact, date refresh, and accessible actions.
- [x] Verify the complete journey with two real signed in development accounts: listing, request, approval, and return.

Code: `components/board/lending-workspace.tsx`, `convex/tools.ts`, and `convex/requests.ts`.

## Slice 2: Discover and manage tools

### 6. Public discovery and listings · done
Let visitors discover tools and let signed in neighbors manage their own listings.
**Done when:** visitors see available tool names and categories only, can sign in, and signed in neighbors can filter tools and create, edit, and delete their own listings.
- [x] Build category filtering, paginated browsing, and owner listing management.
- [x] Verify filtering and editing in the browser, and test ownership, pagination, and removal rules.

Code: `components/board/listing-management.tsx`, `components/board/lending-workspace.tsx`, and `convex/tools.ts`.

## Slice 3: Manage requests and returns

### 7. Request and loan management · done
Complete the lending journey and provide views for both sides.
**Done when:** neighbors can view their listings, outgoing requests, and incoming requests, request valid date ranges, approve or decline requests on their own tools, and mark eligible loans returned; conflicting approvals and unauthorized actions are rejected.
- [x] Provide participant request views, approval, decline, and returns with backend access checks.
- [x] Explain invalid dates, conflicting approvals, removed listings, and duplicate requests.
- [x] Verify request and decline in two real development accounts, plus authorization and transition tests.

Code: `components/board/lending-workspace.tsx`, `components/board/request-errors.ts`, and `convex/requests.ts`.

## Slice 4: Admin controls

### 8. Admin controls · planned
Give an administrator the limited controls needed to moderate the board.
**Done when:** an admin can remove any listing, see all loans, and mark a lender trusted; ordinary users cannot perform these actions even through direct backend calls.
- [ ] Build it: `/develop admin controls`

## Slice 5: Request notifications

### 9. Request notifications · planned · needs a decision
Notify the relevant person when a request is created or changes status, while making failed delivery visible.
**Done when:** signed events reach the automation workflow, only necessary data is shared, retries are safe, and failures can be inspected and retried.
- [ ] Design it: `/architect request notifications`

## Slice 6: Overdue reminders

### 10. Overdue reminders · planned · needs a decision
Find overdue loans daily and record reminder outcomes without creating duplicate reminder records.
**Done when:** a scheduled workflow securely fetches overdue loans, sends or records reminders, writes results back safely on retries, and makes failures visible.
- [ ] Design it: `/architect overdue reminders`

## Slice 7: Verification and submission

### 11. Verification and submission · planned
Make the assignment reproducible and easy for a reviewer to assess.
**Done when:** focused security, workflow, and interface checks pass; workflow exports and setup instructions are included; secrets are absent from the repository; and production improvements are documented.
- [ ] Build it: `/develop verification and submission`

## Bonus

### 12. Loan automation activity · planned
Show participants useful recent notification and reminder outcomes on a loan.
**Done when:** eligible viewers can see recent automation activity without access to unrelated loans or sensitive logs.
- [ ] Build it: `/develop loan automation activity`

## Deferred

Production hosting, payments, file uploads, search beyond category filtering, and advanced analytics are outside the assignment unless later requested.

## Status

`planned` means work has not started. `in progress` means it has started. `done` means the intended behavior has been built and verified. Each section starts with its suggested next step and can be expanded as decisions are recorded.
