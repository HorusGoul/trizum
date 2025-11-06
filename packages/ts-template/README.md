# TypeScript Template

This is a package generated using the `ts-template` template of the trizum monorepo.

It's the best starting point for a new package, as it provides the following out of the box:

- `@trizum/eslint-config`
- `@trizum/tsconfig`
- Common npm scripts for developing, building, testing, and linting.

## Usage

To use this package from another package or app in the monorepo, you can install it using the following command:

```bash
pnpm add ts-template
```

## Development

If you want to work on this package, you can clone the monorepo and run the following commands:

```bash
pnpm install
cd packages/ts-template
pnpm dev
```

## Scripts

The following scripts are available:

- `pnpm dev`. Starts the compiler in watch mode.
- `pnpm build`. Builds the package.
- `pnpm lint`. Lints the package with ESLint and Prettier.
- `pnpm lint:fix`. Runs ESLint and Prettier to fix any styling issues.
- `pnpm typecheck`. Runs the TypeScript type checker.
