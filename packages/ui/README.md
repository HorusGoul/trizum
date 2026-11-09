# trizum UI

Internal React design system for the PWA and other trizum apps. This package
owns the shared components consumed by the PWA.
Components retain their existing APIs and styling, including `App`-prefixed names.
Routing, persistence, preferences, and product orchestration belong to consumers.

## Entry points

Import components directly, for example `@trizum/ui/Button`,
`@trizum/ui/fields/AppTextField`, and `@trizum/ui/MediaGallery` (default export).
`src/` contains the components, general UI hooks, and theme runtime.
`stories/` documents their composition and variants. `icons/` holds the shared
brand and illustration catalog, alongside Lucide icons supplied by the icon helper.

The ESM JavaScript and declarations are built into `dist`. This browser library
uses TypeScript's Bundler resolution because its browser dependencies (including
`qr-code-styling`) publish types that do not support NodeNext resolution. Relative
imports still use `.js` specifiers. Vite builds the ESM modules with
`@vitejs/plugin-react`'s `compiler: true` integration; TypeScript emits declarations.
Lingui macros expand before React Compiler runs. Consumers receive compiled
components without configuring either transform themselves. The shared
`build/react.ts` configuration also compiles source in Storybook development;
production Storybook consumes the already compiled package.

## Consumer setup

Consumers use React, React DOM, Lingui, and Tailwind. Add `@trizum/ui` as a
workspace dependency and build it before building or checking the consumer.

Import the shared stylesheet once in your Tailwind entry point:

```css
@import "@trizum/ui/styles.css";
```

It includes Tailwind and its reset, Inter and Fira Code fonts, accent and semantic
colors, React Aria and animation plugins, safe-area utilities, shared animations,
and reduced-motion rules. It registers the package's source for Tailwind scanning.
Consumers add their own source paths when Tailwind cannot discover them automatically.
Do not also import a second Tailwind reset or duplicate these font imports.

The app owns document layout. Give `html`, `body`, and your root mount element
full width and height; establish flex/scroll containers as each screen requires:

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
}
```

Set `lang` and `dir` on the document. Apply `.dark` to `html` for the existing dark
variant. `setThemeHue` from `@trizum/ui/theme` changes the accent variables and
updates an existing `meta[name="theme-color"]`. The default hue is 250. Consumers
own saved theme preferences and when to apply them. Importing the package does
not initialize preferences or change the theme.

### Icons

Each target generates its own sprite from its source plus the design-system
source. Use the shared Node-only configuration helper in the target's
`iconSprite.config.mjs`:

```js
import { createUIIconSpriteConfig } from "@trizum/ui/icons";
export default createUIIconSpriteConfig(["src"]);
```

Run `@trizum/icon-sprite`'s CLI against that config before typechecking/building,
and install its `createIconSpritePlugin` in Vite for regeneration during development.
The helper supplies Lucide, brand, and illustration sources and includes the UI
package's source in `usageRoots`. Add shared icons to the package catalog so `Icon` types and consumer sprites
remain aligned.
Only used icon symbols are emitted. Keep icon names as string literals so the
scanner can discover them; a dynamically constructed name needs explicit literal
usage elsewhere in the target.

Pass the generated SVG URL to `UIProvider`:

```tsx
import { UIProvider } from "@trizum/ui/UIProvider";
import spriteHref from "./generated/iconSprite.svg?url";

<UIProvider locale={locale} spriteHref={spriteHref}>
  {children}
</UIProvider>;
```

`Icon` retains its `icon` prop and catalog-wide typed names. `UIProvider` is
required for components that render icons; it also sets React Aria's locale.
Storybook uses the same generator and provider, independently of the PWA.

### Sheets and navigation

`ModalSheet` registers open sheets through the optional
`UIProvider.modalSheetNavigation` adapter. The app owns browser/native Back
handling; the design system owns registration and calls `onOpenChange(false)`
when dismissal is accepted. The adapter invokes a registered dismiss callback
to request closure. A `true` result means the sheet accepted closing. A `false`
result means the sheet is locked, so the adapter should consume Back without
navigating or closing a sheet underneath it.

Registration follows sheet open/close and unmount, uses the latest callback,
and orders nested sheets from parent to child. Consumers without a navigation
adapter, including Storybook, keep the normal controlled sheet API.

### Localization

The package owns built-in messages such as gallery navigation and avatar alt text.
Apps own supplied labels, children, descriptions, and business messages. Package
messages use stable `ui.*` IDs and English/Spanish Lingui catalogs. New built-in
copy follows this pattern, using context-bound `useLingui` macros rather than a
global i18n singleton. Use complete messages with named interpolation parameters.

Extract package source into its own catalogs; do not include UI source in the app's
Lingui extraction. Compile the catalogs with the package, then merge them into the
app's existing instance:

```tsx
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { messages as uiEn } from "@trizum/ui/locales/en";
import { messages as uiEs } from "@trizum/ui/locales/es";

// appEn and appEs are the app's own compiled message maps.
i18n.load("en", { ...uiEn, ...appEn });
i18n.load("es", { ...uiEs, ...appEs });
i18n.activate(locale);

<I18nProvider i18n={i18n}>
  <UIProvider locale={locale} spriteHref={spriteHref}>
    {children}
  </UIProvider>
</I18nProvider>;
```

Keep `UIProvider.locale` synchronized with Lingui's active locale. Resolve regional
locales to a supported catalog when loading messages, while retaining the desired
formatting locale for React Aria. English is the compile-time fallback for missing
package translations. Apps may override specific `ui.*` IDs when merging catalogs;
component props such as `Avatar.alt` override defaults for individual instances.
React Aria continues to own its own built-in translations.

## Development and validation

From the workspace root:

```sh
vp run --filter @trizum/ui build
vp run --filter @trizum/ui check
vp run --filter @trizum/ui test
vp run --filter @trizum/ui storybook:dev
vp run --filter @trizum/ui storybook:build
vp run lingui:extract
```

Storybook runs locally on port 6006. Its toolbar changes locale, light/dark mode,
and accent hue. Production stories consume the built package; local development uses source
components with hot reload. CI builds Storybook, including story typechecking;
there is no hosted deployment or automated visual/interaction suite yet.

`codegen` generates `src/generated/` icon/theme assets and compiled
`src/locales/*/messages.ts`. Never edit these outputs. Commit the `.po` catalogs;
follow the existing [translation conventions](../pwa/locale/AGENTS.md) when editing
them. Routine tasks declare their generation prerequisites in `vite.config.ts`.
