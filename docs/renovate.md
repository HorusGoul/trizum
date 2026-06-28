# Renovate

This repo uses Vite+ as the package-manager entry point. Renovate must refresh
`pnpm-lock.yaml` through Vite+ so lockfile updates go through the same toolchain
as local development and CI.

## Vite+ Lockfile Updates

Renovate's built-in artifact update still creates the initial dependency branch.
After Renovate pushes a `renovate/**` branch that changes `pnpm-lock.yaml`, the
[`Fix Renovate Lockfile`](../.github/workflows/renovate-lockfile.yml) workflow
checks the associated pull request.

The workflow only proceeds when:

- the pushed branch matches `renovate/**`,
- an open pull request exists for that branch,
- the pull request author is Renovate, including the `app/renovate` GitHub App,
- and the pull request changes `pnpm-lock.yaml`.

When those checks pass, the workflow runs:

```sh
vp install --lockfile-only
```

If the Vite+ refresh changes `pnpm-lock.yaml`, the workflow commits and pushes a
follow-up commit to the same Renovate branch.
