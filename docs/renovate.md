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
configures commits as `lilith[bot]`, and passes the `CODEX_ACCESS_TOKEN` secret
to the Codex CLI invoked through Sandcastle.
