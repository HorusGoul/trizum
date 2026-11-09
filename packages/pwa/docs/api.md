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

## Exchange rates

`GET /api/exchange-rates?base=<party currency>` is public and returns daily reference rates quoted per unit of the party currency
from [Frankfurter](https://frankfurter.dev/), including each quote's publication
date. The Worker validates upstream data, uses one Cloudflare Cache API key per validated base currency
for six hours, and falls back to the bundled snapshot for five minutes when the
upstream request fails. It needs no API key or KV binding. The typed client's
`exchangeRates.get(partyCurrency)` method uses the public transport, including on mobile.

The expense editor rebases the compact seed in `src/lib/exchangeRatesSnapshot.json` to the
party currency, overlays validated rates from `trizum.exchange-rates.v1.<currency>`
in local storage, and refreshes
on mount, reconnect, and every six hours while open. Newer publication dates win
per currency, so a fallback response cannot replace newer stored rates. Missing
pairs require a manual rate. These are daily reference rates, not card settlement
rates; the editor prefills an editable rate and shows the converted total as
read-only output.

An expense's optional `originalAmount` stores `{ amount, currency }`, and
`exchangeRate` stores party-currency units per original-currency unit. Both
amounts use the app's existing hundredths convention, including currencies such
as JPY. Conversion uses scaled integer arithmetic and half-even rounding. The
converted total remains in `paidBy`, and exact shares remain in party currency.
Rate refreshes never recalculate saved expenses or replace an editor's chosen
rate. Tables and refreshes are isolated by party currency; responses for another
base are rejected. The editor inverts a quote to convert a foreign amount into
the party currency. Tricount imports preserve `amount_local` and `exchange_rate` as metadata;
the already-converted `amount` and allocations remain authoritative.
