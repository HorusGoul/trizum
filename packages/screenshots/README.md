# trizum screenshots

This package generates store and marketing screenshots with Playwright. It is
not part of the default coding-agent read path for normal app or server work.
Only read this package when the task explicitly involves screenshot capture or
Fastlane screenshot handoff.

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
- [`src/icon-concepts.ts`](./src/icon-concepts.ts) defines the deterministic
  default, dark, light, and monochrome icon-system study.
- [`src/organize-for-fastlane.ts`](./src/organize-for-fastlane.ts) reshapes the
  generated assets for App Store and Play Store upload flows.

## Package Notes

- Upload-ready screenshots are written under
  `screenshots/<locale>/<device>/`; uncomposed captures are temporary files in
  `.captures/`.
- Google Play feature graphics are written under
  `feature-graphics/<locale>/featureGraphic.png` at 1024×500 pixels.
- The package targets English and Spanish across Google Play phone and tablet
  sizes, the current App Store 6.9-inch iPhone size, and the required 13-inch
  iPad size.
- This package should stay specialist and avoid becoming a generic harness entry
  point.

## Store Story And Order

Both stores receive the same six-frame product story. The order is encoded once
in `STORE_SCREENSHOT_ORDER` and reused by the compositor, previews, and Fastlane
organization:

1. Expense log — show the shared list and totals.
2. Balances — show who owes what.
3. Expense editor — show what can be changed.
4. Expense detail — show the exact split.
5. Stats — show group and participant totals.
6. Group members — show how a person selects their identity.

The output uses high-contrast localized copy, a restrained per-scene accent,
embedded Inter fonts, and a lightweight device treatment that keeps the real app
UI as the focal point. Store previews are generated under `previews/`.

## Determinism

The generator fixes the browser clock (`2025-03-12T12:00:00Z`), timezone (UTC),
locale, color scheme, viewport, device scale factor, reduced-motion preference,
seed data, local marketing font files, and all composition assets. Before each
capture it finishes finite browser animations, waits for two paint frames and
font readiness, hides notifications and the caret, and disables CSS motion.
No random IDs or network images are visible in the final scenes.

By default the app is captured from `https://trizum.app`. Set
`SCREENSHOTS_BASE_URL` to capture a locally served build or a release candidate.
For quicker development runs, comma-separated `SCREENSHOTS_LOCALES`,
`SCREENSHOTS_DEVICES`, and `SCREENSHOTS_SCENES` filters select a subset. For
example. Set `SCREENSHOTS_CLEAN=false` only when deliberately assembling several
filtered development runs; full and CI runs always clean first.

```sh
SCREENSHOTS_LOCALES=en \
SCREENSHOTS_DEVICES=android \
SCREENSHOTS_SCENES=expense-log,balances \
vp run start
```

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
- `vp run icon-concepts` to render the icon concepts and their cross-platform
  review sheet
- `vp run preview` to generate App Store and Google Play contact sheets after a
  full capture
- `vp run organize:fastlane --platform <ios|android> --output <path>` to prepare
  store-upload assets; Android output includes the localized feature graphic
