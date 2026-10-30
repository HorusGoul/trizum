# PWA E2E Harness

This directory holds Playwright browser journeys for the PWA. Use the package
[README](../README.md) first, then use this document for deterministic browser
setup and reusable journey state.

## Canonical Sources

- [`harness/trizum.fixture.ts`](./harness/trizum.fixture.ts) is the shared
  journey fixture for offline boot, seeded state, and browser isolation.
- [`harness/scenarios.ts`](./harness/scenarios.ts) is the source of truth for
  deterministic seeded parties used across journeys.
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
- `vp run --filter @trizum/pwa test:e2e:install:ci` installs the CI browser set
  with system dependencies and the smaller Chromium headless shell.
- `vp run --filter @trizum/pwa test:e2e e2e/harness.spec.ts`
- `vp run --filter @trizum/pwa test:e2e e2e/smoke.spec.ts`

### CI build/setup path

Each shard builds the E2E app while installing browsers, then runs
`test:e2e:prebuilt` against that build. Both preparation steps must succeed.
The usual `test:e2e` command builds automatically; to reuse a harness build:

```sh
VITE_E2E_HARNESS=true VITE_APP_DISABLE_SENTRY=true vp run --filter @trizum/pwa build
PLAYWRIGHT_PORT=4188 vp run --filter @trizum/pwa test:e2e:prebuilt e2e/smoke.spec.ts --workers=1
```

`PLAYWRIGHT_PORT` overrides the preview port (default 4173). Pass Playwright
flags directly, without a literal `--` separator. See the
[CI workflow](../../../.github/workflows/ci.yml) and
[Playwright config](../playwright.config.ts) for implementation details.
