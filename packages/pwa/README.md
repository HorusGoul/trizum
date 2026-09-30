# trizum PWA

This package is the main application and the default package-level entry point
for most product work. Read the repo [AGENTS guide](../../AGENTS.md) first,
then use this document to decide where to work inside the PWA.

## Canonical Sources

- [`vite.config.ts`](./vite.config.ts) and [`package.json`](./package.json)
  are the source of truth for package tasks and scripts.
- [`src/routes`](./src/routes) contains route entry points.
- [`src/ui`](./src/ui) contains the shared design-system components.
- [`src/components`](./src/components) contains app-specific UI.
- [`src/lib`](./src/lib) and [`src/models`](./src/models) contain business logic
  and domain models.
- [`api/contracts`](./api/contracts) declares validated HTTP routes and their
  OpenAPI metadata. The Worker publishes the resulting OpenAPI 3.1 document at
  `/api/openapi.json`.
- [`api/automergeDocuments.ts`](./api/automergeDocuments.ts) owns request-scoped
  Worker document reads and writes. Its `AutomergeDocuments` object initializes
  one repo on the first `read` or `change`, shares it across operations, and
  only syncs explicitly requested documents. The timeout starts with the first
  operation and applies to subsequent operations in that request.
- [`api/automergeDocumentsMiddleware.ts`](./api/automergeDocumentsMiddleware.ts)
  supplies that object as `c.get("documents")` and closes it when the handler
  finishes. Register it on routes that need sync, then pass the object into
  domain functions. Unused objects open no connection. Reads return snapshots;
  `change` waits until the connected sync peer acknowledges the changes before
  request cleanup. This confirms receipt, not a durable storage flush.
- [`src/lib/trizumApiClient.ts`](./src/lib/trizumApiClient.ts) is the typed
  first-party client. UI code should call its domain methods instead of issuing
  raw requests to Worker routes.
- [`docs/cloudflare.md`](./docs/cloudflare.md) documents Worker account, D1,
  Email, secrets, migrations, and observability setup.
- [`docs/oauth.md`](./docs/oauth.md) documents Google/Apple OAuth, account
  linking, and native callback setup.
- [`e2e/README.md`](./e2e/README.md) defines the shared Playwright browser
  harness and deterministic journey setup strategy.
- [`locale/AGENTS.md`](./locale/AGENTS.md) contains translation terminology and
  localization guardrails.

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

## Package Notes

- The app is offline-first and uses Automerge for shared, persisted data.
- User-facing copy must use Lingui macros, then run `vp run lingui:extract`.
- `src/routeTree.gen.ts` is generated. Do not edit it manually.
- `src/generated/iconSprite.gen.ts` and `src/generated/iconSprite.svg` are
  generated from the available icon catalog and current icon usage.
  `src/generated/tw-dynamic-themes.css` is generated from the default dynamic
  theme hue. These files are intentionally untracked; regenerate them with
  `vp run codegen`, or let the package scripts do it automatically instead of
  hand-editing them.

## Validation

Run the package tasks and scripts defined in [`vite.config.ts`](./vite.config.ts)
and [`package.json`](./package.json):

- `vp run check`
- `vp run test`
- `vp run build`
- `vp run lingui:extract` when copy changes

## Deployment

Cloudflare deployments are managed by GitHub Actions instead of Cloudflare's
connected repository builds.

- Production deploys run after a changeset release updates the PWA version or
  changelog on `main`.
- Pull requests get Cloudflare preview deployments from the
  `PWA Preview` workflow, and the workflow updates a PR comment with the latest
  preview URL.
- The workflows require `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
  repository secrets.

## Shared Party Boost State

A party may contain `boost?: Record<BoostId, { boostId, participantId, boostedAt,
checkedAt }>`. Each entry represents one boost, keyed by its opaque database ID.
Both timestamps are ISO strings: `boostedAt` is the current party assignment time,
and `checkedAt` is the last server verification. The participant ID belongs to
this party; auth user IDs are never published in the shared document.

Missing state means the party has not been checked yet. An empty map means no
active boosts were found. Signed-out members can use this shared cache for local
features, including offline, and its size can support future boost-based limits.
It is client-editable and may be stale: server operations still require sign-in,
membership and authoritative entitlement checks. Successful checks publish the
current state; transfer and revocation remove the previous party's entry.

Migration `0005_party_boost_id.sql` gives existing assignments stable random IDs.
The current one-boost-per-owner and one-active-boost-per-party limits remain in
the database until the product supports stacking boosts. Transfers retain the
boost ID and reset the assignment time; reactivation retains both ID and original
assignment time, preserving the existing cooldown behavior.

Migration `0006_party_boost_pending_cleanup.sql` records a transfer's previous
party in the same database update as the assignment move. A successful retry or
owner status check reconciles that destination before clearing the marker. New
transfers must finish pending cleanup first, so a failed sync write cannot lose
the old destination. Personal status remains unknown until loaded; an empty
shared map cannot authorize the UI to skip transfer confirmation.

## Premium Promo Codes

The Premium paywall includes a **Redeem code** action, available even when
products fail to load. Signed-in native redemption identifies the trizum account before opening the store.
Signed-out visitors can open store links directly; optional sign-in and Premium
settings actions remain in the FAQs. Browser Premium help explains how to buy or
restore in the installed mobile app; native Premium help opens the paywall.
Shared codes remain opaque strings, including numeric-looking values; router
search parsing and serialization preserve their exact text.
Apple opens the native sheet without a code, or the App Store offer-code URL
when a code is supplied. Google Play's external redemption supports one-time
codes; checkout help explains how to redeem offers that need the payment-method
menu in Google Play, without asking customers to identify their code type. Custom Google codes do not
provide lifetime access and cannot be redeemed through the external URL.

Share a branded link such as `https://trizum.app/redeem?code=FRIENDS`.
The native platform takes priority; browsers detect iOS/iPadOS or Android and
show the corresponding store. Other devices see both options. Codes remain
store-specific; the same text only works on both stores if separately configured
there. The landing page does not redeem automatically. Native universal/app links already cover
this route, including cold launches. Browser users can follow the documented
store links; Google custom codes require opening trizum on Android and selecting
the subscription plan. Apple/Google's own redemption URLs continue to open their
stores directly, not a trizum route.

`public/_headers` sets `X-Robots-Tag: noindex, nofollow` on `/redeem` and its
subpaths, including query variants; the rendered page also emits a robots meta
tag. Do not add a robots.txt disallow for this path: crawlers must be able to
read the noindex response. Codes are not included in sitemaps.

Opening native redemption records only the trizum account and a 15-minute retry
window locally, never the code. Existing foreground/startup refreshes sync store
purchases and invalidate the RevenueCat cache while that redemption is pending.
Delayed receipts retry until Premium appears or the window expires. Offline
failures preserve cached access, and another signed-in account cannot consume
the pending sync. External redemptions started outside trizum rely on the SDK's
normal transaction discovery; **Restore purchases** remains the explicit
recovery path. Code submission alone never grants Premium or Party Boost.

Create codes, eligibility, usage limits and expiry in App Store Connect or Play
Console. This UI does not create offers or validate redemption counts itself.
