# @trizum/analytics

## 1.1.1

### Patch Changes

- [#587](https://github.com/HorusGoul/trizum/pull/587) [`16ba80f`](https://github.com/HorusGoul/trizum/commit/16ba80f38f2e85615180c09071a2048836406a8d) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Exclude automated browsers from usage analytics and prevent store screenshot captures from sending production analytics requests.

## 1.1.0

### Minor Changes

- [#476](https://github.com/HorusGoul/trizum/pull/476) [`a637690`](https://github.com/HorusGoul/trizum/commit/a63769028e562dcf4f0a190ff5e9521b8190b470) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add privacy-aware InsightFlare pageviews and feature usage events with an immediate Settings opt-out. Honor browser privacy signals, redact all dynamic route identifiers, and exclude personal and financial data from analytics payloads.

  Cover group management, expenses and templates, imports, sharing, editing tools, cloud accounts, and Premium flows with documented custom events. Distinguish successful operations from external-flow requests, cancellations, and failures.

  Buffer sanitized startup events briefly until preferences load. Sync a random telemetryId with the party list and reuse it for analytics, Sentry, and PWA logs, honoring opt-out and browser privacy signals. Disclose cross-device correlation in the privacy policy.

  Proxy analytics through trizum's API with a Cloudflare service binding, preserving visitor metadata and supporting native CORS with readable responses.

  Keep the Settings analytics description concise and preserve bottom spacing above device safe areas.
