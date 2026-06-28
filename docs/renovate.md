# Renovate

This repo uses Vite+ as the package-manager entry point. Renovate must refresh
`pnpm-lock.yaml` through Vite+ so lockfile updates go through the same toolchain
as local development and CI.

## Vite+ Lockfile Updates

The repository config runs this post-upgrade command for JavaScript dependency
updates:

```sh
node scripts/renovate-vp-lockfile.mjs
```

That script checks whether `vp` is available. If it is missing, it installs the
Vite+ CLI with the official macOS/Linux or Windows installer, refreshes the
current process `PATH`, and then runs:

```sh
vp install --lockfile-only
```

## Runner Global Config

Renovate's `allowedCommands` option is global-only, so it cannot live in this
repo's `renovate.json`. Configure the Renovate runner with this allowlist:

```json
{
  "allowedCommands": ["^node scripts/renovate-vp-lockfile\\.mjs$"]
}
```

Without that global setting, Renovate will update package files but skip the
post-upgrade task that regenerates `pnpm-lock.yaml` through Vite+.
