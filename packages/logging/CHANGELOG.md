# @trizum/logging

## 1.0.1

### Patch Changes

- [#457](https://github.com/HorusGoul/trizum/pull/457) [`ed5912f`](https://github.com/HorusGoul/trizum/commit/ed5912fa301dac4cfe85f22a59d9defd2a67bf77) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Redact Automerge document IDs from direct and automatic Sentry errors,
  breadcrumbs, structured logs, and traces in the browser and sync server.
  Preserve error classification, stack locations, and trace correlation.

- [#455](https://github.com/HorusGoul/trizum/pull/455) [`46c6f53`](https://github.com/HorusGoul/trizum/commit/46c6f53ca280f0ac09648ddb41ce3a787b776268) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Redact Automerge document IDs before logs reach console or monitoring sinks,
  including nested error causes and stacks, while preserving diagnostic context.
  Remove the document ID from cloud-sync success logs.

  Fixes [#452](https://github.com/HorusGoul/trizum/issues/452).
