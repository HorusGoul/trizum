# trizum screenshots

This package generates store and marketing screenshots with Playwright.

## Canonical Sources

- [`vite.config.ts`](./vite.config.ts) and [`package.json`](./package.json)
  are the source of truth for package tasks and scripts.
- [`src/main.ts`](./src/main.ts) captures deterministic app states across
  locales and device profiles.
- [`src/store-design.ts`](./src/store-design.ts) is the source of truth for
  store order, localized marketing copy, color direction, and composition.
- [`src/generate-previews.ts`](./src/generate-previews.ts) produces reviewable
  contact sheets showing the final store order.
- [`src/feature-graphic.ts`](./src/feature-graphic.ts) generates localized
  Google Play feature graphics from the same deterministic captures.
- [`src/organize-for-fastlane.ts`](./src/organize-for-fastlane.ts) reshapes the
  generated assets for App Store and Play Store upload flows.

## Package Notes

- Upload-ready screenshots are written under
  `screenshots/<locale>/<device>/`; uncomposed captures are temporary files in
  `.captures/`.
- Google Play feature graphics are written under
  `feature-graphics/<locale>/featureGraphic.png` at 1024×500 pixels.
- Screenshots, feature graphics, raw captures, and review previews are generated
  outputs and are intentionally ignored by Git.
- The screenshot workflow uploads screenshots and feature graphics in its main
  artifact and uploads contact sheets separately as the `<artifact>-previews`
  job artifact.
- The package targets English and Spanish across Google Play phone and tablet
  sizes, the current App Store 6.9-inch iPhone size, and the required 13-inch
  iPad size.

## Capture and composition

Read [the capture guide](./docs/capture.md) when changing scene order, visual
composition, deterministic state, or filtering development captures.

## Validation

Run the package tasks and scripts defined in [`vite.config.ts`](./vite.config.ts)
and [`package.json`](./package.json):

- `vp run check`
- `vp run setup` on first use to install Playwright browser dependencies with
  the smaller Chromium headless shell
- `vp run start` to capture screenshots
- `vp run compose` to reapply the store design to existing `.captures/` without
  opening the app again; this also regenerates feature graphics
- `vp run feature-graphic` to regenerate only the feature graphics from existing
  Android captures
- `vp run preview` to generate App Store and Google Play contact sheets after a
  full capture; this includes phone and tablet sheets for every locale and
  labels the shared Google Play tablet artwork used for both 7-inch and 10-inch
  slots
- `vp run organize:fastlane --platform <ios|android> --output <path>` to prepare
  store-upload assets; Android output includes the localized feature graphic
