# Renovate

This repo uses Vite+ as the package-manager entry point. Renovate must refresh
`pnpm-lock.yaml` through Vite+ so lockfile updates go through the same toolchain
as local development and CI.

## Vite+ Lockfile Updates

Renovate's native npm artifact updates are disabled because they do not refresh
`pnpm-lock.yaml` through Vite+. Renovate still creates the initial dependency
branch, and the
[`Renovate Lockfiles`](../.github/workflows/renovate-lockfile.yml) workflow
regenerates the lockfile on every `renovate/**` branch push.

The workflow:

- queues runs instead of canceling in progress so a newer Renovate branch push
  does not stop an in-flight lockfile refresh while it may be about to commit,
- skips commits authored by `259750894+PUNK-02@users.noreply.github.com`,
- disables setup-vp's automatic install because Renovate's initial lockfile can
  be out of sync with the updated manifests,
- runs:

```sh
vp install --lockfile-only --no-frozen-lockfile --ignore-scripts
```

- and pushes `pnpm-lock.yaml` back to the same Renovate branch when it changes.

The workflow uses `BOT_GITHUB_TOKEN` through `actions/checkout` for the
follow-up push.

`renovate.json` lists `259750894+PUNK-02@users.noreply.github.com` in
`gitIgnoredAuthors` so Renovate keeps managing branches after the workflow adds
its lockfile commit.

## Agent Review

The
[`Renovate Agent Review`](../.github/workflows/renovate-agent-review.yml)
workflow runs after the `CI` workflow succeeds on a `renovate/**` branch. It
finds the open non-draft Renovate PR for that branch and runs:

```sh
vp run --filter @trizum/agent-workflows renovate-pr-review -- \
  --pr "$PR_NUMBER" \
  --repo "$GITHUB_REPOSITORY" \
  --write \
  --comment \
  --codex required
```

The workflow uses `BOT_GITHUB_SECRET` for checkout and GitHub CLI write actions,
configures commits as `lilith[bot]`, restores Codex account auth from Bitwarden
Secrets Manager, invokes Codex through Sandcastle, and writes the refreshed
Codex auth cache back to Bitwarden after the run.

Required GitHub configuration:

- `BW_ACCESS_TOKEN`, a secret containing a Bitwarden Secrets Manager
  machine-account access token with read/write access to the Codex auth secret
- `BITWARDEN_CODEX_AUTH_JSON_SECRET_ID`, a variable containing the Bitwarden
  secret ID for the compact `~/.codex/auth.json` value

To seed or refresh that Bitwarden value, sign in locally with file-based Codex
credential storage, then run:

```sh
export BWS_ACCESS_TOKEN="..."
export BITWARDEN_PROJECT_ID="..."

# First-time creation.
bws secret create trizum-codex-auth-json \
  "$(jq -c . ~/.codex/auth.json)" \
  "$BITWARDEN_PROJECT_ID"

# Later refreshes.
export BITWARDEN_CODEX_AUTH_JSON_SECRET_ID="..."
bws secret edit "$BITWARDEN_CODEX_AUTH_JSON_SECRET_ID" \
  --value "$(jq -c . ~/.codex/auth.json)"
```
