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
