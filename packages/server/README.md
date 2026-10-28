# trizum server

This package contains the Automerge WebSocket sync server for `trizum`.

## Canonical Sources

- [`vite.config.ts`](./vite.config.ts) and [`package.json`](./package.json)
  are the source of truth for server tasks and scripts.
- [`src/main.ts`](./src/main.ts) is the runtime entry point.
- [`src/db.ts`](./src/db.ts) and [`src/db`](./src/db) cover database setup and
  data access.
- [`src/repo`](./src/repo) contains Automerge repo storage integration.
- [`drizzle`](./drizzle) contains schema and migration artifacts.

## Package Notes

- The server provides the WebSocket sync endpoint and health endpoint.
- Database workflows live behind the `db:*` scripts in
  [`package.json`](./package.json).

## Validation

Run the package tasks and scripts defined in [`vite.config.ts`](./vite.config.ts)
and [`package.json`](./package.json):

- `vp run check`
- `vp run test`
- `vp run dev` or `vp run start` when validating runtime behavior

## Deployment

See [the deployment guide](./docs/deployment.md) for Fly.io releases, runtime
secrets, and local container smoke tests.
