# PWA analytics integration

[Back to package overview](../README.md). Read when changing telemetry preferences or analytics initialization.

## Usage Analytics

[`@trizum/analytics`](../../analytics/README.md) owns InsightFlare transport and the
outgoing privacy boundary. `src/lib/analytics.ts` configures the site and runtime
gates; `main.tsx` connects router pageviews and the Automerge
`usageAnalyticsEnabled` preference. Analytics defaults to enabled after preferences
load, with an immediate Settings opt-out and DNT/GPC overrides. Preview and dev
builds do not collect unless explicitly enabled. See the analytics package README
for endpoint overrides, supported events, and the upstream compatibility contract.

Automated browsers are excluded through `navigator.webdriver` and explicit
Playwright/headless user-agent markers. The proxy also drops marked automation;
ordinary Chrome and Safari device user agents remain eligible for collection.

## AI invite acquisition

MCP party links use `entry=ai` to show download and web choices. Campaign labels
(`utm_source=mcp` or `chatgpt`, `utm_medium=ai_app`, and
`utm_campaign=party_handoff`) are independently validated by `@trizum/analytics`.
Only this fixed combination can become the outgoing visit query; party IDs,
redirect URLs, codes, and other query values are discarded. Initial browser and
validated native deep-link campaigns are captured before join redirects.
Attribution stays in memory, follows subsequent pages and events, and is cleared
when analytics is disabled, offline, or changes profiles. Existing environment,
preference, DNT/GPC, and automation gates apply.

The handoff pageview counts exposure; store, app-open, and web-continue events
count requested actions. They do not confirm installations or native launches.
Existing party-join events measure web activation. Store links carry neither the
party ID nor campaign parameters and suppress the referrer. There is no deferred
install tracking: after installing, users reopen the invite. Server action counts
cannot be joined to individual browser sessions. Production browser handoffs live
on `join.trizum.app`; web continuation returns approved UTM labels to `trizum.app`
without passing profile IDs. Each origin retains its own analytics preference
and local profile, so cross-origin campaign reports are aggregate counts rather
than individual visitor conversion tracking.

## Anonymous MCP server events

The MCP route uses `@trizum/analytics`'s `createAnonymousServerAnalytics` for
completed party, participant, and expense mutations, plus explicit `get_party`
and `get_expense` reads. The shared event catalog defines their names and meanings. Writes emit only after
the public tool completes and its output validates. Repeated creations count as
separate completed actions. Internal reads and failed calls do not emit.
Collection runs through `waitUntil`, with a four-second timeout and no retries.
Failures never change the tool result.

These aggregate service events do not need a signed-in profile. They send no
user ID, client IP, user agent, Cloudflare location, group identifiers, names,
amounts, or tool arguments. A fixed synthetic service visitor and a five-minute
service visit satisfy InsightFlare's custom-event protocol. The Worker reuses
one analytics client per binding; bootstrap is shared across concurrent actions.
After bootstrap, each action requires only one collection request. Filter
`/api/mcp` out of human pageview and unique-visitor reports; custom events count
actions, not people.

The Worker uses the existing `SPYCAT` binding with a fixed server IP/agent and
empty Cloudflare metadata for both bootstrap and collection. It parses the
bootstrap configuration without executing the SDK. DNT/GPC requests are dropped.
Production `trizum.app` requests collect by default; dev/preview requests do not.
`MCP_ANALYTICS_ENABLED=true` opts a Worker environment in, and `false` disables
it, including production. Missing bindings disable collection. The PWA's own
profile preference and identity behavior remain managed by its browser facade.
