# Experimental Fate data layer

The experimental branch uses Fate 2.0.0 for application reads, React subscriptions,
and mutation coordination. Automerge continues to own collaborative persistence
and synchronization. Existing saved documents and share links keep their format.

## Runtime

- [`data/client.ts`](../src/lib/data/client.ts) creates one Fate client per Repo.
  Its local transport awaits ready handles and publishes immutable snapshots.
  Bounded retries keep a temporary unavailable response from becoming a cached
  missing profile while another peer or deferred import supplies the document.
  Commands update Automerge locally, update Fate through source change events,
  and await local storage completion. Sync is independent of that completion.
- [`data/hooks.ts`](../src/lib/data/hooks.ts) reads snapshots with Fate's
  `useView` and `useViews`. Domain hooks compose those reads with private commands.
  Components and route loaders receive the data client instead of a Repo.
- [`data/partyCommands.ts`](../src/lib/data/partyCommands.ts),
  [`data/profileCommands.ts`](../src/lib/data/profileCommands.ts), and
  [`data/mediaCommands.ts`](../src/lib/data/mediaCommands.ts) own source writes.
  Expense drafts, presence broadcasts, creation, and imports also cross the data
  module. Worker balance calculation keeps its document-head synchronization.
- [`data/http.ts`](../src/lib/data/http.ts) wraps the existing validated HTTP
  implementation with Fate queries and mutations. Reads retain their existing
  refresh policy, account scopes isolate concurrent reads, and account/paid data
  remains server-authoritative.
- [`data/fateState.ts`](../src/lib/data/fateState.ts) holds SDK session and resolved
  Premium snapshots in Fate. Auth subscribes to the SDK source once while readers
  are mounted; remembered identity remains available offline. Ordinary form and
  dialog state remains in React.

## Offline and immediate updates

A handle change publishes its new snapshot synchronously into Fate. Storage and
WebSocket synchronization do not gate that visible update. Awaiting a successful
mutation waits for the local command and storage flush, so navigation after a save
cannot acknowledge an uncommitted write. There is no additional Fate IndexedDB
copy or durable remote-mutation queue: Automerge owns offline edits and merges.

The transport retains each loaded record and its source subscription for the
application data client's lifetime, matching the previous session cache behavior.
`dispose()` aborts outstanding reads, releases retained requests, and removes
source listeners. Reload reconstructs the Fate cache from local Automerge storage.
Initial expense history still loads one chunk, and further pages load on demand.

## Experimental tradeoffs

The first port selects whole immutable domain snapshots as scalar Fate fields.
It preserves `Date`, `RawString`, object identity, source deletion, and existing
expense pagination without converting the persisted model. It does not yet provide
field-level normalized participant/expense subscriptions. Chunk relationships are
still present in the internal domain hooks. Narrower public views and domain-only
list cursors remain follow-up work for evaluating normalization.

Local commands use a private Fate mutation that executes a typed source closure.
Those closures are neither serialized nor replayed after reload. The source write
itself is persisted by Automerge. HTTP and SDK integrations have their own Fate
cache instances and preserve the existing refresh and error behavior; unifying
those schemas with the collaborative client is another potential follow-up.

This branch establishes an experimental replacement for the React document cache
and source hooks. It does not establish a performance improvement over main.
Compare interaction latency, bundle cost, retained memory, and render counts on
representative parties before adopting it. Loaded-record retention deliberately
prioritizes instant revisits; an eviction policy should be measured separately.

## Validation

[`client.test.ts`](../src/lib/data/client.test.ts) covers immediate publication,
source field removal, repository isolation, incoming merges, media values,
acknowledged save/offline reopen, draft round trips, retained history, deletion,
and listener cleanup. [HTTP adapter tests](../src/lib/data/http.test.ts) cover
read sharing, refresh, server errors, and in-flight account isolation. Existing domain,
account, SDK, and API tests exercise the production implementations behind Fate.

The browser journeys for offline service-worker reload, offline account recovery,
party creation/join, details save failures/retry, expenses, templates, and debt
transfers are the regression surface for preserving the application's behavior.
Run them using the [E2E harness instructions](../e2e/README.md).
