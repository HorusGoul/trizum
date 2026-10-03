# @trizum/analytics

Privacy-aware InsightFlare pageviews and custom events for trizum. The PWA owns
configuration, router notifications, and the persisted preference; this package
owns the outbound data boundary and transport.

## Privacy boundary

- The client starts disabled. The PWA enables it only after loading the Automerge
  party list; `usageAnalyticsEnabled` defaults to true and Settings can disable it
  immediately. The preference follows the party list when it is synced.
- Do Not Track (`1` or `yes`), Global Privacy Control, offline state, and the
  application opt-out prevent requests, including the bootstrap request. Privacy
  signals are checked again after asynchronous work. Disabling aborts requests
  and invalidates queued events and the in-memory token. Already delivered events
  cannot be withdrawn by aborting a request.
- The PWA observes connectivity changes, ends collection while offline, and starts
  a fresh visit for the current route on reconnect. Offline activity is not replayed.
- Paths are matched against **trusted build-time router templates**. Every dynamic
  segment becomes `:redacted`, including party, expense, and template identifiers.
  Unknown paths become `/:unknown`; arbitrary static-looking input is never sent.
- Query strings, fragments, document titles, and referrer URLs are empty. Both
  bootstrap and collection use `referrerPolicy: "no-referrer"` and
  `credentials: "omit"`. Never supply user data as `routes`, `hostname`, or `siteId`.
- Custom events accept only the names in `AnalyticsEvent`, checked again at
  runtime. There is no arbitrary property bag, identity API, or DOM auto-capture.
- Visit IDs are random and held only in memory. There are no cookies, stored
  visitor IDs, persistent queues, or retries of offline events. Cloudflare still
  receives IP addresses and browser request headers; the server can derive its
  normal visitor/location statistics. This is data minimization, not anonymity.

## InsightFlare compatibility

The supplied v6 SDK automatically collects raw locations and has no pre-send
redaction hook. Loading that script in the document would bypass our boundary.
Instead we fetch `/script.js?siteId=…` as **text**, parse only its leading JSON
`__insightflare_tracker_runtime_config__` assignment, and use the IP-scoped
`collectToken` to POST the minimal v6 payload to `/collect`. SDK code is never
executed. Tokens are held in memory for at most five minutes, and failed requests
invalidate them. The queue is bounded to 20 events, with five-second request
limits. Tracking never delays application actions.

This intentionally depends on InsightFlare's current internal bootstrap/collector
contract, rather than its public `window.insightflare` API. An incompatible
bootstrap change stops tracking; it never falls back to running the remote SDK.
Recheck this contract when upgrading the private deployment:

- [SDK source](https://github.com/RavelloH/InsightFlare/blob/main/src/tracker/sdk.ts)
- [Script endpoint](https://github.com/RavelloH/InsightFlare/blob/main/src/lib/edge/collector/script-endpoint.ts)
- [Collector](https://github.com/RavelloH/InsightFlare/blob/main/src/lib/edge/collector/collect.ts)

Only pageviews and custom events are implemented. Automatic outbound-link
tracking, browser client hints, performance metrics, identity, visit duration,
and visibility/leave events are deliberately outside this integration.

## PWA configuration

`src/lib/analytics.ts` in the PWA uses site
`9cf3da44-3ae9-478d-95aa-7015e864557e` and the working endpoint
`https://spycat.horus.dev`. Override `VITE_APP_ANALYTICS_URL` at build time to use
another endpoint, such as `https://insightflare.horusdev.workers.dev` for diagnostics.

Collection is enabled in production on `trizum.app` and in native builds.
Development, preview hosts, and tests do not collect by default:

- `VITE_APP_ENABLE_ANALYTICS=true` explicitly enables a verification build.
- `VITE_APP_DISABLE_ANALYTICS=true` disables analytics regardless of other flags.
- Neither flag overrides the user's opt-out or browser privacy signals.

## Custom-event coverage

[`src/events.ts`](./src/events.ts) is the complete event catalog and runtime
allowlist, with the precise meaning of every event. Product code calls the PWA
facade with a literal name and no properties.

| Feature       | Covered actions                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Groups        | Create, join, leave, pin/unpin, archive/restore, edit details/participants, switch participant, share request, copy invite link                |
| Balances      | Expenses/balances tab switches, personal mode, sorting, successful manual recalculation                                                        |
| Expenses      | Create, edit, delete, template use, settlement recording, debt transfer, copy Bizum contact                                                    |
| Templates     | Create, edit, delete, default changes, picker shortcut and custom-only mode                                                                    |
| Import        | Tricount start, completion and failure                                                                                                         |
| Editing tools | Calculator opening/auto-open, draft receipt batches/removal, gallery opening, validated join QR scan                                           |
| Settings      | Profile/settings save and draft avatar selection/removal                                                                                       |
| Account/cloud | Email and social sign-in requests, confirmed in-app sign-in, linking request, password reset, sign-out/deletion, cloud-list activation         |
| Premium       | Paywall opening, purchase/restore outcomes, subscription-management request, redemption request/code copy, boost application, banner dismissal |

Completed events follow successful writes or awaited results. External flows use
`_requested` when completion is not observable. Purchase results distinguish
cancellation from failure, and restores distinguish active entitlements from
empty results. Store results can arrive after dismissing the paywall and still
count the original operation once; they do not imply entitlement activation.
Draft receipt/avatar events describe editing activity, not saved documents.
Cloud activation is counted only when both source and destination lists allow
analytics; a destination opt-out takes effect before switching lists.

Deliberate exclusions: ordinary route navigation (already pageviews), individual
form fields and keystrokes, financial values, automatic sync/recalculations,
advertising internals, update checks, and diagnostic errors. OAuth and email-link
redirect completions are not currently counted as `auth_signed_in`; only a
confirmed in-app sign-in result is counted. Shares and external payments have no
completion event because the app cannot verify delivery or payment.

For new or changed features, follow the
[`analytics-events` skill](../../.agents/skills/analytics-events/SKILL.md).
Router notifications with the same pathname are deduplicated; navigation between
two parties still produces separate visits with the same redacted path.

## Validation

Run `vp run --filter @trizum/analytics build`, `vp run --filter @trizum/analytics
check`, and `vp run --filter @trizum/analytics test`. Tests exercise the actual
fetch payloads, redaction, fail-closed bootstrap, browser privacy signals, bounded
queues, and opt-out during pending requests. No unit test contacts the live site.
