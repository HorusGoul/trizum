# trizum server

This package contains the sync server for `trizum`. Read the repo
[AGENTS guide](../../AGENTS.md) first, then use this document when the task
touches server runtime, database, or deployment concerns.

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
- Server deployment assumptions should live near this package instead of in the
  root guide.

## Validation

Run the package tasks and scripts defined in [`vite.config.ts`](./vite.config.ts)
and [`package.json`](./package.json):

- `vp run check`
- `vp run test`
- `vp run dev` or `vp run start` when validating runtime behavior

## Deployment

Production deploys are managed by the repo `Release` GitHub Actions workflow.
When Changesets publishes a non-prerelease `@trizum/server@...` GitHub release,
the workflow deploys the tagged server revision to Fly.io. Backend preview
environments are intentionally unsupported.

The workflow requires one GitHub repository or `server-production` environment
secret:

- `FLY_API_TOKEN`: a Fly app-scoped deploy token for the `trizum-server` app.
  Create it with `fly tokens create deploy --app trizum-server --name "GitHub Actions server production" --expiry <duration>`.

The Fly app also needs runtime secrets configured with `fly secrets set --app
trizum-server`:

- `BUCKET_NAME`
- `AWS_ENDPOINT_URL_S3`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SENTRY_DSN` when Sentry should be enabled in production

`DB_FILE_NAME`, `PORT`, and the persistent volume mount are configured in
[`fly.toml`](./fly.toml).

CI builds both the production image (including Litestream) and the Dockerfile's
`runtime-local` target. It checks migrations, `/health`, and native profiler
loading using `runtime-local`, without production secrets or replication.
Run the smoke-test image locally from the workspace root:

```sh
docker build --file packages/server/Dockerfile --target runtime-local --tag trizum-server-smoke .
docker run --rm --publish 127.0.0.1:3000:3000 --env DB_FILE_NAME=file:/tmp/trizum.db trizum-server-smoke
```

The dependency install layer copies `patches/` and automatically includes every
workspace manifest matching `packages/*/package.json`, mirroring the workspace glob.
The native Sentry profiler stays external to the bundle;
[`scripts/copy-profiler.ts`](./scripts/copy-profiler.ts) copies it and its
dependencies using pnpm's resolved versions, without hardcoded store paths.
