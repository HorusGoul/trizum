# trizum logging

Shared LogTape helpers for `trizum` applications.

Read the repo [AGENTS guide](../../AGENTS.md) first. This package exists to
standardize LogTape categories and configuration across the monorepo while
keeping configuration ownership in application entry points.

For repo-wide guidance on what to log and which severity level to use, see
[`docs/logging.md`](../../docs/logging.md).

## Canonical Sources

- [`package.json`](./package.json) is the source of truth for package scripts
  and dependencies.
- [`src/index.ts`](./src/index.ts) contains the shared category and
  configuration helpers.

## Package Notes

- This package should help applications configure LogTape consistently.
- It should not auto-configure logging on import.
- Applications should call `configureTrizumLogging()` from their runtime entry
  points and use `getTrizumLogger()` elsewhere.

## Validation

Run the package scripts defined in [`package.json`](./package.json):

- `pnpm lint`
- `pnpm typecheck`
