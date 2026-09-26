# Cloudflare Setup

This document records how the PWA Worker Cloudflare resources are wired. The
source of truth for account, route, binding, public OAuth identifier, and
observability values is [`../wrangler.jsonc`](../wrangler.jsonc).

## Outbound sync routing

Keep `global_fetch_strictly_public` enabled so outbound requests from
`trizum.app` to `server.trizum.app` follow public routing. Without this flag,
Cloudflare uses a different origin route for requests within the Worker's own
zone. See [Cloudflare's compatibility flag documentation](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public).

Verify sync-dependent routes on `trizum.app` after deployment. A personalized
party preview succeeding on the Worker's `workers.dev` hostname does not prove
that the production custom domain can reach sync. Local workerd does not
reproduce Cloudflare's same-zone routing behavior either.

## D1

The PWA Worker uses Cloudflare D1 for Better Auth data and the cloud-sync party
list document pointer.

Create the database with Wrangler, then copy the generated database name and ID
into `wrangler.jsonc`:

```bash
vp exec wrangler d1 create <database-name>
```

Validate migrations locally with the package check task:

```bash
vp run check
```

Apply migrations to the remote database with:

```bash
vp exec wrangler d1 migrations apply DB --remote
```

CI validates migrations as part of `@trizum/pwa#check`. Production releases
apply remote D1 migrations before deploying the Worker. To apply migrations
without deploying, run the `PWA Production Migrations` GitHub Actions workflow
manually and enter the branch, tag, or commit SHA containing the migrations.

## Email

The Worker uses the Cloudflare Send Email binding configured in
`wrangler.jsonc`. Change `AUTH_EMAIL_FROM` there if the sending address changes.

## Secrets

Set Worker secrets with Wrangler from `packages/pwa`:

```bash
openssl rand -base64 32 | vp exec wrangler secret put BETTER_AUTH_SECRET
vp exec wrangler secret put GOOGLE_CLIENT_SECRET
vp exec wrangler secret put APPLE_TEAM_ID
vp exec wrangler secret put APPLE_KEY_ID
vp exec wrangler secret put APPLE_PRIVATE_KEY
vp exec wrangler secret put REVENUECAT_SECRET_API_KEY
```

`REVENUECAT_PROJECT_ID` is the non-secret RevenueCat project ID configured in
`wrangler.jsonc`. `REVENUECAT_SECRET_API_KEY` must be a RevenueCat v2 secret key
restricted to `customer_information:subscriptions:read` and
`customer_information:purchases:read`. They are used only by the Worker to
verify Premium and must never be exposed through `VITE_` variables or committed
to the repo.

Google and Apple setup details live in [`oauth.md`](./oauth.md).

GitHub Actions still need these repository or environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SENTRY_AUTH_TOKEN` for production sourcemap upload

## Observability

Worker Logs and Traces are configured in `wrangler.jsonc`. The Worker also
routes request, auth, and cloud-sync logs through Logtape so local development
and Cloudflare logs use the same logging categories.

`api/log.ts` explicitly selects JSON console output. Each event retains its
console severity and includes `@timestamp`, `level`, `logger`, `message`, and
`properties`. Error properties include their name, message, stack, and causes;
request correlation properties are preserved alongside Cloudflare's invocation
metadata. Browser logging keeps the default developer-console formatter.

To verify a preview deployment, request `/api/health` and inspect its
`Worker request completed` event in Workers Observability. Confirm that the
event contains one JSON message, `INFO` severity, the `trizum.pwa.api.worker`
category, and request method, redacted path, status, and duration properties.
There should be no formatter-generated `%c`/`%o`, CSS styles, or ANSI escapes.
Formatting does not itself redact sensitive values; see the
[logging policy](../../../docs/logging.md).
