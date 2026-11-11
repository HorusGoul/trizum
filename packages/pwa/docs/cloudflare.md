# Cloudflare setup and deployment

This document records how the PWA Worker Cloudflare resources are wired. The
source of truth for account, route, binding, public OAuth identifier, and
observability values is [`../wrangler.jsonc`](../wrangler.jsonc).

## Deployment

Cloudflare deployments are managed by GitHub Actions instead of Cloudflare's
connected repository builds.

- Production deploys run after a changeset release updates the PWA version or
  changelog on `main`.
- Pull requests get Cloudflare preview deployments from the `PWA Preview`
  workflow, which updates a PR comment with the latest preview URL.

Configure the [GitHub Actions secrets](#github-actions-secrets) before deploying.

## Outbound sync routing

Keep `global_fetch_strictly_public` enabled so outbound requests from
`trizum.app` to `server.trizum.app` follow public routing. Without this flag,
Cloudflare uses a different origin route for requests within the Worker's own
zone. See [Cloudflare's compatibility flag documentation](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public).

Verify sync-dependent routes on `trizum.app` after deployment. A personalized
party preview succeeding on the Worker's `workers.dev` hostname does not prove
that the production custom domain can reach sync. Local workerd does not
reproduce Cloudflare's same-zone routing behavior either.

## Analytics proxy

The `SPYCAT` service binding targets the existing InsightFlare Worker in this
account; its name is configured in `wrangler.jsonc`. Keep bootstrap and collection
on this binding so IP-bound tokens and visitor metadata remain consistent.
Local development does not contact it unless a local service is supplied;
analytics remains disabled by default. Verify the binding through a deployed
preview when testing the integration. See [`api/routes/spycat.ts`](../api/routes/spycat.ts).

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
restricted to `customer_information:subscriptions:read`,
`customer_information:purchases:read`, and
`customer_information:customers:read_write`. The Worker uses it to verify
Premium and request customer deletion before deleting a cloud account. Grant
the customer permission before deploying this change: missing configuration or
permissions block account deletion so the identity remains available for retry.
See [account deletion](./account-deletion.md) for retry behavior and data scope.
The key must never be exposed through `VITE_` variables or committed to the repo.

Google and Apple setup details live in [`oauth.md`](./oauth.md).

### Party Boost sandbox account

`PARTY_BOOST_SANDBOX_USER_ID` optionally identifies one test account by its
immutable Better Auth user ID (also its RevenueCat App User ID). That account
may activate Party Boost with an active, directly owned sandbox Premium
entitlement. Production purchases are checked first; all other accounts still
require production purchases. This value is Worker-only configuration, never a
client-supplied parameter or an email match.

The same rule applies when rechecking a boost's owner on another member's
request. Membership, transfer cooldown, expiry, and revocation rules still
apply. Sandbox boosts use the normal database and benefit the party's members;
use disposable test parties for the audit. Removing this setting and deploying
disables the exception; existing sandbox-only boosts are revoked on their next
server verification. No migration or native rebuild is needed.

### GitHub Actions secrets

Configure these repository or environment secrets:

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

### Sentry

[`api/sentryWorker.ts`](../api/sentryWorker.ts) configures LogTape for the Worker. The Cloudflare Sentry Vite plugin wraps the
Hono app using options from [`api/instrument.server.ts`](../api/instrument.server.ts) with
[`@sentry/cloudflare`](https://docs.sentry.io/platforms/javascript/guides/cloudflare/).
It captures unhandled Hono errors (excluding expected 3xx/4xx HTTP exceptions),
request traces, and outbound fetch/D1 spans. The SDK flushes through `waitUntil`.
LogTape warnings go to Sentry Logs; errors also create issues. Info request
completion logs remain in Cloudflare. Shared document-ID redaction covers SDK
payloads and the LogTape sink. User identity, headers, bodies, and query
parameters are excluded from SDK data collection.

Production builds use the dedicated `trizum-worker` Sentry project with
`runtime:cloudflare-worker`. Local development disables delivery. Builds also
honor `VITE_APP_DISABLE_SENTRY=true`, keeping CI browser journeys out of Sentry. Worker bindings
configure `SENTRY_DSN` (a public DSN stored in `vars`) and `SENTRY_ENVIRONMENT`; `SENTRY_ENABLED=false` disables
delivery. Set the environment binding to `preview` for preview deployments that
should be distinguished from production. `CF_VERSION_METADATA` identifies the
Worker release. Builds inject debug IDs into both client and Worker output and
upload their source maps when `SENTRY_AUTH_TOKEN` is available.

After deployment, verify traces for `/api/health` in Sentry with the runtime tag.
Exercise a failing dependency on a disposable preview and verify its error issue
and structured log, with document IDs redacted. Local tests do not prove remote
ingestion or source-map upload.

The installed SDK requires `_experimental.autoInstrumentation` and
`_experimental.useDiagnosticsChannelInjection` to enable the Vite plugin
features. Both are enabled explicitly; the plugin is excluded from tests.
`SENTRY_AUTH_TOKEN` remains a CI secret and is never deployed to the Worker.

PR preview deployments set `SENTRY_ENVIRONMENT=preview` and upload source maps
using the CI token. `POST /api/observability-check` emits a warning and throws a
fixed test error in that environment, exercising Hono error capture without
accessing user data or external services. It returns 404 in other environments.
