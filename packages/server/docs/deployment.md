# Sync server deployment

[Back to package overview](../README.md). Read when changing Fly.io releases, runtime secrets, or container smoke tests.

## Deployment

The server uses Node.js 26 in development, CI, and both Docker build and
runtime stages. The root `.node-version` and `engines.node` declare workspace
support; keep the Docker image tag and Node type catalog aligned with them.
The container health assertions and native profiler check execute inside the
image so they exercise the deployed runtime.

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
[`fly.toml`](../fly.toml).

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
[`scripts/copy-profiler.ts`](../scripts/copy-profiler.ts) copies it and its
dependencies using pnpm's resolved versions, without hardcoded store paths.
