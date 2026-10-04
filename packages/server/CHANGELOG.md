# @trizum/server

## 1.0.3

### Patch Changes

- [#457](https://github.com/HorusGoul/trizum/pull/457) [`ed5912f`](https://github.com/HorusGoul/trizum/commit/ed5912fa301dac4cfe85f22a59d9defd2a67bf77) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Redact Automerge document IDs from direct and automatic Sentry errors,
  breadcrumbs, structured logs, and traces in the browser and sync server.
  Preserve error classification, stack locations, and trace correlation.

- [#455](https://github.com/HorusGoul/trizum/pull/455) [`46c6f53`](https://github.com/HorusGoul/trizum/commit/46c6f53ca280f0ac09648ddb41ce3a787b776268) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Redact Automerge document IDs before logs reach console or monitoring sinks,
  including nested error causes and stacks, while preserving diagnostic context.
  Remove the document ID from cloud-sync success logs.

  Fixes [#452](https://github.com/HorusGoul/trizum/issues/452).

- Updated dependencies [[`ed5912f`](https://github.com/HorusGoul/trizum/commit/ed5912fa301dac4cfe85f22a59d9defd2a67bf77), [`46c6f53`](https://github.com/HorusGoul/trizum/commit/46c6f53ca280f0ac09648ddb41ce3a787b776268)]:
  - @trizum/logging@1.0.1

## 1.0.2

### Patch Changes

- [#188](https://github.com/HorusGoul/trizum/pull/188) [`96d0a3e`](https://github.com/HorusGoul/trizum/commit/96d0a3e1cf81af575e7e236e466baab0c5524499) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Fix the server Docker image build so releases can install workspace dependencies before packaging the runtime.

## 1.0.1

### Patch Changes

- [#187](https://github.com/HorusGoul/trizum/pull/187) [`dc995e8`](https://github.com/HorusGoul/trizum/commit/dc995e853ed868fb32884aa409d0c20315cc6ccc) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Server releases through CI

- [#186](https://github.com/HorusGoul/trizum/pull/186) [`7426462`](https://github.com/HorusGoul/trizum/commit/7426462ad902cd6fe7edb2c66fd027ddb2aade0d) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Update Automerge runtime dependencies to the latest published patch releases.

## 1.0.0

### Major Changes

- bc9e06d: Bumping to 1.0.0
