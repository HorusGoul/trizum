# @trizum/ui

## 0.1.0

### Minor Changes

- [#597](https://github.com/HorusGoul/trizum/pull/597) [`a497628`](https://github.com/HorusGoul/trizum/commit/a497628071993570116cf18d876b0c1ddc2e2949) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add the internal React design system package with copied PWA components, shared
  styles and fonts, Lingui catalogs, consumer-generated icons, and local Storybook.
  Compile package components and Storybook development source with the Vite React
  plugin’s React Compiler integration.
  The PWA continues to use its original components until follow-up migrations.

  Allow icon generation to exclude shared generated directories so catalog type
  files do not cause unused icons to be bundled by consumers.

### Patch Changes

- [#604](https://github.com/HorusGoul/trizum/pull/604) [`e202bf9`](https://github.com/HorusGoul/trizum/commit/e202bf9672a61a245d91af4d2c4a050c3209fc95) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Improve gallery flick dismissal and backdrop tracking, pull-to-refresh resistance and cancellation, calculator cursor dragging, and toast swipe direction. Respect reduced motion when gallery and refresh gestures settle.

  Allow shared and calculator sheets to stretch above their highest snap point with resistance and spring back on release.

  Stretch one continuous sheet surface, including its background, border, and shadow, to the screen edge during upward overdrag and spring-back. Keep the content and snap-point measurements unchanged.

  Align the calculator sheet and bottom fill across mobile widths, and restore the gallery backdrop when reopening during its exit animation.

  Start cold sheet openings from their measured height, synchronize backdrop visibility and progress, and use a gentler shared iOS-style opening curve.

  Keep repeated sheet openings animated, reverse interrupted closes without resetting position, and discard superseded transition completions.

  Continue gallery dismissals off-screen with release momentum, retain photos through exit fades, and let refresh pulls continue beyond the threshold with increasing resistance.

- [#611](https://github.com/HorusGoul/trizum/pull/611) [`6f6f7fc`](https://github.com/HorusGoul/trizum/commit/6f6f7fcfe8792b065ea0868e5754a040ab2d0119) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Move option selection checkmarks to the right with more space between the text and indicator, and align section headers with option labels.

- [#610](https://github.com/HorusGoul/trizum/pull/610) [`e523fd6`](https://github.com/HorusGoul/trizum/commit/e523fd6c19207184372ecd90c01c1b273f9e1839) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Restore left, right, and downward toast swipe dismissal and prevent toast text selection from interfering with gestures. Require deliberate travel or a clear flick to dismiss; small nudges and short slow drags snap back.
- Updated dependencies [[`a497628`](https://github.com/HorusGoul/trizum/commit/a497628071993570116cf18d876b0c1ddc2e2949)]:
  - @trizum/icon-sprite@1.1.0
