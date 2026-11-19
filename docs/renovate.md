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

Renovate groups automergeable patch and minor dependency updates into one PR to
keep update volume manageable. TypeScript and current 0.x patch/minor updates
are grouped separately for manual review so they do not block automerge for
unrelated dependencies.

Vite+ toolchain updates have their own group so changes to Vite+, the aliased
Vite core package, Vitest, Vite/Vitest plugins, and adjacent toolchain packages
such as Rolldown, tsdown, Oxlint, Oxfmt, and Vite Task are reviewed together
instead of being buried in the broad non-major dependency group.

React Doctor dependencies are grouped together so the CLI and matching Oxlint
plugin stay in sync.

Playwright packages and the CI browser image share a group so their versions
stay aligned. The [E2E setup guide](../packages/pwa/e2e/README.md#ci-buildsetup-path)
describes the version check and container setup.

React runtime and type package updates are grouped together now that the app uses
stable React builds. Keep `react`, `react-dom`, and their type packages moving in
the same Renovate PR so runtime and TypeScript surfaces stay aligned.

`barcode-detector` updates are disabled because newer ZXing WASM releases have
regressed QR scanning on affected Android Chrome devices. Keep the catalog pin
and Renovate package rule in sync when this is revisited.

Most major updates stay independent, but tightly coupled dependency families
still have major grouping rules so packages that need to move together are
reviewed together.

## Automerge

`renovate.json` is the source of truth for automerge eligibility. Keep package,
version, and update-type matchers there instead of duplicating them in this
document.

Renovate labels every update `manual-merge` by default, and the automerge
package rule replaces that with `automerge` for eligible updates. Renovate
unions labels across grouped updates, so a group containing any ineligible
update keeps `manual-merge`. Renovate does not merge these PRs itself.

`merge_protections_settings.auto_merge_conditions` in
[`.mergify.yml`](../.mergify.yml) queues open `renovate[bot]` PRs from
same-repository `renovate/` branches that have `automerge` and not
`manual-merge`. Mergify performs the merge using the CI gates, review
requirements, and squash commit settings in its `default` queue rule. GitHub
platform-native automerge stays disabled.

Mergify re-evaluates these conditions on every change, so a push to the branch (a
lockfile refresh, a conflict rebase, or a contributor commit) re-queues the PR
once the new head passes checks. A one-time `@mergifyio queue` comment would be
cancelled by such a push and never re-posted. Add `manual-merge` or remove
`automerge` to stop a PR from auto-queueing.

`rebaseWhen` is `conflicted`, so Renovate only rebases a branch when it
conflicts with `main`. Mergify brings queued PRs up to date itself, so rebasing
on every `main` change would only restart CI and requeue the PR.

This keeps the behavior compatible with the lockfile repair workflow: Renovate
opens the branch, the `Renovate Lockfiles` workflow commits the
Vite+-generated `pnpm-lock.yaml`, and Mergify queues the PR after the updated
branch passes checks.
