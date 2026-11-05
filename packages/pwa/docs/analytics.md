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

## Anonymous MCP server events

The MCP route uses `@trizum/analytics`'s `createAnonymousServerAnalytics` for
completed `create_party`, explicit `get_party`, and `add_expense` actions. The
shared event catalog defines their names and meanings. Writes emit only after
their D1 receipt is saved; successful replays and internal reads do not emit.
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
