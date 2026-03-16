# trizum screenshots

This package generates store and marketing screenshots with Playwright. It is
not part of the default coding-agent read path for normal app or server work.
Only read this package when the task explicitly involves screenshot capture or
Fastlane screenshot handoff.

## Canonical Sources

- [`package.json`](./package.json) is the source of truth for package scripts.
- [`src/main.ts`](./src/main.ts) captures screenshots across locales and device
  profiles.
- [`src/organize-for-fastlane.ts`](./src/organize-for-fastlane.ts) reshapes the
  generated assets for App Store and Play Store upload flows.

## Package Notes

- Generated screenshots are written under `screenshots/<locale>/<device>/`.
- The package currently targets `en` and `es` locales and captures Android,
  iPhone, iPad, and desktop variants.
- This package should stay specialist and avoid becoming a generic harness entry
  point.

## Validation

Run the package scripts defined in [`package.json`](./package.json):

- `pnpm setup` on first use to install Playwright browser dependencies
- `pnpm start` to capture screenshots
- `pnpm organize:fastlane --platform <ios|android> --output <path>` to prepare
  store-upload assets
- `pnpm lint`
- `pnpm typecheck`
