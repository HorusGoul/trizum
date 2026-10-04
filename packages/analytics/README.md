# @trizum/analytics

Privacy-aware InsightFlare pageviews and custom events. This package owns the
outbound data boundary and transport; the PWA owns configuration and profile
lifecycle.

## Sources of truth

- [Event catalog](./src/events.ts): approved names and trigger meanings.
- [Client](./src/index.ts) and [privacy helpers](./src/privacy.ts): buffering,
  cancellation, payloads, and redaction. [Tests](./src/index.test.ts) cover these
  boundaries.
- [PWA integration](../pwa/src/lib/analytics.ts): endpoint, build flags,
  preferences, connectivity, and profile switching.
- [First-party proxy](../pwa/api/routes/spycat.ts): upstream forwarding and header filtering.
- [Telemetry integration](../pwa/src/lib/telemetry.ts): shared identity and Sentry
  privacy handling.
- [Analytics-events skill](../../.agents/skills/analytics-events/SKILL.md):
  instrumentation workflow and privacy rules for new features.
- [Package tasks](./vite.config.ts): build, check, and test commands.

## Design rationale

InsightFlare's SDK collects raw URLs without a pre-send redaction hook, so we
parse its bootstrap as text and send sanitized payloads ourselves. This depends
on an internal protocol: when upgrading the deployment, check the upstream
[SDK](https://github.com/RavelloH/InsightFlare/blob/main/src/tracker/sdk.ts),
[bootstrap endpoint](https://github.com/RavelloH/InsightFlare/blob/main/src/lib/edge/collector/script-endpoint.ts),
and [collector](https://github.com/RavelloH/InsightFlare/blob/main/src/lib/edge/collector/collect.ts).
Never fall back to executing the remote SDK.

The first-party proxy handles native CORS. A Cloudflare service binding preserves
the client IP and location metadata that public cross-zone fetches can replace;
bootstrap and collection must use the same forwarding path for IP-bound tokens.

The synced `telemetryId` is random rather than derived from a document ID because
document IDs grant sharing access. It enables pseudonymous cross-device
correlation, not anonymity. Concurrent offline migrations can temporarily produce
different IDs before Automerge converges.
