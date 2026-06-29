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

Renovate groups patch and minor dependency updates into one PR to keep update
volume manageable. Most major updates stay independent, but tightly coupled
dependency families still have major grouping rules so packages that need to
move together are reviewed together. `react` and `react-dom` updates are
disabled because the app uses experimental builds that are managed manually.

## Automerge

`renovate.json` is the source of truth for automerge eligibility. Keep package,
version, and update-type matchers there instead of duplicating them in this
document.

The repo intentionally uses Renovate-managed PR automerge instead of
platform-native automerge because `main` is not protected with required status
checks. Renovate's platform-native automerge can merge immediately when the
platform has no required checks configured. With Renovate-managed automerge,
Renovate waits until it sees passing branch status checks before merging.

This also keeps the behavior compatible with the lockfile repair workflow:
Renovate opens the branch, the `Renovate Lockfiles` workflow commits the
Vite+-generated `pnpm-lock.yaml`, and Renovate can then merge the PR after the
updated branch passes checks.

## Agent Review

The
[`Renovate Agent Review`](../.github/workflows/renovate-agent-review.yml)
workflow runs after the `CI` workflow completes on a `renovate/**` branch. It
finds the open non-draft Renovate PR for that branch.

The workflow uses `BOT_GITHUB_TOKEN` for checkout and GitHub CLI write actions,
configures commits as `lilith[bot]`, restores Codex account auth from Bitwarden
Secrets Manager, invokes Codex through Sandcastle, and writes the refreshed
Codex auth cache back to Bitwarden after the run.

When checks pass and the agent finds no blockers, it adds the
`ready for human review` label. When checks fail, the agent can create a
replacement PR with the same dependency-update purpose.
