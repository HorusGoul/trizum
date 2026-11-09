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

The first-party contract covers Party Boost, receipt extraction, Cloud Sync settings and Tricount
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

## Receipt extraction

`POST /api/premium/receipts` takes `{ partyDocumentId, image, locale }`, where `image`
is a base64 JPEG, PNG, or WebP data URL (at most 4 MiB decoded). It requires a
signed-in party member and an authoritative active Party Boost, including a fresh
check of the boost owner's Premium and membership. The shared Automerge boost
cache cannot authorize the request. Other party members do not need Premium.

The response has `merchantName`, `titleSuggestions`, `total`, `currency`, and `items`. Each item has
`name`, `quantity`, `unitPrice`, and `lineTotal`. Monetary values are decimal
strings in major currency units. Quantities preserve the printed text and units;
missing fields are `null`, and unreadable items produce an empty array. The
extraction prompt requests the final printed total including tax and discounts,
never tendered cash, change, or an inferred sum. Currency is an ISO code only
when visibly identified; ambiguous symbols remain unknown.

`titleSuggestions` contains up to three short activity titles grounded in the
receipt's items or clear context. The prompt requests the first title in the
receipt's predominant language when identifiable, followed by an app-language
alternative if different (`en` or `es`; omitted locale defaults to English).
For a Spanish coffee receipt in an English app, choices can be “Cafetería”,
“Coffee”, and “Cafés”. An unclear receipt language falls back to the app language.
The model should offer multiple useful choices when supported, without padding
with duplicates or invented context. The first title is the default suggestion;
the original merchant is retained separately as the last fallback. Unsupported
activity titles are omitted, and no model confidence percentages are shown.
The sheet offers distinct activity titles and the merchant as horizontally
scrollable choices. The chosen title is read-only until accepted into the draft.

For meal titles, the prompt considers the printed transaction time and location
alongside the purchased items. It prefers neutral item or category titles when
context is unclear or the meal would be implausible locally; a Spanish receipt
for coffees at 18:00 should suggest coffee rather than breakfast. Upload time
and the app language do not establish when or where the purchase happened.

New attachments are analyzed from their locally prepared image while Automerge
sync continues. Suggestions stay local to the editor. Accepting selected fields
updates the draft; saving the expense uses the existing write path. The first
version offers title and total only, preserves fields edited during processing,
and disables totals with a known currency mismatch or precision the editor
cannot represent. Removing a receipt or leaving the editor discards late results.
Analysis runs without loading or error toasts. Each photo has an inset gradient
border with a circling highlight until its request finishes or times out;
reduced motion uses a static border. The animation rotates only the gradient
behind a fixed border mask, so it stays inside the thumbnail bounds.
Failures and receipts with no applicable title or total change produce no sheet
and leave attachments and manual expense entry usable. Matching values, manual
edits protected since upload, and totals that cannot be applied are filtered
before display. Unusable queued results do not prevent later useful suggestions
and do not emit a user-discard event.
