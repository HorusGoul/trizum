# Experimental Fate data layer

The experimental branch uses Fate 2.0.0 for application reads, React subscriptions,
and mutation coordination. Automerge continues to own collaborative persistence
and synchronization. Existing saved documents and share links keep their format.

## Runtime

- [`data/client.ts`](../src/lib/data/client.ts) creates one Fate client per Repo.
  [`LocalFateClient`](../src/lib/data/LocalFateClient.ts) extends Fate's public
  `ref` method to hydrate a missing projection synchronously from an already
  ready local handle. The transport awaits readiness only when the document must
  be loaded from storage or obtained from a peer.
  Bounded retries keep a temporary unavailable response from becoming a cached
  missing profile while another peer or deferred import supplies the document.
  Commands update Automerge locally, update Fate through source change events,
  and await local storage completion. Sync is independent of that completion.
- React consumers read typed entities with Fate's
  `useView` and `useViews` directly; availability is checked by pure validation
  functions. Hooks retain only behavior such as route/profile/participant identity
  and browser resource lifetimes. Reusable party cards receive refs from their parent
  and read their own colocated view. React uses Fate's provider and `useFateClient`;
  router context carries the same configured Fate client. There is no additional
  application data context or service-locator hook.
- [`data/partyCommands.ts`](../src/lib/data/partyCommands.ts),
  [`data/profileCommands.ts`](../src/lib/data/profileCommands.ts), and
  [`data/mediaCommands.ts`](../src/lib/data/mediaCommands.ts) own source writes.
  Expense drafts, presence broadcasts, creation, and imports also cross the data
  module. [`schema.ts`](../src/lib/data/schema.ts) declares typed Fate roots and
  mutations; [`mutations.ts`](../src/lib/data/mutations.ts) implements the local
  writes behind the transport. Inputs contain values rather than executable
  command closures. Completion waits for the source operation and local storage
  flush. Worker balance calculation keeps its document-head synchronization.
- [`data/http.ts`](../src/lib/data/http.ts) wraps the existing validated HTTP
  implementation with Fate queries and mutations. Reads retain their existing
  refresh policy, account scopes isolate concurrent reads, and account/paid data
  remains server-authoritative.
- [`data/fateState.ts`](../src/lib/data/fateState.ts) holds SDK session and resolved
  Premium snapshots in Fate. Active profile identity is a native Session entity.
  Auth subscribes to the SDK source once while readers
  are mounted; remembered identity remains available offline. Ordinary form and
  dialog state remains in React.

## Offline and immediate updates

A handle change publishes its new snapshot synchronously into Fate. Storage and
WebSocket synchronization do not gate that visible update. Awaiting a successful
mutation waits for the local command and storage flush, so navigation after a save
cannot acknowledge an uncommitted write. There is no additional Fate IndexedDB
copy or durable remote-mutation queue: Automerge owns offline edits and merges.

A Fate miss or eviction does not require an asynchronous read when Automerge
already has the document ready in memory: the adapter registers its source listener
and projects it before React reads the view. Local storage loading remains
asynchronous and does not require network access. Cache-only `peek` stays
observational so history pagination still controls which chunks are acquired.

The transport retains each loaded record and its source subscription for the
application data client's lifetime, matching the previous session cache behavior.
Retention avoids rebuilding projections; ready local documents remain synchronous even after Fate eviction.
`dispose()` aborts outstanding reads, releases retained requests, and removes
source listeners. Reload reconstructs the Fate cache from local Automerge storage.
Initial expense history still loads one chunk, and further pages load on demand.

## Experimental tradeoffs

Each React consumer declares its Fate views beside its implementation. The
[card view](../src/components/PartyListCard.view.ts) lives beside
[`PartyListCard`](../src/components/PartyListCard.tsx), which receives refs from
its parents. Exported shared views use adjacent files to preserve Fast Refresh.
[`ExpenseLog`](../src/routes/party.$partyId/-components/ExpenseLog.tsx) owns its
history and saved-expense selections;
[`Balances`](../src/routes/party.$partyId/-components/Balances.tsx) owns balance
reads and derives displayed totals through the existing pure calculations.
The [expense editor route](../src/routes/party_.$partyId.expense.$expenseId_.edit/route.tsx)
owns its draft selection. There is no central UI view catalog or per-model query
hook layer.

`useProfileId`, `useCurrentPartyId`, and `useCurrentParticipant` own identity
selection. Participant filtering lives in
[`expenseParticipants.ts`](../src/lib/expenseParticipants.ts) as pure functions.
[`useMediaFileObjectUrls`](../src/hooks/useMediaFileObjectUrls.ts) owns reference
counting and browser URL cleanup; each image consumer selects its media through
Fate directly. Appearance effects run once at bootstrap. The adapter owns private
identity and relationship views for cache retention, independent of UI selections.

[`data/projection.ts`](../src/lib/data/projection.ts) maps source documents to
Party, Profile, ExpenseChunk, Expense, Balance, and Media entities. Expenses have
independent identities; chunks expose normalized expense references. List views
select membership, saved rows select saved expense fields, and editors additionally
select draft fields. A source change publishes its projections atomically. Removed
optional fields are explicitly cleared, and removed expenses or documents publish
`available: false`. Required views use the existing unavailable-record error path.

Participant, payment-method, template, balance, and draft maps remain scalar fields.
They preserve `Date`, `RawString`, and immutable nested object identity; individual
entries in these maps are not normalized. The pagination controller
retains imperative source snapshots privately. Route preloads and guards read
Fate views. The controller handles
chunk loading and sort order; React reads displayed expense fields through Fate
views. Unchanged expense ID order does not invalidate the pagination snapshot.
Persisted document shapes and the initial one-chunk loading policy are unchanged.

Fate mutations identify individual domain operations, such as
`client.mutations.party.updateDetails({ input: { partyId, parameters: [values] } })`.
The adapter maps them to source helpers. `mutationResult` is a small response
unwrapper for existing event handlers that throw on failed saves. Mutations are
not journaled by Fate; Automerge persists their resulting document changes. A
successful mutation result acknowledges that source flush; Fate's
`locallyPersisted` property concerns its separate mutation journal.

[`history.ts`](../src/lib/data/history.ts) publishes expense IDs and pagination
status as an ExpenseHistory entity. Draft-only changes leave its snapshot stable.
[`presenceStore.ts`](../src/lib/data/presenceStore.ts) validates incoming ephemeral
messages, publishes presence as Fate data, and expires entries. Import progress is
also a Fate entity; mutation inputs carry an operation ID rather than callbacks.
Source listeners and timers are disposed with the adapter. Analytics is bound at
application bootstrap and follows active profile changes inside the adapter.

HTTP and SDK integrations retain separate Fate cache instances and their existing
refresh and error behavior.

This branch establishes an experimental replacement for the React document cache
and source hooks. It does not establish a performance improvement over main.
Compare interaction latency, bundle cost, retained memory, and render counts on
representative parties before adopting it. Loaded-record retention deliberately
prioritizes instant revisits; an eviction policy should be measured separately.

## Validation

[`client.test.ts`](../src/lib/data/client.test.ts) covers immediate publication,
source field removal, repository isolation, incoming merges, media values,
acknowledged save/offline reopen, draft round trips, retained history, deletion,
and listener cleanup. [`views.test.tsx`](../src/lib/data/views.test.tsx) mounts
React against real repositories to verify field isolation, shared listeners,
optional-field removal, normalized expense membership, draft write round trips,
incoming merges, deletion, retention, and immediate rendering from cold or evicted
Fate caches when the source is ready locally. Native Fate runtime tests in
[`runtime.test.ts`](../src/lib/data/runtime.test.ts) cover page acquisition, live
membership, draft isolation, profile identity, presence validation, expiry,
listener cleanup, wrong-document mutation rejection, and real-document imports
with progress updates. [HTTP adapter tests](../src/lib/data/http.test.ts) cover
read sharing, refresh, server errors, and in-flight account isolation. Existing domain,
account, SDK, and API tests exercise the production implementations behind Fate.

The browser journeys for offline service-worker reload, offline account recovery,
party creation/join, details save failures/retry, expenses, templates, and debt
transfers are the regression surface for preserving the application's behavior.
Run them using the [E2E harness instructions](../e2e/README.md).
