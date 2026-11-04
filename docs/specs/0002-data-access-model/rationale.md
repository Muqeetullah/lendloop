# Data and access model rationale

## Context

The assignment requires ownership checks in Convex, two roles, date range loans, and safe reminder write backs. The initial project has no backend and does not yet connect real accounts.

## Options considered

1. **One request record becomes a loan when approved**. It avoids duplicating the date range and participants, while preserving a simple status history for the demo. Additional event history can be introduced when the automation workflow is built.
2. **Separate requests and loans**. It is useful for more complicated pickup, return, or agreement workflows, but introduces extra records and synchronization for requirements that do not need them.

## Rationale

A single request lifecycle fits the small assignment. Convex mutations combine access checks, overlap reads, and writes in one transaction, which prevents competing approvals from silently winning. A server configured administrator has a small attack surface and a transparent local setup, though it is not a full production role management system. Soft deletion preserves the references that participants need to return tools and read history.
