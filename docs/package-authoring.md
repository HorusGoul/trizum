# Package Authoring

Use this guide when adding a new workspace package or refreshing the package
template.

## Start Point

Start from the workspace template:

```bash
vp run generate:ts-template
```

That gives new packages the default `package.json`, README, TypeScript config,
logging facade, Vite+ lint script, and Vitest setup that the repo expects.

## Default Shape

New library-style packages should default to:

- built-package exports from `dist`
- `type: "module"` with `moduleResolution: "nodenext"`
- `sideEffects: false` unless the package truly has import-time side effects
- `files` including `dist` and `src`
- package-local `README.md`, `tsconfig.json`, and `tsconfig.test.json`

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

- `vp run build` using `tsc -b tsconfig.json`
- `vp run dev` using `tsc -b tsconfig.json --watch`
- `vp run test` using `vp test run`
- `vp run lint` using `vp lint src`
- `vp run typecheck` using `tsc -b tsconfig.test.json`

If a package has runtime-specific commands beyond this baseline, keep the
standard scripts and add the extra ones alongside them.

## Tests

Keep tests next to the source as `src/**/*.test.ts`.

Root `vp check` handles type-aware linting through the Vite+ `lint` block in
[`vite.config.ts`](../vite.config.ts). Keep package `tsconfig.test.json` files
for package-local typecheck scripts and Vitest coverage.

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

- the package-local `build`, `test`, `lint`, and `typecheck` scripts through
  `vp run <script>`
- `vp check`, `vp test`, and `vp build` if the package is already wired into
  the workspace graph
