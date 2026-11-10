# @trizum/icon-sprite

## 1.1.0

### Minor Changes

- [#597](https://github.com/HorusGoul/trizum/pull/597) [`a497628`](https://github.com/HorusGoul/trizum/commit/a497628071993570116cf18d876b0c1ddc2e2949) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add the internal React design system package with copied PWA components, shared
  styles and fonts, Lingui catalogs, consumer-generated icons, and local Storybook.
  Compile package components and Storybook development source with the Vite React
  plugin’s React Compiler integration.
  The PWA continues to use its original components until follow-up migrations.

  Allow icon generation to exclude shared generated directories so catalog type
  files do not cause unused icons to be bundled by consumers.
