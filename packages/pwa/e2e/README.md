# PWA E2E Harness

This directory holds Playwright browser journeys for the PWA. Use the package
[README](../README.md) first, then use this document for deterministic browser
setup and reusable journey state.

## Canonical Sources

- [`harness/trizum.fixture.ts`](./harness/trizum.fixture.ts) is the shared
  journey fixture for offline boot, seeded state, and browser isolation.
- [`harness/scenarios.ts`](./harness/scenarios.ts) is the source of truth for
  deterministic seeded parties used across journeys.
- [The browser harness API](../src/lib/testing/browserHarnessApi.ts) defines the
  hook signatures shared by the application and browser tests.
- [`harness.spec.ts`](./harness.spec.ts) demonstrates the supported fresh,
  persisted, join, and imbalanced harness states.

## State Strategy

- Start new browser journeys from [`harness/trizum.fixture.ts`](./harness/trizum.fixture.ts)
  instead of importing `@playwright/test` directly.
- The fixture always boots the app with `__internal_offline_only=true` and
  blocks service workers and Sentry network requests. Each Playwright test gets
  a fresh browser context, so local storage, IndexedDB, and party-list state do
  not leak across runs.
- Seed state directly only when it is a precondition, not the behavior being
  tested. Use seeded setup for existing party docs, last-opened party behavior,
  and imbalanced balances.
- Prefer completing membership selection through the real `/join` and `/who`
  UI, even after seeding the underlying party doc. Reserve direct `partyList`
  writes for user-local settings such as `openLastPartyOnLaunch` when that
  setting is the only missing precondition.
- Drive the UI when the journey itself owns the state transition. Party
  creation, invite-code entry, and identity selection should stay visible in
  the test when that flow is the point of the journey.
- Join-flow fixtures should not wait on live sync. Seed the party document
  locally, then drive the `/join` and `/party/$partyId/who` UI on top of that
  local copy.

`harness.setPartyBoost(...)` seeds a server-observed boost snapshot directly in
Automerge for shared-state UI tests. Playwright's local build enables
`VITE_E2E_HARNESS=true` to include this fixture module; normal builds omit it and
expose no boost setter. When using `PLAYWRIGHT_BASE_URL`, serve an E2E build for
these fixture-based tests. Importing an expense file does not copy boosts.

## Helper Boundaries

- Fixture methods own browser boot, seeded Automerge docs, and direct
  `partyList` state writes.
- [`harness.joinSeededParty(...)`](./harness/trizum.fixture.ts) is the default
  shortcut for "already joined party" setup because it seeds the party doc
  directly and then completes membership selection through the real join UI.
- Page objects should stay focused on visible interaction and assertions.
- Avoid hiding a journey's core user actions inside the fixture. If a step is
  what the ticket is validating, keep that interaction in the spec or page
  object even when seeded helpers are available.
- When a journey only needs "an already joined party", prefer
  `harness.joinSeededParty(...)` over recreating the join flow in every test.

## Validation

CI runs the full Chromium and WebKit suite across four shards, with one worker
per shard, alongside the check/build/unit-test jobs. To run a shard locally,
use `vp run --filter @trizum/pwa test:e2e --shard=1/4` (replace `1` with
`2`, `3`, or `4` for the other shards).

Each CI shard uploads a blob report, including retry traces and failure
screenshots. The `E2E` job merges these into the `playwright-report` artifact
on successful and failed runs and requires every shard to pass. Reports are
retained for seven days.

`pwa-offline.spec.ts` explicitly allows real service workers in Chromium to
verify activation, cached offline reload, and deep navigation with a synthetic
party. Other journeys keep service workers blocked for independent contexts.

- `vp run --filter @trizum/pwa test:e2e:install` installs the local browser set.
- `vp run --filter @trizum/pwa test:e2e:install:ci` provisions a bare Linux host
  with system dependencies, WebKit, and the smaller Chromium headless shell.
  CI uses the preinstalled container browsers instead.
- `vp run --filter @trizum/pwa test:e2e e2e/harness.spec.ts`
- `vp run --filter @trizum/pwa test:e2e e2e/smoke.spec.ts`

### CI build/setup path

Each shard runs in the version-pinned official Playwright Noble container on
an `ubuntu-24.04` host. The image includes browsers and their system dependencies,
so shards do not run apt or download browsers. The setup-vp action still installs
the repository's Node version and workspace packages; its package cache is
independent of the browsers bundled in the image.

The image tag in the [CI workflow](../../../.github/workflows/ci.yml) must match
both Playwright catalog entries in `pnpm-workspace.yaml`. Renovate groups these
updates, and CI checks the installed package against the image's version before
building. See Playwright's [image version guidance](https://playwright.dev/docs/docker#image-tags).

Each shard builds the E2E app, then runs `test:e2e:prebuilt` against that build.
The usual `test:e2e` command builds automatically; to reuse a harness build:

```sh
VITE_E2E_HARNESS=true VITE_APP_DISABLE_SENTRY=true vp run --filter @trizum/pwa build
PLAYWRIGHT_PORT=4188 vp run --filter @trizum/pwa test:e2e:prebuilt e2e/smoke.spec.ts --workers=1
```

`PLAYWRIGHT_PORT` overrides the preview port (default 4173). Pass Playwright
flags directly, without a literal `--` separator. See the
[CI workflow](../../../.github/workflows/ci.yml) and
[Playwright config](../playwright.config.ts) for implementation details.

## Visual parity against main

The separate `test:visual` suite compares ten screens in English and Spanish,
using mobile and desktop viewports in Chromium and WebKit (80 comparisons).
It checks home, party creation, user settings, expenses, balances, party settings,
expense details, the expense form, the payment screen, and the party actions sheet.
The payment fixture includes legacy Bizum details and configured receiving methods;
user settings includes a Bizum row so inline editing is visible in the report.
Spanish uses a second accent hue. Both versions use the same fixture data, clock, fonts,
viewport, locale, and signed-out account response. Both images must stabilize
before comparison, using identical capture settings. CSS transitions are disabled
before opening menus so popover positioning measures the settled trigger. No
product content is masked.

Build an isolated checkout of the desired `origin/main` SHA with
`VITE_E2E_HARNESS=true VITE_APP_DISABLE_SENTRY=true`, then run from this workspace:

```sh
PLAYWRIGHT_REFERENCE_DIR=/absolute/path/to/reference-checkout \
PLAYWRIGHT_REFERENCE_URL=http://127.0.0.1:4174 \
VISUAL_REFERENCE_SHA=<reference-sha> VISUAL_CANDIDATE_SHA=<candidate-sha> \
vp run --filter @trizum/pwa test:visual
```

The command starts previews for both builds; it builds the candidate automatically.
`PLAYWRIGHT_SKIP_BUILD=true` reuses an existing candidate E2E build. An already
running reference deployment can be supplied with `PLAYWRIGHT_REFERENCE_URL` alone,
provided it exposes the E2E harness. Both URLs must use different origins so their
local state is isolated. Keep the reference read-only apart from seeded browser
storage. The reference checkout needs its own `vp install` and dependency builds.

`visual-report/comparison.html` is a standalone before/after report with a screen
selector. `visual-report/index.html` is the detailed Playwright report with failure
diffs and traces. `summary.json` records exact refs and outcomes. The CI workflow
builds current main and uploads `visual-comparison-<attempt>` (reports, traces,
and PNGs) and `visual-pr-report-<attempt>` (data for the PR comment) on success
or failure. Artifacts expire after seven days.

Expected PNGs are captured from the reference during the same run, rather than
committing platform-specific snapshots. The suite is intentionally separate from
normal E2E tests and checks visual parity for refactors: intended design changes
will produce failing comparisons for review. Do not use snapshot update flags to
approve differences in this suite; they must be reviewed against main.

### Reviewing failures in a PR

[Publish Visual Regression Report](../../../.github/workflows/visual-regression-report.yml)
updates one identifiable `github-actions[bot]` comment after each PR run. Only
failed comparisons appear, each in a collapsible section labeled with browser,
viewport, locale, and screen/test. A Markdown table shows the baseline before and
PR after images; a pixel diff appears below when captured. Missing screenshots
are labeled explicitly. The run and downloadable full report are linked. Passing,
cancelled, incomplete, and publication-error runs replace old failure images with
their current status. Outdated heads and older attempts cannot overwrite a newer
report. The report does not approve changes or alter the visual check result.

The publisher runs trusted code from the default branch through `workflow_run`,
without installing dependencies, restoring caches, or executing PR code. It
validates the data-only artifact, restricts image filenames, rejects symlinks and
non-PNGs, and bounds report/image sizes. PR association and current head/attempt
come from GitHub APIs, including for forks with an empty run-to-PR association.
Fork test runs retain read-only permissions and still follow GitHub's contributor
workflow-approval policy. Only the publisher has `actions: read`, `contents: write`,
and `pull-requests: write`. It uses the automatic token; no PAT or new secret is
needed.

Failed PNGs are stored by content hash on the separate
`visual-regression-reports` branch, never on `main` or a PR branch. Comments use
immutable commit-pinned `raw.githubusercontent.com` URLs, with no artifact ZIP
URLs or expiring tokens as image sources. Before commenting, the publisher checks
each URL without authentication for `image/png` and exact bytes. These images
remain publicly readable after the seven-day full-report artifact expires.
Keep this branch/history to retain old comments' images; its deduplicated image
storage grows over time and has no automatic deletion policy. Only PNGs are
published publicly, not traces or HTML from an untrusted PR.

This publication method requires a public GitHub.com repository and repository
rules that permit the automatic token to create/update the report branch and
write PR comments. If publication is denied, the publisher fails visibly and
attempts to replace the old comment with a publication-error notice and run link.
Private repositories need a different public image host; this publisher refuses
to claim private raw URLs will render. The trusted workflow becomes active only
after it lands on the default branch, so its own introduction PR needs a manually
prepared example. Older PR branches also need to incorporate the new reporter
from `main` before they can produce the data artifact. It never publishes from
a PR's untrusted workflow code.
