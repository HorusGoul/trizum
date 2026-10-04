---
name: analytics-events
description: Add or review privacy-safe custom analytics for trizum product features. Use when implementing or changing user actions, feature flows, or their analytics coverage; ordinary styling and copy edits do not need new events.
---

# Analytics Events

For every changed product flow, decide whether an existing event covers it, a new
custom event is useful, or pageviews already answer the usage question. State that
decision in the implementation summary. Do not add events simply to count every
click or render.

## Sources of truth

- [`packages/analytics/src/events.ts`](../../../packages/analytics/src/events.ts):
  approved names and precise trigger meanings. Read it before choosing a name.
- [`packages/analytics/README.md`](../../../packages/analytics/README.md): privacy
  design rationale and links to the implementation sources of truth.
- [`packages/pwa/src/lib/analytics.ts`](../../../packages/pwa/src/lib/analytics.ts):
  the app's `trackEvent` facade. Product code uses this facade.

## Choose the event and its boundary

Use stable, untranslated `snake_case` names describing a user action. Prefer one
event for a completed operation. Put it after the authoritative local write or
successful awaited operation, outside Automerge change callbacks. Offline local
writes count as application success, although analytics currently drops offline
events.

For funnels, use explicit stages such as `_started`, `_completed`, `_cancelled`,
and `_failed` only when the application can distinguish them. An external store,
OAuth redirect, share sheet, or payment link opening is a `_requested` event,
not proof that a purchase, sign-in, share, or payment succeeded. A successful
restore request without an entitlement is not a restored purchase.

Instrument a shared user-action handler when multiple entry points use it. Avoid
model helpers also used by imports, background sync, migrations, or tests. Do not
emit inside renders, subscriptions to collaborative documents, autosaves,
progress callbacks, or updater functions React may replay. Effects are usually
the wrong place: if a flow genuinely needs one, establish a deduplication rule
that survives repeated notifications and remounts.

Pageviews already cover navigation by pathname. Search-only interactions, such as
switching expenses/balances tabs or opening a calculator, need an explicit event
if their usage matters. Count opening once, not every focus, keypress, or gallery
slide. Draft attachments and template selections must be documented as draft
interactions, not saved-expense outcomes.

## Privacy contract

Add the literal name and trigger description to `analyticsEvents`, then call
`trackEvent("event_name")` at the chosen boundary. Custom events intentionally
accept **no properties**. Never interpolate names, IDs, URLs, amounts, plan prices,
receipt information, form values, codes, error messages, or user identities into
an event name. Do not add an arbitrary property bag or load InsightFlare's remote
SDK. A future property schema needs an explicit design decision and runtime
allowlisting before it can accept any values.

Preserve the Settings opt-out, DNT/GPC, offline, and environment gates. Do not
send an opt-out event after consent/preferences have disabled analytics. Changing
accounts or cloud party lists must respect the destination's analytics preference.
Do not temporarily enable analytics, persist retries, or bypass gates to improve
coverage. Analytics failures must never change the outcome of the user's action.

The shared `telemetryId` is a random UUID synced in the party list. The analytics
facade owns its use as InsightFlare `userId`; never attach it to event names or
properties, derive it from document IDs, or substitute account IDs. New logger
integrations should read the privacy-gated `getTelemetryId()` at emission time
and clear buffered identity on opt-out. Startup buffering is bounded and applies
only while preferences are unknown, never while explicitly disabled.

## Verification and maintenance

Update catalog descriptions when trigger meanings change. Keep the README focused
on design rationale and source links, without duplicating the catalog or code.
Test meaningful boundaries: a completed operation emits once; validation
failures, cancellation, rejected requests, and stale callbacks do not masquerade
as success. Extend existing action tests where available. Use a mocked analytics
facade/transport so tests never contact the live collector.

Run the analytics package tests and the affected feature tests, followed by the
repo's required checks. Build `@trizum/analytics` before validating consumers of
its `dist` export. Follow the existing changeset workflow for the overall change.
Do not create a new event or duplicate test just to satisfy a checklist when an
existing event or pageview already gives the intended signal.
