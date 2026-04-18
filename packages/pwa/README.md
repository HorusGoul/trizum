# trizum PWA

This package is the main application and the default package-level entry point
for most product work. Read the repo [AGENTS guide](../../AGENTS.md) first,
then use this document to decide where to work inside the PWA.

## Canonical Sources

- [`package.json`](./package.json) is the source of truth for package scripts.
- [`src/routes`](./src/routes) contains route entry points.
- [`src/ui`](./src/ui) contains the shared design-system components.
- [`src/components`](./src/components) contains app-specific UI.
- [`src/lib`](./src/lib) and [`src/models`](./src/models) contain business logic
  and domain models.
- [`e2e/README.md`](./e2e/README.md) defines the shared Playwright browser
  harness and deterministic journey setup strategy.
- [`locale/AGENTS.md`](./locale/AGENTS.md) contains translation terminology and
  localization guardrails.

## Package Notes

- The app is offline-first and uses Automerge for shared, persisted data.
- User-facing copy must use Lingui macros, then run `pnpm lingui:extract`.
- `src/routeTree.gen.ts` is generated. Do not edit it manually.
- `src/generated/iconSprite.gen.ts` and `src/generated/iconSprite.svg` are
  generated from the available icon catalog and current icon usage. Regenerate
  them with `pnpm icons:generate` or the corresponding skill instead of
  hand-editing them.

## Validation

Run the package scripts defined in [`package.json`](./package.json):

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lingui:extract` when copy changes
