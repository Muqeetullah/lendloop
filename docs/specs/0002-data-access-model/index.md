# 0002. Data and access model

**Date**: 2026-11-03
**Status**: Accepted

## Summary

Convex stores the lending records and makes the final decision on every protected operation. Clerk supplies verified identity. A configured administrator can moderate listings and mark lenders trusted. Dates are whole UTC calendar days and all state changes happen inside Convex mutations.

## Requirements

- **AC-1**: Anonymous users can obtain a public list containing only available tool names and categories.
- **AC-2**: Signed in users can create listings, and only their owner can edit or archive them. An administrator can archive any listing.
- **AC-3**: Signed in users can request other users' active tools for a valid whole day range. The backend derives borrower identity and rejects invalid dates and self requests.
- **AC-4**: Only the owner can approve or decline pending requests. Approval atomically refuses overlapping approved loans and blocks further approvals while an earlier loan is overdue and unreturned.
- **AC-5**: Either participant can mark an approved loan returned; other callers and invalid transitions are rejected.
- **AC-6**: Users can read only requests where they are a participant. An administrator can read all loans and set trusted lender status. Administrator status is controlled by server configuration, never user input.
- **AC-7**: Archiving a listing retains its loan history, removes it from discovery, and blocks new requests or approvals. Existing approved loans can still be returned.
- **AC-8**: Reminder outcomes have a stable per loan, per day, per type key; repeated internal writes do not create duplicate records. External automation is a later feature.
- **AC-9**: Authorization, overlap, state transitions, public data minimization, and idempotency have automated backend tests.

## Decision

Use Convex documents and indexed queries with a single `requests` table for requests and loans. An approved request represents an active loan until returned. Use a server configured Clerk user ID for the demo administrator, with no public role setter. The role is evaluated against the current verified identity on every call.

## Data model

| Table | Fields | Indexes |
|---|---|---|
| users | token identifier, Clerk subject, trusted lender boolean, optional display name and contact | token identifier |
| tools | owner user ID, name, category, condition, description, archived flag | owner; archived |
| requests | tool ID, lender user ID, borrower user ID, start and end day, status | tool and status; lender; borrower |
| reminderRecords | request ID, day, type, status | request, day, type |

Convex IDs are references, not authority. Identity and ownership always come from the verified request context and stored records. Input dates use `YYYY-MM-DD` with inclusive endpoints in UTC. Two ranges overlap when each starts no later than the other ends. Public availability means an active listing has no currently approved loan whose date range includes today; exact date range conflicts are checked separately when approving. Unreturned overdue loans remain blocked from current availability.

## State and deletion rules

- A request starts `pending`. Only its lender can move it to `approved` or `declined`. Either participant can move `approved` to `returned`.
- A pending request does not reserve a tool. Approval queries approved requests and checks overlap in the same transaction that changes status. Convex retries conflicting mutations.
- Archiving keeps requests and approved loans for history and return handling. Pending requests on archived tools remain visible and can be declined, but cannot be approved.
- No public function creates admin roles or reminder records. A server environment variable `ADMIN_CLERK_USER_ID` contains one exact Clerk subject for the demo. An unset value gives nobody admin access.

## Security model

Convex accepts identities from the configured Clerk issuer and checks the expected audience. Every protected function obtains a verified identity using Convex authentication. Mutations that create a user record derive its identity from that context. Existing users and their roles cannot be selected by client supplied IDs. Listing and loan IDs select a resource only; each operation rechecks ownership, participation, or admin status. Public projections exclude owner IDs, descriptions, and other private fields. Internal reminder mutations are not client callable.

## Critical checks

Test unauthenticated access, cross user writes and reads, admin actions, self requests, invalid dates, overlapping approvals, invalid transitions, archived tools, public projection, and repeated reminder records. Test the critical mutations using the Convex test environment with distinct simulated identities.

## Follow-up

- Complete the remaining signed in screens in the lending journey slice.
- Refresh time based availability on UTC date changes and page focus; the server remains authoritative for the date.
- Implement and verify signed n8n endpoints and a durable retry protocol in their scoped steps.
- Replace the single configured admin with an audited role management process for production.

## Rationale

Reasoning and tradeoffs are in [rationale.md](rationale.md).

## Lending safeguards added after review

A borrower may have one pending request per tool and at most ten pending requests overall. A rolling account limit allows ten new requests per hour. Request views use participant scoped pagination. The public board uses bounded pages and reveals only tool names and categories. The signed in board and personal listings use bounded pages, and category filtering uses an indexed query.

A user can voluntarily provide a display name and contact method. Only participants see each other’s display name in request views, and contact details are visible to the other participant only while the loan is approved. An empty profile uses a generic name and a request reference. Profile values are supplied and editable by the account owner.
