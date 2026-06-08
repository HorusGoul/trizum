# TypeScript Template

This is a package generated using the `ts-template` template of the trizum monorepo.

It's the best starting point for a new package, as it provides the following out of the box:

- `@trizum/tsconfig`
- Common Vite+ tasks for developing, building, testing, and checking.
- A built-package TypeScript setup with a separate test-inclusive `tsconfig.test.json`.

## Usage

To use this package from another package or app in the monorepo, you can install it using the following command:

```bash
vp add ts-template
```

## Development

If you want to work on this package, you can clone the monorepo and run the following commands:

```bash
vp install
cd packages/ts-template
vp run dev
```

## Tasks

The following Vite+ tasks are available:

- `vp run dev`. Starts the compiler in watch mode.
- `vp run check`. Runs the package validation script.
- `vp run test`. Runs the package unit tests.
- `vp run build`. Builds the package.
