# @trizum/data

Trizum's local-first data model for the Jazz alpha PoC.

This package owns Trizum-specific tables, row policies, Fate views, mutations,
and client roots. The reusable Jazz/Fate adapter code lives in `fate-jazz`, so
the model package can evolve independently from the PWA runtime.

The Jazz model surface currently covers users, parties, party memberships,
joined party list entries, participants, media files, and expenses. Expenses are
intended to use Jazz list pagination instead of carrying the PWA's Automerge
expense chunk optimization into the target model.

The default no-account path is a local-first Jazz user. Full accounts can opt in
later through JWT or cookie-backed Jazz auth without changing the Fate client API
that screens consume.

## Jazz Cloud setup

The browser client only needs public Jazz runtime values:

```sh
VITE_JAZZ_APP_ID=f3c88cf5-97c1-41fc-a6ba-ebb209719a61
VITE_JAZZ_SERVER_URL=https://v2.sync.jazz.tools/
```

The admin secret is server-only and must never use a `VITE_` prefix:

```sh
JAZZ_ADMIN_SECRET=...
```

Use separate Jazz apps for production and preview/staging so preview schemas and
test data do not share the production namespace. Each deployment environment
should set its own app ID and admin secret. The deploy wrapper accepts
`JAZZ_APP_ID` and `JAZZ_SERVER_URL` for server-side scripts, falling back to the
public Vite variables when those are not set.

Copy `.env.tpl` to `.env` for local Jazz operations. The checked-in defaults
point at the hosted Jazz Cloud sync server.

## Jazz operations

Run Jazz schema checks from this package:

```sh
vp run jazz:validate
vp run jazz:schema:hash
```

The current initial structural schema hash is `2261d303fb3a`, with its baseline
snapshot committed under `migrations/snapshots/`. This lets future schema
changes produce explicit migration files instead of treating the current model
as an unknown starting point.

When `schema.ts` changes, create and review a migration:

```sh
vp run jazz:migrations:create --name add-example-field
```

When a migration has been reviewed, publish it with the target environment's
admin secret:

```sh
JAZZ_ADMIN_SECRET=... vp run jazz:deploy
```

`jazz:deploy` publishes the current schema, any required migration edge, and the
current permissions bundle for the selected Jazz app. Permission-only changes
also need `jazz:deploy`, but they do not create a new structural schema hash.

To inspect the deployed permission state for an environment:

```sh
JAZZ_ADMIN_SECRET=... vp run jazz:permissions:status
```

For production CI, run the deploy task before deploying the PWA bundle, using
the production `JAZZ_APP_ID` or `VITE_JAZZ_APP_ID`. For preview CI, run the same
task against the preview Jazz app. If preview environments become truly
per-branch, provision one Jazz app per preview branch and set that branch's app
ID/admin secret in the deployment environment.

GitHub Actions expects `JAZZ_APP_ID` and `JAZZ_ADMIN_SECRET` secrets. Production
releases use a dedicated Jazz deploy job before starting either the PWA or mobile
release flow. Other deploy workflows publish Jazz before building the client
bundle they ship; manually dispatched store deploy workflows keep that behavior
enabled by default. The workflows pass `JAZZ_APP_ID` to Jazz deploy commands and
expose the same value as `VITE_JAZZ_APP_ID` only for client builds. The sync
server URL is public and is set to `https://v2.sync.jazz.tools/` in the
workflows.
