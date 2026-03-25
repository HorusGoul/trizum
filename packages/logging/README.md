# trizum logging

Shared LogTape helpers for `trizum` logging surfaces.

Read the repo [AGENTS guide](../../AGENTS.md) first. This package exists to
standardize LogTape categories and configuration across the monorepo while
keeping configuration ownership in runtime entry points.

For repo-wide guidance on what to log and which severity level to use, see
[`docs/logging.md`](../../docs/logging.md).

## Canonical Sources

- [`package.json`](./package.json) is the source of truth for package scripts
  and dependencies.
- [`src/index.ts`](./src/index.ts) contains the shared category and
  configuration helpers.
- [`src/github-actions.ts`](./src/github-actions.ts) contains the GitHub
  Actions annotation sink entrypoint.

## Package Notes

- This package should help each runtime surface configure LogTape consistently.
- It should not auto-configure logging on import.
- Runtime entry points should call `configureTrizumLogging()`, and shared code
  should use `getTrizumLogger()` elsewhere.
- Runtime-specific integrations like GitHub Actions annotations should be
  modeled as opt-in sinks configured by the owning surface via separate
  entrypoints.

## Validation

Run the package scripts defined in [`package.json`](./package.json):

- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
