# @trizum/tw-dynamic-themes

Workspace package for generating Tailwind CSS dynamic theme colors and updating
those colors at runtime.

## Key Files

- `src/css.ts` generates Tailwind v4 `@theme` variables.
- `src/cli.ts` exposes the `twdt` CLI used by the PWA build graph.
- `src/runtime.ts` updates runtime CSS variables when the app hue changes.
- `src/tailwind.ts` keeps the legacy Tailwind config helper available.

## Tailwind v4 Usage

Generate a default theme CSS file:

```bash
vp exec twdt accent 250 src/generated/tw-dynamic-themes.css
```

The generated file defines `--color-accent-*` variables for Tailwind v4 and
keeps them connected to runtime `--accent-*` variables with fallback values.
Apps can import that generated CSS from their Tailwind entrypoint, then update
the runtime variables:

```ts
import { getVariables, updateVariables } from "@trizum/tw-dynamic-themes/runtime";

const variables = getVariables({ baseName: "accent", hue: 250 });
updateVariables(variables);
```

## Validation

Run package tasks through Vite+:

- `vp run check`
- `vp run build`
- `vp run test`
