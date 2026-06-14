# Cloudflare Setup

This document records how the PWA Worker Cloudflare resources are wired. The
source of truth for account, route, binding, public OAuth identifier, and
observability values is [`../wrangler.jsonc`](../wrangler.jsonc).

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
apply remote D1 migrations before deploying the Worker.

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
```

Google and Apple setup details live in [`oauth.md`](./oauth.md).

GitHub Actions still need these repository or environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SENTRY_AUTH_TOKEN` for production sourcemap upload

## Observability

Worker Logs and Traces are configured in `wrangler.jsonc`. The Worker also
routes request, auth, and cloud-sync logs through Logtape so local development
and Cloudflare logs use the same logging categories.
