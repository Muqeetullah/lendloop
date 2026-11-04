# Architecture rationale

## Context

The take home assignment names its main technologies and asks for a reviewer friendly local setup. The project should prove a complete lending workflow without adding infrastructure that the assignment does not need.

## Options considered

1. **Required managed stack with local n8n**. Use Next.js, Clerk, Convex, and n8n. This fits the brief and reduces the amount of infrastructure to maintain, but local setup still depends on service accounts and Docker.
2. **Additional database and custom API**. Add PostgreSQL and a separate API alongside the required stack. This could be useful in a different product, but duplicates persistence and authorization and creates more setup for the reviewer.

## Rationale

The first option respects the assignment and keeps the system small. The Convex backend remains responsible for data and authorization rather than relying on frontend checks. The architecture separates the integration design from the scaffold so service credentials are not needed to build the initial app.
