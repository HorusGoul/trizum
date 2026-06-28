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
- skips commits authored by `renovate-lockfile@trizum.app`,
- runs:

```sh
vp install --lockfile-only --no-frozen-lockfile --ignore-scripts
```

- and pushes `pnpm-lock.yaml` back to the same Renovate branch when it changes.

The workflow uses the built-in `GITHUB_TOKEN` with job-scoped `contents: write`
permission for the follow-up push.

`renovate.json` lists `renovate-lockfile@trizum.app` in `gitIgnoredAuthors` so
Renovate keeps managing branches after the workflow adds its lockfile commit.
