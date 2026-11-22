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

The automerge package rule sets `automerge: true` on eligible updates. Renovate
enables automerge for a grouped PR only when every update in it is eligible, and
writes `Automerge: Enabled.` in the PR body's Configuration section when it does.

Renovate does not merge these PRs itself. `automergeType` is `pr-comment`, so
once checks pass Renovate only posts a one-time note pointing to the workflow
below. The `pr` type would merge through the GitHub API or enable GitHub
auto-merge, both of which bypass the Mergify queue.

The [`Renovate Automerge`](../.github/workflows/renovate-automerge.yml) workflow
comments `@mergifyio queue` on same-repository `renovate/` PRs from
`renovate[bot]` whose Automerge field, read only from the Configuration section
Renovate appends after any release notes, is enabled:

- when the PR opens or reopens,
- after every push, because Mergify cancels a pending queue request when the
  branch changes (a lockfile refresh, a conflict rebase, or a contributor
  commit),
- and when Renovate rewrites the body so the Automerge line flips. If it flips
  to disabled, the workflow comments `@mergifyio dequeue` instead.

Mergify's `default` queue rule still decides when the PR enters the queue and
performs the merge using its CI gates, review requirements, and squash commit
settings. Add the `manual-merge` label to dequeue a PR and stop it from
auto-queueing; remove the label to queue it again.

The workflow runs on `pull_request_target`, so the copy on `main` runs and PR
code is never checked out. It comments with `BOT_GITHUB_TOKEN` because Mergify
only accepts queue commands from senders with write access.

`rebaseWhen` is `conflicted`, so Renovate only rebases a branch when it
conflicts with `main`. Mergify brings queued PRs up to date itself, so rebasing
on every `main` change would only restart CI and requeue the PR.

This keeps the behavior compatible with the lockfile repair workflow: Renovate
opens the branch, the `Renovate Lockfiles` workflow commits the
Vite+-generated `pnpm-lock.yaml`, and the resulting push re-queues the PR, which
enters the queue after the updated branch passes checks.
