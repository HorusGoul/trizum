# trizum PWA

The main React application, with offline-first Automerge state and a Cloudflare Worker API.

## Start here

- [Routes](./src/routes), [design system](../ui/README.md), and [app components](./src/components).
- [Business logic](./src/lib) and [domain models](./src/models).
- [Package tasks](./vite.config.ts) and [scripts](./package.json).
- **Change UI or client state:** [PWA conventions](../../docs/agents/pwa.md).
- **Change HTTP routes or clients:** [First-party API](./docs/api.md).
- **Configure Cloudflare:** [Worker setup and deployment](./docs/cloudflare.md).
- **Change authentication or deletion:** [OAuth](./docs/oauth.md) and [account deletion](./docs/account-deletion.md).
- **Change paid features:** [Party Boost state](./docs/party-boost.md), [promo codes](./docs/promo-codes.md), and [native monetization](../mobile/docs/monetization.md).
- **Change telemetry:** [Analytics integration](./docs/analytics.md).
- **Write browser journeys:** [E2E harness](./e2e/README.md).
- **Translate copy:** [Locale guide](./locale/AGENTS.md).

## Generated files

- `src/routeTree.gen.ts` is generated. Do not edit it manually.
- `src/generated/iconSprite.gen.ts` and `src/generated/iconSprite.svg` are
  generated from the available icon catalog and current icon usage.
  Both files are intentionally untracked; regenerate them with
  `vp run codegen`, or let the package scripts do it automatically instead of
  hand-editing them. Icon generation scans the app and design-system source.

## Shared UI setup

- `src/components/PwaUIProvider.tsx` bridges the active Lingui locale, generated
  icon sprite, and shared sheet navigation into `@trizum/ui`. Browser and native
  Back close the top shared sheet before leaving its page. Shared fonts, resets,
  tokens, and animations come
  from `@trizum/ui/styles.css`; `src/index.css` owns the app root sizing.
- `src/lib/i18n.ts` merges the package's compiled catalogs with PWA catalogs.
  Extract PWA messages only from this package's source; shared UI catalogs are
  maintained in `packages/ui`.

## Validation

Follow [workspace validation](../../docs/agents/validation-and-releases.md).
Run package tasks from this directory with `vp run`; copy changes also require
`vp run lingui:extract` from the workspace root.

## Test boundaries

Tests use the real router, React Aria controls, auth state, logging sinks, and
in-memory Automerge documents. Native SDKs, worker connections, process runners,
and other external I/O are supplied through their owning service interfaces or
factories. Module mocking is rejected by `anti-slop/no-module-mocking`.

When changing persisted models, forms, serializers, or mutation helpers, follow
the [Automerge persistence test rules](../../docs/agents/coding.md#automerge-persistence-tests).

`src/lib/testing/profileRuntime.ts` supplies HTTP responses and real local
profiles for account flows. `api/routes/cloud-sync.integration.test.ts` exercises
real authentication and D1 storage alongside the route's focused contract tests.
