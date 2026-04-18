# trizum icon sprite

Reusable SVG sprite generation and Vite integration for workspace apps.

Read the repo [AGENTS guide](../../AGENTS.md) first. This package exists to
collect SVG catalogs, statically discover icon usage, emit typed sprite IDs,
and keep generated sprite assets in sync during Vite development and builds.

## Canonical Sources

- [`package.json`](./package.json) is the source of truth for scripts and
  dependencies.
- [`src/index.ts`](./src/index.ts) exports the sprite config helpers and
  generation entrypoints.
- [`src/vite.ts`](./src/vite.ts) contains the generic Vite plugin.
- [`src/generate.test.ts`](./src/generate.test.ts) and
  [`src/vite.test.ts`](./src/vite.test.ts) cover catalog discovery, output
  generation, and plugin-triggered regeneration.

## Package Notes

- Source definitions are directory-based and can use helper factories or custom
  `idFromRelativePath()` logic.
- Generated outputs are written only when content changes so Vite reloads stay
  stable.
- Usage discovery is intentionally simple and based on string-literal scanning.

## Validation

Run the package scripts defined in [`package.json`](./package.json):

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
