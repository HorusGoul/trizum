---
"@trizum/analytics": minor
"@trizum/pwa": minor
"@trizum/logging": minor
---

Add privacy-aware InsightFlare pageviews and feature usage events with an immediate Settings opt-out. Honor browser privacy signals, redact all dynamic route identifiers, and exclude personal and financial data from analytics payloads.

Cover group management, expenses and templates, imports, sharing, editing tools, cloud accounts, and Premium flows with documented custom events. Distinguish successful operations from external-flow requests, cancellations, and failures.

Buffer sanitized startup events briefly until preferences load. Sync a random telemetryId with the party list and reuse it for analytics, Sentry, and PWA logs, honoring opt-out and browser privacy signals. Disclose cross-device correlation in the privacy policy.

Proxy analytics through trizum's API with a Cloudflare service binding, preserving visitor metadata and supporting native CORS with readable responses.

Keep the Settings analytics description concise and preserve bottom spacing above device safe areas.
