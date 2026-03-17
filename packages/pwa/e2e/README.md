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
  blocks service workers. Each Playwright test gets a fresh browser context, so
  local storage, IndexedDB, and party-list state do not leak across runs.
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

- `pnpm --filter @trizum/pwa test:e2e -- e2e/harness.spec.ts`
- `pnpm --filter @trizum/pwa test:e2e -- e2e/smoke.spec.ts`
