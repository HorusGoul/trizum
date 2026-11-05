# trizum infrastructure

Alchemy manages independent `trizum-pwa` and `trizum-server` stacks. Run commands
from this directory through `vp run`. Dependencies pin Alchemy v2 beta so provider
updates receive an explicit review.

- `pwa.run.ts`: production Worker, assets, bindings, domain, and D1 migrations.
- `preview.run.ts`: aliased Worker versions sharing production bindings, as before.
- `server.run.ts`: existing Fly app and its pinned sync Machine and volume.
- `src/fly-server.ts`: provider for updating the existing Machine under a lease.
  Alchemy's native Machine provider does not expose volume auto-extension; this
  provider preserves the 75% threshold, 5 GB increment, and 200 GB limit. It
  refuses disk/region changes and never creates or deletes a Machine or volume.

The PWA stack consumes `../pwa/wrangler.jsonc` for public variables, compatibility
settings, and the database name. Wrangler remains available for Vite/workerd,
local D1 migration validation, and managing existing Worker secrets. The built
Worker is uploaded without rebundling, including sibling Wasm modules.

## First deployment and resource adoption

Build the PWA from the workspace root with `vp run --filter @trizum/pwa build`.
Export `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the existing account.
Scope the token to the existing account and `trizum.app` zone. Its account
permissions need Workers Scripts Edit, D1 Edit, Secrets Store Edit, and Account
Settings Read; zone permissions need Zone Read and Workers Routes Edit. The
API permission catalog calls the Edit permissions Write. These cover Worker
uploads, database migrations, domain routing, and Alchemy's remote state backend. Both stacks use the same account-pinned remote
state store; CI does not bootstrap it automatically.

From `packages/infra`, bootstrap and inspect the first production plan:

```sh
vp exec alchemy state bootstrap --config pwa.run.ts
vp run pwa:plan --adopt
```

Before applying, verify the plan preserves database UUID
`4eaaa4f5-e23a-4f06-9654-29b25aee9bb8`, Worker `trizum`, and domain `trizum.app`.
Back up D1 before its first Alchemy migration. Alchemy imports Wrangler's applied
migration history into `__alchemy_migrations`; subsequent remote migrations must
run through Alchemy. Local Wrangler checks still use a fresh local database.

```sh
vp run pwa:deploy --adopt
```

Existing Worker secrets are inherited explicitly by name, without reading their
values. Adoption and preview uploads fail if `BETTER_AUTH_SECRET` is absent.
Secrets set outside Alchemy remain managed
with Wrangler or the Cloudflare dashboard; never copy them into source or `VITE_`
variables. The InsightFlare Worker is an external service binding, not owned by
this stack.

For Fly, use `flyctl machine list --app trizum-server` and
`flyctl volumes list --app trizum-server` to find the existing Machine and its
attached `trizum_data` volume in `cdg`. Export their IDs as `FLY_MACHINE_ID` and
`FLY_VOLUME_ID`, plus `FLY_API_TOKEN`. Set `SERVER_IMAGE` to a pushed immutable
`registry.fly.io/trizum-server@sha256:...` image and `COMMIT_HASH` to its source
revision. Inspect and adopt:

```sh
vp run server:plan --adopt
vp run server:deploy --adopt
```

This updates the existing VM in place; expect its normal restart and WebSocket
reconnections. Runtime secrets, Litestream replication, existing IP addresses,
DNS, and certificates stay attached to the existing app. The deployment waits
for the new Machine instance and checks the public `/health` endpoint.

Set repository/environment variables `FLY_MACHINE_ID` and `FLY_VOLUME_ID` to
those same IDs. Both production environments require `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`; `server-production` also requires `FLY_API_TOKEN`.
The Fly token needs registry push, app read, Machine update/lease, and volume read.
Use the existing Sentry token for PWA builds. Bootstrap/adopt both production
stacks before enabling their CI deployments. Routine CI runs do not pass
`--adopt` and fail on unowned infrastructure.

## Releases and previews

Package releases still deploy independently. PWA deployment applies pending D1
migrations before uploading its Worker. The manual migrations workflow targets
only `Database`, preserving other resources and stack outputs. Server releases
build the existing Dockerfile, push to Fly's registry, and deploy its digest.

PR previews run `vp run pwa:preview --stage pr-123` with `PREVIEW_ALIAS=pr-123`.
They upload a version with zero production traffic and no migrations; URLs keep
the `pr-123-trizum.<account>.workers.dev` form. Production must be adopted first
so the preview can reference its database. Preview uploads share production data
and secrets, matching the previous workflow. They do not create Fly previews.

## Validation

From the workspace root, run `vp run check`, `vp run test`, and `vp run build`.
The infra package also provides `check`, `test`, and `build` tasks. Tests exercise
storage identity checks and persistence settings without contacting providers.
`pwa:plan` and `server:plan` require credentials and shared state; plans can
bootstrap state outside CI, so they are not offline validation commands.
