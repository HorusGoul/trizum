# Cloudflare Setup

This document records the Cloudflare resources used by the PWA Worker.

## Account

- Account name: Horus Lugo
- Account ID: `0386b05d89cdce85a2ff1f9439795ac2`
- Worker name: `trizum`
- Production domain: `https://trizum.app`

The account ID is checked into `wrangler.jsonc` so local commands, preview
deploys, and production deploys all target the same account.

## D1

The PWA Worker uses Cloudflare D1 for Better Auth data and cloud profile
settings.

- Binding: `DB`
- Database name: `trizum`
- Database ID: `4eaaa4f5-e23a-4f06-9654-29b25aee9bb8`
- Region: `WEUR`
- Migrations directory: `packages/pwa/migrations`

The database was created with:

```bash
CLOUDFLARE_ACCOUNT_ID=0386b05d89cdce85a2ff1f9439795ac2 vp exec wrangler d1 create trizum
```

Run local migration validation with:

```bash
vp exec wrangler d1 migrations apply DB --local
```

Apply migrations to the remote production database with:

```bash
CLOUDFLARE_ACCOUNT_ID=0386b05d89cdce85a2ff1f9439795ac2 vp exec wrangler d1 migrations apply DB --remote
```

CI validates migrations against local D1. Production releases apply remote D1
migrations before deploying the Worker.

## Email

The Worker uses the Cloudflare Send Email binding named `EMAIL`.

Auth email defaults to:

```text
trizum <noreply@trizum.app>
```

Change `AUTH_EMAIL_FROM` in `wrangler.jsonc` if the sending address changes.

## Secrets

Set Worker secrets with Wrangler from `packages/pwa`:

```bash
openssl rand -base64 32 | vp exec wrangler secret put BETTER_AUTH_SECRET
vp exec wrangler secret put GOOGLE_CLIENT_SECRET
vp exec wrangler secret put APPLE_TEAM_ID
vp exec wrangler secret put APPLE_KEY_ID
vp exec wrangler secret put APPLE_PRIVATE_KEY
```

Public OAuth identifiers live in
`packages/pwa/src/lib/authConfig.ts`. This includes the Google web client ID,
Google iOS client ID, both Android client IDs, Apple Services ID, and Apple app
bundle identifier. The same public IDs are mirrored in `wrangler.jsonc` vars so
the Worker deploy configuration is self-contained.

If older `GOOGLE_CLIENT_ID` or `APPLE_CLIENT_ID` secrets exist in Cloudflare,
they can be deleted. Those values are public OAuth identifiers now tracked in
code and `wrangler.jsonc`, not secret runtime configuration.

Google and Apple setup details live in [`oauth.md`](./oauth.md).

GitHub Actions still need these repository or environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SENTRY_AUTH_TOKEN` for production sourcemap upload

## Observability

Worker Logs and Traces are enabled in `wrangler.jsonc`. The Worker also routes
request, auth, and cloud-sync logs through Logtape so local development and
Cloudflare logs use the same logging categories.
