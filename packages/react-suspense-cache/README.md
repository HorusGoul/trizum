# @trizum/react-suspense-cache

React 19 compatible suspense cache utilities for trizum.

This package replaces the external `suspense` dependency for cache-backed
Suspense reads without relying on React or React DOM experimental builds. It
keeps the `createCache`, `Cache`, and status constant API surface used by the PWA.
Use `cache.read()` for synchronous cached reads and `use(cache.readAsync(...))`
when a React component should suspend.

## Key Files

- [`src/createCache.ts`](./src/createCache.ts) implements the Suspense cache.
- [`src/log.ts`](./src/log.ts) contains the package-local logging facade.
- [`src/cacheKeys.ts`](./src/cacheKeys.ts), [`src/cacheMap.ts`](./src/cacheMap.ts),
  and [`src/promise.ts`](./src/promise.ts) contain reusable cache utilities.
- [`src/types.ts`](./src/types.ts) defines the compatibility types.
- [`vite.config.ts`](./vite.config.ts) defines package-local Vite+ tasks.

## Tasks

- `vp run dev`. Starts the compiler in watch mode.
- `vp run check`. Runs the package validation script.
- `vp run test`. Runs the package unit tests.
- `vp run build`. Builds the package.
