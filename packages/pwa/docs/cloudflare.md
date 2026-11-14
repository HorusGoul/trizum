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

## AI invite browser fallback

`join.trizum.app` is a second custom domain on the same Worker, declared in
`wrangler.jsonc`. It serves the AI download/web handoff. Keep `trizum.app` as the
native-associated target: Safari can then launch an installed app from the
handoff's cross-domain link using existing entitlements and AASA configuration.

Production deployment must provision this custom domain and HTTPS before AI
invites are enabled. Preview version uploads do not provision custom domains;
their handoff stays on the preview host. Verify both domains after production
deployment, including the redirect, an already-installed iOS app, and web
continuation. No new database, link storage or native entitlement is involved.
The host and trusted-origin lists include `join.trizum.app` for the existing API
and analytics proxy. Human analytics keeps each origin's existing privacy gates;
only approved campaign labels travel back to the canonical web join flow.

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

## Receipt analysis bindings

`AI` runs receipt extraction with Cloudflare's
[`@cf/google/gemma-4-26b-a4b-it`](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)
vision model, high-detail image input, and strict JSON schema output. The extractor
reads Gemma's chat-completion response and rejects truncated or refused output.
The expense editor requests suggestions without item transcription; full receipt
extraction remains the endpoint default. Both paths verify their proposed fields
with Clef. See the [receipt API contract](./api.md#receipt-extraction).
Thinking is disabled for direct extraction within the request timeout, and
`store: false` disables optional output storage for distillation or evaluations.
`wrangler.jsonc` supplies the binding; no
client API key is needed. Local Workers AI inference uses Cloudflare resources
and requires a signed-in Wrangler account. Automated tests inject the provider
and never send real receipts to AI.

`IMAGES` prepares the analysis copy from private bytes through the
[Images binding](https://developers.cloudflare.com/images/optimization/binding/).
The Worker accepts an 8 MiB decoded upload, then supplies the same JPEG to Gemma
and Clef, capped at 3072 pixels per side and 4 MiB. One smaller encoding is allowed
if needed. The attachment in Automerge is unchanged. This uses transformations,
not hosted Images uploads or public image URLs. Image preparation happens only
after authorization and the existing rate limit. Missing or failed bindings keep
analysis silent through the existing sanitized error path.

`AI` also runs [`@cf/cloudflare/clef`](https://developers.cloudflare.com/workers-ai/models/clef/)
to verify extracted values against the prepared photo. Clef has an eight-second
timeout after the 45-second extraction pass. See the [receipt API contract](./api.md#receipt-extraction)
for per-field filtering and currency evidence rules. Native local Images tests
exercise the codec offline with synthetic images; model calls remain injected.

CI disables remote binding connections for local Vite development and preview
servers, so browser and visual tests can boot without Cloudflare credentials.
This local-server option does not remove AI from deployed PR previews or
production Workers.

`RECEIPT_RATE_LIMITER` allows ten analysis requests per signed-in account per
minute in each Cloudflare location. This is an approximate abuse limit, not a
global billing quota; see [Cloudflare's rate limiting semantics](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
Missing bindings, entitlement verification failures, malformed model output, or
inference timeouts fail closed. Gemma extraction has a 45-second timeout. Receipt
responses use `Cache-Control: no-store`; image contents and provider errors are
not logged or stored by this endpoint. The original attachment still follows
the normal Automerge storage and sync path.

## D1

The PWA Worker uses Cloudflare D1 for Better Auth data and the cloud-sync party
list document pointer.

MCP party and expense tools do not access D1. Migration
`0008_drop_mcp_operations.sql` removes the retry table introduced by `0007`, which
remains in migration history. Deploy the direct-sync MCP implementation before
applying this removal to a shared environment: older Worker versions still use
the table. The migration drops only MCP operation records and their index; app
accounts, cloud-sync settings, and Automerge groups remain intact.

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

## MCP write controls

The `MCP_WRITE_LIMITER` binding allows 60 write-related attempts per minute per
source IP, hostname, and Cloudflare location. Each mutation attempt counts. Cloudflare's rate limiter is approximate and agents sharing an egress IP
share this allowance. Its namespace ID must remain unique to this limiter in the
account. Counters contain no group data and never enter analytics.

MCP has no write tokens, signing secret dependency, operation receipts, or
scheduled cleanup. Missing limiter configuration fails writes closed; read-only
MCP operations remain available. The empty cron list clears the former MCP
cleanup schedule on production deployment.

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
