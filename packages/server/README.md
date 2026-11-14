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

## Sentry metrics

Production enables Sentry metrics when `SENTRY_DSN` is configured. Metrics are
independent of log severity and trace sampling; successful operations are measured
as well as failures. In Sentry Metrics, filter `sentry.environment:production`
and select `trizum-server`.

| Metric                                | Type / unit                | Attributes / meaning                                                                                                 |
| ------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `server.storage.operations`           | Counter                    | `operation`, `chunkType`, `outcome` (`success` or `error`); completed operations, including missing-key reads        |
| `server.storage.operation.duration`   | Distribution / millisecond | Same attributes; all completed operations, including errors                                                          |
| `server.storage.operation.bytes`      | Distribution / byte        | `operation`, `chunkType`; successful reads/writes, summed across range reads; removals and missing reads report zero |
| `server.storage.operations.pending`   | Counter                    | `operation`, `chunkType`; one observation when an operation remains pending for five seconds, not an in-flight gauge |
| `server.sync.connections.opened`      | Counter                    | Accepted WebSocket connections                                                                                       |
| `server.sync.connections.closed`      | Counter                    | `closeCategory`: `normal` (1000), `going_away` (1001), or `abnormal` (all other codes)                               |
| `server.sync.connection.duration`     | Distribution / millisecond | `closeCategory`; recorded on close                                                                                   |
| `server.sync.connection.buffered`     | Distribution / byte        | Outgoing bytes still buffered on close                                                                               |
| `server.sync.socket.errors`           | Counter                    | Socket error events; one connection can emit more than one                                                           |
| `server.sync.messages.received`       | Counter                    | Incoming WebSocket messages, before Automerge decoding                                                               |
| `server.sync.message.size`            | Distribution / byte        | Incoming WebSocket message sizes                                                                                     |
| `server.automerge.operation.duration` | Distribution / millisecond | `operation`; Automerge document metrics that report duration                                                         |
| `server.sync.connections.active`      | Gauge                      | Current connections at startup, every 30 seconds, and on close                                                       |
| `server.memory.rss`                   | Gauge / byte               | Process RSS on the same schedule                                                                                     |
| `server.memory.heap_used`             | Gauge / byte               | Used JavaScript heap on the same schedule                                                                            |

For storage failure rate, divide the count with `outcome:error` by the total
completed count. Use duration distributions for p50/p95/p99 latency. The pending
counter also surfaces operations that never complete. Traffic and memory values
are process observations; the server currently supports one process. Connection
duration excludes connections still open, and these metrics do not measure
client reconnect frequency or end-to-end sync completion.

The metric transport integration allows only the bounded attributes above and
Sentry environment, release, and SDK metadata. Request scope attributes and user,
document, connection, and host identifiers are excluded. Payloads and close
reasons are never metric attributes. Existing warning/error logs retain their
separate diagnostic role.
