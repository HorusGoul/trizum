# trizum server

This package contains the sync server for `trizum`. Read the repo
[AGENTS guide](../../AGENTS.md) first, then use this document when the task
touches server runtime, database, or deployment concerns.

## Canonical Sources

- [`package.json`](./package.json) is the source of truth for server scripts.
- [`src/main.ts`](./src/main.ts) is the runtime entry point.
- [`src/db.ts`](./src/db.ts) and [`src/db`](./src/db) cover database setup and
  data access.
- [`src/repo`](./src/repo) contains Automerge repo storage integration.
- [`drizzle`](./drizzle) contains schema and migration artifacts.

## Package Notes

- The server provides the WebSocket sync endpoint and health endpoint.
- Database workflows live behind the `db:*` scripts in
  [`package.json`](./package.json).
- Server deployment assumptions should live near this package instead of in the
  root guide.

## Validation

Run the package scripts defined in [`package.json`](./package.json):

- `pnpm lint`
- `pnpm typecheck`
- `pnpm dev` or `pnpm start` when validating runtime behavior
