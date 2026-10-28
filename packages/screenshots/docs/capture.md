# Screenshot composition and capture

[Back to package overview](../README.md). Read when changing the store story, deterministic capture, or filtered runs. Run commands from `packages/screenshots`.

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
UI as the focal point. Store previews are generated under `previews/` for local
review and CI artifact upload rather than source control.

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
`SCREENSHOTS_DEVICES`, and `SCREENSHOTS_SCENES` filters select a subset. Set `SCREENSHOTS_CLEAN=false` only when deliberately assembling several
filtered development runs; full and CI runs always clean first.

```sh
SCREENSHOTS_LOCALES=en \
SCREENSHOTS_DEVICES=android \
SCREENSHOTS_SCENES=expense-log,balances \
vp run start
```
