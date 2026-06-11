# trizum PWA

This package is the main application and the default package-level entry point
for most product work. Read the repo [AGENTS guide](../../AGENTS.md) first,
then use this document to decide where to work inside the PWA.

## Canonical Sources

- [`vite.config.ts`](./vite.config.ts) and [`package.json`](./package.json)
  are the source of truth for package tasks and scripts.
- [`src/routes`](./src/routes) contains route entry points.
- [`src/ui`](./src/ui) contains the shared design-system components.
- [`src/components`](./src/components) contains app-specific UI.
- [`src/lib`](./src/lib) and [`src/models`](./src/models) contain business logic
  and domain models.
- [`src/lib/data`](./src/lib/data) contains the app-facing Fate/Jazz data
  client context and PWA view-model data helpers.
- [`e2e/README.md`](./e2e/README.md) defines the shared Playwright browser
  harness and deterministic journey setup strategy.
- [`locale/AGENTS.md`](./locale/AGENTS.md) contains translation terminology and
  localization guardrails.

## Package Notes

- The app is local-first and uses Fate over Jazz alpha for shared, persisted data.
- User-facing copy must use Lingui macros, then run `vp run lingui:extract`.
- `src/routeTree.gen.ts` is generated. Do not edit it manually.
- `src/generated/iconSprite.gen.ts` and `src/generated/iconSprite.svg` are
  generated from the available icon catalog and current icon usage. They are
  intentionally untracked; regenerate them with `vp run icons:generate` or let
  the package scripts do it automatically instead of hand-editing them.

## Validation

Run the package tasks and scripts defined in [`vite.config.ts`](./vite.config.ts)
and [`package.json`](./package.json):

- `vp run check`
- `vp run test`
- `vp run build`
- `vp run lingui:extract` when copy changes

## Deployment

Cloudflare deployments are managed by GitHub Actions instead of Cloudflare's
connected repository builds.

- Production deploys run after a changeset release updates the PWA version or
  changelog on `main`.
- Pull requests get Cloudflare preview deployments from the
  `PWA Preview` workflow, and the workflow updates a PR comment with the latest
  preview URL.
- The workflows require `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
  repository secrets.
