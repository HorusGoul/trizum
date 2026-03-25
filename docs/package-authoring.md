# Package Authoring

Use this guide when adding a new workspace package or refreshing the package
template.

## Start Point

Start from the workspace template:

```bash
pnpm generate:ts-template
```

That gives new packages the default `package.json`, README, ESLint config,
TypeScript config, logging facade, and Vitest setup that the repo expects.

## Default Shape

New library-style packages should default to:

- built-package exports from `dist`
- `type: "module"` with `moduleResolution: "nodenext"`
- `sideEffects: false` unless the package truly has import-time side effects
- `files` including `dist` and `src`
- package-local `README.md`, `eslint.config.js`, `tsconfig.json`, and
  `tsconfig.test.json`

Prefer the `ts-template` package as the canonical example for this shape.

## TypeScript Layout

Use two TypeScript configs:

- `tsconfig.json` for the emitted build project
- `tsconfig.test.json` for the test-inclusive no-emit project

The standard pattern is:

- `tsconfig.json` is `composite`, emits declarations, excludes `src/**/*.test.ts`,
  and is built with `tsc -b tsconfig.json`
- `tsconfig.test.json` is also `composite`, includes tests, sets `noEmit: true`,
  and references `./tsconfig.json`

This keeps package output focused on runtime files while still linting and
typechecking test files.

## Imports And Exports

For internal relative imports in TypeScript source, use `.js` specifiers such
as `./log.js`, not `.ts`. This matches the repo's `nodenext` built-package
pattern and keeps emitted code runnable without a rewrite step.

Exports should normally point at `dist` artifacts:

- `types`: `./dist/*.d.ts`
- `import`: `./dist/*.js`
- `default`: `./dist/*.js`

Only deviate from the built-package pattern intentionally.

## Scripts

New packages should usually provide:

- `pnpm build` using `tsc -b tsconfig.json`
- `pnpm dev` using `tsc -b tsconfig.json --watch`
- `pnpm test` using `vitest run`
- `pnpm lint` using `eslint --ext .ts src`
- `pnpm typecheck` using `tsc -b tsconfig.test.json`

If a package has runtime-specific commands beyond this baseline, keep the
standard scripts and add the extra ones alongside them.

## Tests

Keep tests next to the source as `src/**/*.test.ts`.

When using typed ESLint with `projectService`, add a test-file override in the
package ESLint config so test files point at `tsconfig.test.json`. This lets
tests participate in typed linting even though the build config excludes them.

## Logging

If a package logs, give it a package-local `src/log.ts` facade that wraps
`@trizum/logging`.

Libraries should:

- create scoped loggers with `getTrizumLogger()`
- expose package-local helpers like `getLogger()`
- avoid calling `configureTrizumLogging()` implicitly on import

Applications and runtime entrypoints own LogTape configuration.

## Docs And Validation

Every new package should update or provide:

- `README.md` with package purpose, key files, and validation commands
- `package.json` with the exact runnable scripts

Before opening a PR for a new package, run:

- the package-local `build`, `test`, `lint`, and `typecheck` scripts
- the relevant root validation command if the package is already wired into the
  workspace graph
