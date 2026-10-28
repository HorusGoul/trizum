# trizum PWA

The main React application, with offline-first Automerge state and a Cloudflare Worker API.

## Start here

- [Routes](./src/routes), [design system](./src/ui), and [app components](./src/components).
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
  `src/generated/tw-dynamic-themes.css` is generated from the default dynamic
  theme hue. These files are intentionally untracked; regenerate them with
  `vp run codegen`, or let the package scripts do it automatically instead of
  hand-editing them.

## Validation

Follow [workspace validation](../../docs/agents/validation-and-releases.md).
Run package tasks from this directory with `vp run`; copy changes also require
`vp run lingui:extract` from the workspace root.
