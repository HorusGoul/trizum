# @trizum/react-suspense-cache

React 19 compatible suspense cache utilities for trizum.

This package replaces the external `suspense` dependency for cache-backed
Suspense reads without relying on React or React DOM experimental builds. It
keeps the `createCache`, `Cache`, and status constant API surface used by the
PWA, and adds React 19 hooks for consuming cache state through `use`,
`useSyncExternalStore`, and `useDeferredValue`.

## Key Files

- [`src/createCache.ts`](./src/createCache.ts) implements the Suspense cache.
- [`src/hooks.ts`](./src/hooks.ts) contains React cache-consumption hooks.
- [`src/types.ts`](./src/types.ts) defines the compatibility types.
- [`vite.config.ts`](./vite.config.ts) defines package-local Vite+ tasks.

## Tasks

- `vp run dev`. Starts the compiler in watch mode.
- `vp run check`. Runs the package validation script.
- `vp run test`. Runs the package unit tests.
- `vp run build`. Builds the package.
