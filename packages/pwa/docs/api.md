# First-party API

[Back to package overview](../README.md). Read when changing Worker routes, HTTP clients, or request-scoped Automerge access.

- [`api/contracts`](../api/contracts) declares validated HTTP routes and their
  OpenAPI metadata. The Worker publishes the resulting OpenAPI 3.1 document at
  `/api/openapi.json`.
- [`api/automergeDocuments.ts`](../api/automergeDocuments.ts) owns request-scoped
  Worker document reads and writes. Its `AutomergeDocuments` object initializes
  one repo on the first `read` or `change`, shares it across operations, and
  only syncs explicitly requested documents. The timeout starts with the first
  operation and applies to subsequent operations in that request.
- [`api/automergeDocumentsMiddleware.ts`](../api/automergeDocumentsMiddleware.ts)
  supplies that object as `c.get("documents")` and closes it when the handler
  finishes. Register it on routes that need sync, then pass the object into
  domain functions. Unused objects open no connection. Reads return snapshots;
  `change` waits until the connected sync peer acknowledges the changes before
  request cleanup. This confirms receipt, not a durable storage flush.
- [`src/lib/trizumApiClient.ts`](../src/lib/trizumApiClient.ts) is the typed
  first-party client. UI code should call its domain methods instead of issuing
  raw requests to Worker routes.

The first-party contract covers Party Boost, Cloud Sync settings and Tricount
imports. Shared runtime schemas live in `src/lib/api`; route definitions live in
`api/contracts`. Cloud Sync's cache helpers retain the v1 local storage format
and signed-out read behavior while delegating HTTP to the client. Tricount keeps
its existing preview/production host selection and plain-text missing-key error.
Both migrated routes validate successful responses before sending them, and the
client validates incoming payloads before they reach app state. Unexpected Cloud
Sync failures use the documented JSON 500 response.

The endpoint audit excludes Better Auth (owned by its auth client), health and
OpenAPI discovery (not consumed by app code), static assets, HTML/social previews,
and third-party requests such as Tricount's upstream API and attachment downloads.
