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
is a base64 JPEG, PNG, or WebP data URL (at most 8 MiB decoded). It requires a
signed-in party member and an authoritative active Party Boost, including a fresh
check of the boost owner's Premium and membership. The shared Automerge boost
cache cannot authorize the request. Other party members do not need Premium.

After authorization and rate limiting, the Worker uses the private `IMAGES`
binding to validate the raster dimensions and prepare one JPEG for both models,
with a five-second preparation deadline.
The first pass preserves aspect ratio without cropping or upscaling, limits the
long edge to 3072 pixels, and uses quality 85 with a white background and a single
frame. If its encoded output exceeds 4 MiB, one retry uses a 2048-pixel edge and
quality 80, starting from the original source again. Output is read with a byte
limit and its actual dimensions/format are checked before inference. Sources
above 12,000 pixels on either side or 100 megapixels are rejected. The normalized
analysis image is not uploaded to hosted Images, cached, or written to Automerge;
the stored attachment keeps its existing processing and sync behavior.

The response has `merchantName`, `titleSuggestions`, `total`, `currency`, `currencyEvidence`, `currencyEvidenceSource`, and `items`. Each item has
`name`, `quantity`, `unitPrice`, and `lineTotal`. Monetary values are decimal
strings in major currency units. Quantities preserve the printed text and units;
missing fields are `null`, and unreadable items produce an empty array. The
extraction prompt requests the final printed total including tax and discounts,
never tendered cash, change, or an inferred sum. Currency is a best-effort ISO code.
Printed codes and unambiguous markers take priority. Otherwise, the models combine
visible address, country/region, postcode, phone prefix, tax identifiers, web
domain and language clues to distinguish plausible currencies. Shared languages
need corroborating clues; a strong locale association can support a likely
default when nothing contradicts it. There is no hardcoded country/language
mapping. `currencyEvidenceSource` distinguishes `printed` from `context`, and
`currencyEvidence` explains the decisive receipt cues. Unsupported or conflicting
inferences remain null.

Gemma extracts the candidates, then `@cf/cloudflare/clef` compares them with the
same prepared image. The verifier scores the merchant, each proposed title, the
final total, currency plus its printed or contextual evidence, and the item lines independently
as supported, unsupported, or unclear. Suggestions retain a strictly winning supported decision; model scores are not
interpreted as calibrated accuracy percentages or compared to a near-certainty
cutoff. Printed markers still undergo deterministic matching; contextual
inferences must be supported independently by Clef against the image. These
policies still need receipt-specific accuracy evaluation. Unverified fields are
removed; rejecting an extracted currency also removes its total to prevent
falling back to a party-currency amount. If verification fails or times out, the
whole request fails quietly through the existing sanitized error path. Clef has
an eight-second timeout after the bounded extraction pass. Empty extraction
results skip verification. Neither image contents nor verifier scores are logged.

Both models receive the party currency read from the already authorized party
document. Their prompts explicitly use it only for verification and prohibit
defaulting, guessing, or converting to that currency.

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
version offers title, total, and an explicit expense-currency choice, preserving
fields edited during processing. A currency change is offered only for a supported
currency different from both the party and the current expense. Explicit printed
codes and known markers are matched literally; contextual inferences carry their
own source and evidence explanation. The sheet distinguishes an inferred currency
from a printed one. Bare shared symbols are not treated as explicit currency,
and the app language and party currency are never evidence of the receipt's
currency. Currency rejection still suppresses its associated total to avoid
applying that number as a party-currency amount.
The currency choice starts selected and identifies the receipt evidence, target
currency, and party currency. Deselecting the currency disables its foreign total; applying that total
requires accepting its currency too. Accepting the switch changes this expense only, using the
same reference-rate lookup and conversion path as the editor currency selector.
The user reviews the rate in the editor; a missing rate remains unset for manual
entry. Totals in an already selected foreign currency retain its existing rate.
Declining the switch cannot apply the foreign total as a party-currency amount.
Unrepresentable precision remains blocked. Removing a receipt, changing currency,
or leaving the editor discards late results.
Analysis runs without loading or error toasts. Each photo has an inset gradient
border with a circling highlight until its request finishes or times out;
reduced motion uses a static border. The animation rotates only the gradient
behind a fixed border mask, so it stays inside the thumbnail bounds.
Failures and receipts with no applicable title, total, or currency change produce no sheet
and leave attachments and manual expense entry usable. Matching values, manual
edits protected since upload, and totals that cannot be applied are filtered
before display. Unusable queued results do not prevent later useful suggestions
and do not emit a user-discard event.

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
rates; the editor prefills an editable rate. For foreign expenses, the original amount
and a styled read-only converted total share the first row, with the rate and
currency selector below. The total updates while typing in the calculator.

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
