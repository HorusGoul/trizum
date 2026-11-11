# Fate v2 in front of Automerge: architecture exploration

Experimental implementation details and current limits are recorded in
[the PWA data-layer guide](../../packages/pwa/docs/fate-data.md). The remaining
architecture discussion describes the intended domain-level interface.

Status: architecture exploration for replacing the complete React data access
layer with Fate. The target public interface is Fate requests, views, live views,
lists, and mutations for both components and route loaders.

Automerge is a private implementation of collaborative storage, conflict
resolution, and synchronization behind that interface. Its Repo, handles, document
layout, and durability protocol stay inside the data module. Fate owns the
application-facing cache and access semantics. Persisted collaborative data
continues to use Automerge internally, with one durable owner for those fields.

Recommended integration: a custom local `Transport` for collaborative domain
data, with client-schema fields for appropriate local extensions and derived
values. Fate's transport interface provides asynchronous fetches, mutations, and
subscription teardown. Its client-only queries are synchronous lookups, so using
only that path would require additional acquisition coordination inside the data
module. [Transport contract][transport], [client fetching][client-fetch],
[live subscription implementation][client-live].

The next prototype must exercise the whole public interface for one domain slice:
load, render, mutate, observe a remote change, and reload offline. Its purpose is
to prove the architecture for the full replacement. An Automerge transport has
not been implemented or measured in this exploration.

## Research scope and version

| Item                  | Evidence                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version inspected     | `@nkzw/fate@2.0.0` and `react-fate@2.0.0`                                                                                                              |
| Upstream tag          | [`v2.0.0`](https://github.com/nkzw-tech/fate/tree/v2.0.0)                                                                                              |
| Tag's source commit   | [`2f3c52c2448ca0004d82edbadffa3a5036b92446`](https://github.com/nkzw-tech/fate/commit/2f3c52c2448ca0004d82edbadffa3a5036b92446), dated 2026-11-11      |
| Starting announcement | [What's new in fate 2.0?](https://fate.technology/posts/whats-new-in-fate-2.0)                                                                         |
| Research date         | 2026-11-11                                                                                                                                             |
| Scope                 | Official documentation, package exports, implementation, and upstream tests at the pinned commit; isolated checks against the published 2.0.0 packages |

The links below pin source and documentation to that commit. The live website is
useful for orientation but can change independently. The tag's package manifests
declare version `2.0.0`; `react-fate` requires `react` and `react-dom` matching
`^19.2.0`. [Package manifests][packages-core], [React package][packages-react].

## Target architecture

```text
React components                      TanStack Router loaders
requests / views / live lists          await fate.request(...)
mutations / actions                            |
          \                                    /
                    typed Fate client
             domain roots, cache, selections,
               mutation and loading state
                            |
                 application data module
             local Transport + domain commands
                  /                  \
     Automerge implementation       HTTP / auth / native SDK implementations
     document loading + storage     server-authoritative account and paid data
     WebSocket + worker sync
```

The same Fate client is supplied to React and router context. Components and
loaders know domain identities such as `partyId` and `expenseId`; document IDs
embedded in their encoding are opaque. Internal command implementations can reuse
existing business logic after it is moved out of React hooks.

This is a proposed architecture inferred from Fate's public interfaces. The
pinned upstream tree has no built-in Automerge integration.
[Client runtime][client], [transport contract][transport].

| Candidate boundary                      | Built into Fate v2.0.0                                                                                                         | Custom work and architectural consequence                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client schema over projected records    | `createClient()`, `registerClientSchema`, fixed/by-ID/query roots, client mutations, selected-field subscriptions, memo fields | Adapter loads documents, assigns identities, translates snapshots/changes into Fate writes, publishes membership/deletions, and manages lifecycle. Queries read the projection already in memory.                                                        |
| Custom `Transport` over document access | Async `fetchById`, optional `fetchQuery`/`fetchList`/`mutate`, optional `subscribeById`/`subscribeConnection`                  | Adapter implements all applicable contracts and describes document-backed records as transport-backed types. Fate calls these the remote/server path even if the implementation accesses local Automerge. This is a separate design from `schema.types`. |

`schema.types` are client-owned. The runtime bypasses transport fetching for them
and returns a no-op live subscription. Adding a transport to the same client
does not turn those types' queries into lazy Automerge loads. The recommended
transport uses the corresponding base type/root definitions for document-backed
domain entities. Client-schema extensions can coexist on
that same Fate client.
[Client fetching][client-fetch], [live subscription implementation][client-live],
[schema installation][state-install].

## Scope of the React data layer replacement

Repository baseline: `79ba6d50fa38f8474289354a5daa361f2b3a0ed7` on
`main`. These are observations of trizum's source; the architecture below is a
proposed use of Fate, not behavior supplied by a built-in Automerge integration.

| Current module                                                                                                                                      | Responsibility                                                                        | Fate exploration                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`main.tsx`](../../packages/pwa/src/main.tsx) and [`recoveringStorage.ts`](../../packages/pwa/src/lib/recoveringStorage.ts)                         | One main-thread Repo, IndexedDB recovery, WebSocket sync, router context              | Bootstrap private Automerge resources and expose only Fate to React and router context                   |
| [`data/client.ts`](../../packages/pwa/src/lib/data/client.ts)                                                                                       | Ready-handle lookup, retries, document snapshots, subscriptions, multi-document reads | Replace with Fate requests, views, and transport-backed live subscriptions                               |
| [`guards.ts`](../../packages/pwa/src/lib/guards.ts) and route loaders                                                                               | Imperative document preloading and membership redirects                               | Use Fate requests exclusively; preserve routing and membership policy                                    |
| [`useParty.ts`](../../packages/pwa/src/hooks/useParty.ts)                                                                                           | Domain commands, chunk creation, expense patches, balance scheduling                  | Move domain commands behind Fate mutations; keep all handle writes private                               |
| [`usePartyList.ts`](../../packages/pwa/src/hooks/usePartyList.ts)                                                                                   | Active profile, membership, settings, pin/archive state                               | Expose the active profile and settings through Fate roots and mutations; keep profile switching internal |
| [`partyPaginatedExpenses.ts`](../../packages/pwa/src/lib/partyPaginatedExpenses.ts)                                                                 | Load chunks, retain contiguous visible pages, sort expenses                           | Expose domain expense lists through Fate; keep chunk acquisition and cursor translation private          |
| [`usePartyBalances.ts`](../../packages/pwa/src/hooks/usePartyBalances.ts)                                                                           | Merge existing balance documents for display                                          | Expose domain balances and refresh through Fate; keep worker heads and balance documents private         |
| [`appWorker/client.ts`](../../packages/pwa/src/lib/appWorker/client.ts) and [`balanceSync.ts`](../../packages/pwa/src/lib/appWorker/balanceSync.ts) | Wait for input/output document heads around worker calculation                        | Keep synchronization inside mutation/read implementations and emit resulting Fate updates                |

The current handle and document cache keys use only `String(id)`, although callers
also pass a Repo. The array cache similarly uses only joined IDs. A replacement
should scope its client and adapter to a Repo instance, so tests and separate
repositories holding the same document ID cannot share a projection accidentally.

### Public interface and source ownership

| Consumer operation                | Public interface                        | Private implementation                                                              |
| --------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| Load party or active profile      | `fate.request(...)` / `useRequest(...)` | Transport resolves domain identity and awaits document readiness                    |
| Render party details              | `useView(...)` / `useLiveView(...)`     | Normalized snapshots; live transport callbacks publish Automerge changes            |
| Load more expenses                | Fate list/connection operations         | Translate cursor to chunk reads and source ordering                                 |
| Save party details / edit expense | Fate mutation or Action                 | Run domain command, await appropriate local flush, return authoritative read model  |
| Refresh balances                  | Fate mutation                           | Synchronize worker input/output heads and return updated balances                   |
| Read media                        | Fate media metadata/resource view       | Decode source bytes and retain/release object URLs inside the owning implementation |
| Switch active profile             | Fate mutation and active-profile query  | Resolve destination, change profile scope, refresh affected roots/subscriptions     |
| Read or change paid/account data  | Fate roots/mutations                    | Existing HTTP/auth/native SDK implementations and server authority                  |

```text
React action -> Fate mutation -> private domain command -> Automerge.change
                                           |
                                      local flush
                                           |
                        authoritative domain result -> Fate cache

Remote merge -> private handle listener -> Transport onData/onDelete
                                                    |
                                            Fate live view update
```

Fate is the external seam for callers and tests. The deep module behind it owns
source lookup, retries, projection, identity, deletion, subscriptions, cursor
translation, storage completion, and disposal. Thin feature hooks may compose
Fate views or commands, but must not grow a second document-access interface.

For collaborative writes, mutation success means the command's local durability
milestone has completed. For example, the current `updateDetails` helper awaits
`repo.flush([handle.documentId])`; the Fate mutation must preserve that guarantee.
The transport completes while offline and Automerge synchronizes later. Its
"transport" designation does not imply an HTTP request or a server acknowledgement.

A mutation's optimistic state is managed by Fate; the implementation writes the
domain change into Automerge once. Live echoes and the mutation result must
converge on the same source state. A stale response must not overwrite a newer
remote merge. Fate rollback cannot undo an already-applied Automerge change, so
partial failures must re-read/reconcile source state and preserve existing
multi-document recovery behavior.

Fate's `locallyPersisted` promise describes Fate persistence. The initial design
uses Automerge storage internally for collaborative fields and returns local
save completion through the ordinary mutation result. It has no additional saved
Fate copy of collaborative documents.

Entire-layer scope also includes the server-backed and native-backed data exposed
by [`trizumApiClient.ts`](../../packages/pwa/src/lib/trizumApiClient.ts),
[`auth-client.ts`](../../packages/pwa/src/lib/auth-client.ts), and premium modules.
Their implementations can sit behind the same typed Fate interface while retaining
credential handling, lifecycle refresh, and native callbacks. Party Boost remains
[server-authoritative](../../docs/adr/0002-keep-party-boost-server-authoritative.md).
Ordinary ephemeral UI state, such as an open dialog or an input value, remains
React state under the [PWA conventions](../../docs/agents/pwa.md).

### Before and after at the React seam

```ts
// Before: a React hook owns source reads and source-specific commands.
const [party, handle] = useSuspenseDocument<Party>(partyId, { required: true });
const helpers = getPartyHelpers(useRepo(), handle);
await helpers.updateDetails(values);
```

```tsx
// Target interface sketch: PartyView and the mutation are domain definitions.
// Fate hooks are real APIs; the query and mutation names are proposed.
const { party: partyRef } = useRequest({
  party: { id: partyId, view: PartyView },
});
const party = useLiveView(PartyView, partyRef);
const fate = useFateClient();

async function updateDetailsAction(values: PartyDetailsInput) {
  const saved = await fate.mutations.party.updateDetails({
    input: { id: partyId, ...values },
  });
  if (saved.error) throw saved.error;
}
```

```ts
// Router context after bootstrap contains the same typed Fate client.
// A loader preloads domain data through Fate's asynchronous request interface.
await context.fate.request({
  party: { id: params.partyId, view: PartyView },
});
```

The examples specify the intended caller surface. Definition of the transport,
root types, mutation inputs, and Action results belongs in the implementation
plan after the end-to-end slice validates the integration.

### Projection shape

Trizum currently pins React and React DOM to `19.3.1` in
[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml), satisfying Fate's `^19.2.0`
peer range. The proposed transport can run locally alongside TanStack Router,
Lingui, and the existing Cloudflare API.

Use explicit read models rather than putting a `Repo`, `DocHandle`, or Automerge
document proxy into Fate's normalized store. Project the fields a feature needs
and preserve existing Automerge models and IDs.

| Domain value                                             | Proposed read representation                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Party                                                    | Fate `Party` keyed by its opaque domain ID; initial fields `id`, `name`, `symbol`, `description`                                                  |
| Participant                                              | `PartyParticipant` keyed by a composite of party ID and participant ID; expose the original participant ID separately for commands                |
| Expense                                                  | `Expense` keyed by the existing encoded expense ID, which includes its owning chunk ID                                                            |
| Chunk and balance document                               | Private source identities; expose domain expense connections and balances to consumers                                                            |
| `Record` maps such as participants, shares, and payments | Explicit projected lists/objects appropriate to each field; do not assume arbitrary dynamic keys are selectable schema fields                     |
| `Date`                                                   | Define a consistent scalar representation and conversion; existing expense pagination calls `paidAt.getTime()`                                    |
| `RawString` media payload                                | Keep binary decoding and object-URL lifetime in the existing media module; avoid duplicating attachment bodies in a general normalized projection |

These distinctions matter because participant IDs are embedded values rather than
independent document IDs, and a participant can appear in multiple parties. An
unqualified participant identity could mix party-specific names or payment details.
See the [party](../../packages/pwa/src/models/party.ts),
[expense](../../packages/pwa/src/models/expense.ts), and
[media](../../packages/pwa/src/models/media.ts) models.

### Private implementation correctness contract

| Event                                                 | Required behavior                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| First read                                            | Find the document, wait for readiness, install listeners, then publish a current snapshot; concurrent callers share acquisition |
| Local edit or remote merge                            | Read the current handle snapshot and update the projection through Fate's public write interface                                |
| Event during an async read                            | Use the newest handle state or generation check so an older load cannot overwrite the newer projection                          |
| Optional field/map entry removed                      | Publish explicit removal semantics; an omitted property in a partial update must not leave a stale value                        |
| Document deleted                                      | Clear its visible projection and dependent references; distinguish document deletion from removing a party from one profile     |
| Lookup aborted, timed out, or temporarily unavailable | Preserve an error/retry state; do not permanently equate a failed lookup with a missing document                                |
| Retry after an error                                  | Allow an explicit retry to reacquire and republish the document                                                                 |
| Repeated read, unmount, navigation                    | Deduplicate subscriptions and release them according to an explicit retention policy                                            |
| Client/Repo disposal                                  | Remove every adapter listener and prevent late asynchronous completions from publishing into a disposed client                  |
| Active party-list ID changes                          | Read the new profile immediately; release previous profile queries when no longer retained                                      |
| Balance worker completes                              | Receive and project the main Repo's updated balance documents after the existing heads wait                                     |

The old `handleCache` catches exhausted retries and returns `undefined`. The
experiment should make the distinction between absent, deleted, and temporarily
unavailable explicit rather than carrying that ambiguity into a new store.

### Chunk loading and derived data

Fate field selection can narrow React subscriptions and projection work. An
Automerge `Repo.find` still loads a document, so a small view does not create
field-level Automerge fetching. Keep the current chunk document split and lazy
loading policy. The first page must not acquire every expense chunk or photo.

Fate memo fields are a candidate for shared display derivations, such as merging
already projected balance documents or calculating a count. The existing worker
does expense arithmetic and coordinates document heads; replacing it with a memo
would move that work onto the reader's thread and remove synchronization unless
separately rebuilt. Benchmark projection and normalization overhead as well as
render savings. Fate's published measurements do not establish a speedup here.

## Ordered exploration slices and completion criteria

The first slice is a complete Party-details flow through Fate. It uses a custom
local transport and two independent views (title/symbol and description), plus an
update-details mutation. The router loader and components use only Fate. The
same slice demonstrates local durability, a merge from another Repo, and offline
reload from Automerge storage.

1. Define domain Fate types, query roots, and mutations independently of React
   and Automerge types. Move reusable write helpers out of source-reading hooks
   into the private data implementation while preserving business behavior.
2. Implement the Party transport slice: async readiness and cancellation,
   `fetchById`/query mapping, `subscribeById` with teardown, mutation dispatch,
   source-to-domain projection, and bootstrap/disposal. Use a fresh snapshot when
   subscribing so a change between the initial fetch and subscription is observed.
3. Move Party-details callers and route loading to Fate. Exercise local and
   remote updates, deletion, optional symbol removal, storage failure, retry,
   stale async completions, multiple readers, and cleanup. Confirm views selecting
   unrelated fields retain stable snapshots. Measure render, projection, listener,
   and memory cost on the same workload as the current hooks.
4. Extend the same public interface to active profile, participants, expense
   commands, expense connections, media, and balances. Keep source chunks and
   worker synchronization private. Preserve initial-page, load-next, and
   statistics load-all behavior through domain list operations.
5. Bring account, auth, Premium, Party Boost, and migration data reads/writes
   behind Fate using their existing underlying implementations. Preserve native
   event delivery, refresh policies, authentication errors, and server authority.
6. Remove source-reading React hooks, direct document/cache imports in loaders,
   Repo from router/React context, and obsolete suspense-cache consumers. Retain
   domain computation functions and thin Fate composition hooks where useful.

The experiment succeeds when the first slice supports loading, rendering,
mutation, remote updates, durable save, offline reload, and deterministic cleanup
through public Fate APIs alone. If transport integration has a gap, resolve it
inside the data module or evaluate a client-schema implementation with the same
external Fate interface before proceeding to the migration plan.

The full replacement is complete when:

- React components and route loaders read and mutate application data through
  Fate. They do not import Repo, DocHandle, document caches, or source serializers.
- Public Fate entities expose domain fields, identities, lists, and command
  results. Chunk layout, handle readiness, flushes, and worker heads remain private.
- Local edits and remote merges reach all selected views, including collection
  membership and deletion, with correct profile/account isolation.
- All domain writes use Fate mutations/Actions, and save completion preserves
  each command's durability and error contract.
- Application behavior works offline using the private Automerge implementation,
  and server-authoritative operations preserve their online requirements.
- Data correctness is covered through the Fate-facing interface, with focused
  private persistence coverage for the Automerge implementation.

This document is the overall architecture discussion. The next implementation
plan must write out each root/type, transport method, command mapping, retention
policy, cursor contract, and before/after caller changes in full.

## Client-schema API evidence and alternative implementation

The following research describes the new client data path. Its verified example
illustrates an in-memory projection and publishing interface. It is an alternative
private implementation strategy and a basis for local extensions; it is not the
caller interface for the complete transport-backed replacement above.

### Client schema and resolver context

| Surface                                | Verified contract                                                                                                                                                                  | Implication for a document adapter                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `clientSchema({ types })`              | Types define `defaults(id)` and `dataView` fields. Stored fields, declared relationships, and synchronous memo fields are accepted. Arbitrary server resolver fields are rejected. | A field cannot load a document through a server-style `resolve` field definition.                                           |
| Fixed root                             | `{ type, id }`; registration creates its initial record from defaults.                                                                                                             | Defaults can make a record readable before a document is ready. Readiness must be represented separately when that matters. |
| `clientQuery.byId(type)`               | Parses a string or finite numeric ID; returns the matching record or `null`. Creation and deletion update subscribed requests.                                                     | An unloaded document and an absent projected record both look absent unless the adapter exposes loading state.              |
| `clientQuery(type, { args, resolve })` | `resolve({ args, read })` returns one ID or `null`, synchronously. Optional `args.parse(unknown)` validates arguments.                                                             | It cannot return a document object, list, or promise.                                                                       |
| Query `read(view, type, id)`           | Reads a selected view of a client-owned cached record, tracks dependencies, returns `null` if absent, and errors on unavailable selected fields.                                   | A cached index/list can support lookups; there is no injected repository, `store`, or arbitrary application context.        |
| Mutation resolver                      | Receives `{ input, store, mutateRemote }`; it can return a value or promise.                                                                                                       | Dependencies such as an Automerge repository must be captured in application closures or used outside the Fate resolver.    |

Sources: [schema types and helpers][schema],
[query execution and dependency tracking][client-query],
[installation validation][state-install],
[mutation execution][state-mutations]. Upstream tests cover by-ID create/update/
delete notifications and a lookup that reads a client index through a view.
[By-ID tests][query-tests], [client-state tests][state-tests].

Client queries have no root-level client list resolver. A client collection can
instead be a relationship on an index/root record declared with
`list(childDataView)`. A lookup can read that relationship and select an ID.
Sorting, filtering, pagination, and index maintenance remain application choices;
the transport list API is a different surface. [Root union][schema],
[client collection example][state-tests], [transport lists][transport].

The server/client shared `memo` signature includes an optional context parameter,
but the client implementation calls it with `undefined` for that context. Its
first argument is also a masked dependency object, not an unrestricted backing
document. Neither argument is an Automerge dependency-injection hook.
[Memo definition][data-view], [client memo execution][state-memo].

## Minimal verified client projection

This self-contained example uses real exports from `react-fate@2.0.0` and an
explicit `zod` dependency for input parsing. Its mutations only publish/remove a
read model; an application command must still write the underlying document.
The example deliberately has no Fate persistence configuration. All APIs and
types used here are exported by the pinned packages. [React exports][react-exports],
[core exports][core-exports], [schema contracts][schema].

```ts
// state.ts — illustrative Fate boundary, not a trizum model definition.
import {
  clientQuery,
  clientSchema,
  createClient,
  dataView,
  memo,
  view,
  type EntityOf,
} from "react-fate";
import { z } from "zod";

const partySnapshot = z.object({ id: z.string(), title: z.string() });
type PartySnapshot = z.infer<typeof partySnapshot>;

const partyData = dataView<PartySnapshot>("PartyProjection")({
  id: true,
  title: true,
  titleLength: memo({
    resolve: (_item: PartySnapshot, { title }) => title.length,
    select: { title: true },
  }),
});

const schema = clientSchema({
  roots: { party: clientQuery.byId("PartyProjection") },
  types: {
    PartyProjection: {
      defaults: (id) => ({ id, title: "" }),
      view: partyData,
    },
  },
});

export const createProjectionClient = () =>
  createClient().registerClientSchema(schema, ({ mutation }) => ({
    "projection.publishParty": mutation("PartyProjection", {
      input: partySnapshot,
      resolve: ({ input, store }) => {
        if (store.has("PartyProjection", input.id)) {
          return store.update("PartyProjection", input.id, { title: input.title });
        }
        return store.create("PartyProjection", input);
      },
    }),
    "projection.removeParty": mutation("PartyProjection", {
      input: z.object({ id: z.string() }),
      resolve: ({ input, store }) => store.delete("PartyProjection", input.id),
    }),
  }));

export type ProjectionClient = ReturnType<typeof createProjectionClient>;
export type PartyProjection = EntityOf<ProjectionClient, "PartyProjection">;

declare module "@nkzw/fate" {
  interface ClientRegistration {
    client: ProjectionClient;
  }
}

export const PartyTitleView = view<PartyProjection>()({
  title: true,
  titleLength: true,
});
```

Registration returns the same instance with extended types and must happen before
requests or record writes. `ClientRegistration` types the framework hooks;
`EntityOf` names the schema-derived entity, and `view` masks its selected fields.
Keep a registration within its app's TypeScript project. [Registration source][client-register],
[client guide][client-state-doc], [view documentation][views-doc].

```tsx
// panel.tsx — render after the proposed adapter's initial projection is ready.
import { Suspense } from "react";
import { FateClient, useRequest, useView } from "react-fate";
import { PartyTitleView, type ProjectionClient } from "./state.ts";

export function PartyTitle({ id }: { id: string }) {
  const { party } = useRequest({ party: { args: { id }, view: PartyTitleView } });
  const data = useView(PartyTitleView, party);
  return data ? <h1>{data.title}</h1> : <p>Party unavailable.</p>;
}

export function ProjectionExample({ fate, id }: { fate: ProjectionClient; id: string }) {
  return (
    <FateClient client={fate}>
      <Suspense fallback={<p>Loading…</p>}>
        <PartyTitle id={id} />
      </Suspense>
    </FateClient>
  );
}
```

The `Suspense` boundary handles Fate's pending reads. It does not wait for an
unregistered Automerge loading operation: the by-ID request returns `null` while
the projection is absent. [Query runtime][client-query],
[React request hook][react-request], [React view hook][react-view].

Publishing from an external event uses the same real mutation API:

```ts
// Called by proposed adapter code when it has a validated source snapshot.
const result = await fate.mutations.projection.publishParty({
  input: { id: "party-document-id", title: "Weekend trip" },
});
if (result.error) {
  throw result.error;
}
```

The caller must also handle a rejected promise. Fate returns an envelope
`{ result, error }`, not the entity alone. [Mutation response and error handling][mutations].

## Mutations and transaction boundary

The `store` inside a client resolver is a typed, staged `ClientStore`. It is
different from the lower-level `fate.store` used internally for normalized cache
transactions and subscriptions. In particular,
`store.update(type, id, patch)` in the examples is a mutation-context operation,
not the low-level store's update callback. [ClientStore][schema],
[client mutation staging][state-mutations], [normalized store][store].

| Operation                                         | Verified behavior                                                                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store.create(type, data)`                        | Client-owned types only; requires an ID, applies defaults, rejects an existing identity.                                                                                            |
| `store.update(type, id, patch)`                   | Requires an existing record. Writes declared stored client fields; rejects computed/unknown fields. It is not an upsert.                                                            |
| `store.get(type, id)`                             | A detached, possibly partial snapshot, including staged writes; excludes optimistic layers. Does not fetch missing fields or evaluate memo fields. It can materialize related data. |
| `store.has(type, id)`                             | Checks existence, including staged creates/deletes, without materializing the related graph.                                                                                        |
| `store.append(ownerType, ownerId, field, ...ids)` | Appends existing/previously-created related records. Duplicate membership keeps its position; commit applies the operation to the current confirmed list.                           |
| `store.remove(ownerType, ownerId, field, ...ids)` | Removes membership without deleting entities; ignores missing/duplicate IDs and preserves remaining order.                                                                          |
| `store.delete(type, id)`                          | Client-owned types only; removes the record and updates normalized references.                                                                                                      |

Sources: [ClientStore contract][schema], [mutation implementation][state-mutations],
[commit-time list operations][client-writes], [client-state guide][client-state-doc].

A successful resolver commits its staged graph together; a thrown resolver
discards those changes. Without Fate persistence, a synchronous resolver can
publish before its returned promise settles. Returning a record is only an action
result: returning a copied object without explicit store writes does not publish
it, and an old returned snapshot does not overwrite later staged edits.
[Mutation wrapper][mutations], [staging implementation][state-mutations],
[atomic publication and stale-snapshot tests][state-tests].

An Automerge write inside an async resolver is an external side effect. Fate's
rollback cannot undo it. Likewise, a successful Fate mutation is not evidence that
an Automerge storage adapter has flushed or that another peer has received the
change. A proposed adapter must define which source milestone its command promise
represents and how it rebuilds the projection after partial failure. The same
external-transaction limitation is documented for `mutateRemote`.
[Client/server mutation boundary][client-state-doc], [mutation wrapper][mutations].

## Normalization, identity, deletion, and lists

| Concern                    | Source-backed finding                                                                                                                      | Adapter consequence                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache identity             | `toEntityId(type, id)` is `${type}:${String(id)}`.                                                                                         | IDs must distinguish the source document and entity when a client combines documents. Numeric `1` and string `'1'` share a normalized key within a type; use a consistent encoding. |
| Relationship normalization | A relationship descriptor from a child data view or `list(childView)` identifies related records by type and ID. Related objects need IDs. | Project nested document maps/lists into explicit entities where independent field subscriptions are desired.                                                                        |
| Stored scalar JSON         | A `true` field can hold a JSON object/array without declaring it a relationship.                                                           | Storing a whole document in one scalar does not provide per-entity normalization for its nested members. Explicit memo paths can still read that scalar's contents.                 |
| Snapshot publication       | Store patches merge selected fields; array relationship writes can replace membership.                                                     | Removed fields need a defined representation, and source member deletion cannot be inferred by merely publishing the surviving child objects.                                       |
| Delete record              | `deleteRecord` removes normalized list references and replaces single-object references with `null`; client `store.delete` uses this path. | Translate source deletions into explicit Fate deletions when the entity should disappear from the read model.                                                                       |
| Remove membership          | `store.remove` leaves the entity available elsewhere.                                                                                      | Distinguish deletion of a source entity from removal from one collection.                                                                                                           |
| New object                 | Creating/normalizing an entity does not automatically place it in arbitrary filtered or ordered lists.                                     | Publish owner relationship membership or use explicit insertion targets. Apply source ordering/filtering deliberately.                                                              |
| Retention                  | Fixed client roots and reachable objects stay in memory for the client's lifetime. Other records follow request/cache retention rules.     | A global index can retain a large graph. By-ID roots alone do not establish an application document ownership/lifecycle policy.                                                     |

Sources: [identity function][identity], [schema installation][state-install],
[relationship staging][state-mutations], [record writes][client-writes],
[reference deletion][store-delete], [explicit insertion documentation][actions-doc],
[state lifetime documentation][client-state-doc].

Source objects and memo outputs should be treated as read-only. The adapter should
publish ordinary projection data through Fate operations; changing an object held
elsewhere does not, by itself, emit a Fate store notification. A schema definition
specifies fields, not a subscription to arbitrary object changes.
[Client guide][client-state-doc], [mutation staging][state-mutations],
[React subscription implementation][react-snapshots].

## Subscriptions and external changes

| Mechanism                         | What it observes                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useView` / `useViews`            | Selected data and dependency coverage in Fate's normalized store; React subscriptions include entity IDs and selected paths.                                                                  |
| `useRequest`                      | Request result availability/identity and its tracked dependencies, including query lookup records.                                                                                            |
| `observeRequestResult(request)`   | Framework-independent request snapshot plus subscribe/unsubscribe; useful for observing the projection.                                                                                       |
| `useLiveView` / `useLiveListView` | Adds transport subscriptions for eligible transport-backed selections. For client-owned records/local relationships, the extra subscription is a no-op; ordinary view reactivity still works. |
| `Transport.subscribeById`         | A custom transport supplies data/delete/error callbacks for an entity and selected fields.                                                                                                    |
| `Transport.subscribeConnection`   | A custom transport supplies explicit connection events, including membership changes and invalidation.                                                                                        |

Sources: [view subscriptions][react-snapshots], [React requests][react-request],
[request observers and dependency tracking][client-query],
[live runtime][client-live], [transport interface][transport].

For a client-schema architecture, every local edit and incoming source change must
reach the projection through application code. Fate cannot observe an Automerge
handle that the adapter has not connected. `useLiveView` does not install that
connection. The adapter needs a policy for initial snapshot plus event ordering,
updates during loading, disposal, source unavailability, removed objects, and
rebuilding after an error. These are requirements inferred from the two systems'
boundary, rather than Fate-provided adapter behavior.

## Async readiness and errors

| Situation                    | Fate v2.0.0 behavior                                                                                                                                                                                                         | Proposed adapter responsibility                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial client record absent | A by-ID client query returns `null`; direct loading of a missing client-owned record raises `NOT_FOUND`. It does not invoke a transport to create that record.                                                               | Distinguish loading, unavailable/deleted, and error states before presenting a missing-record result as final.                                         |
| Pending read                 | Default React requests/views can suspend; read errors reach an error boundary.                                                                                                                                               | Connect source readiness to an explicit route/resource gate or declared load-state projection. Fate's async API alone does not await handle readiness. |
| Cache-only React request     | `useRequest(..., { mode: 'cache-only' })` avoids fetching/suspension and returns `undefined` on incomplete data. An absent by-ID match can still be a complete result containing `null`.                                     | Preserve the distinction between incomplete cached data and no matching entity.                                                                        |
| Imperative read              | `readView` returns a thenable snapshot; `peekView` reads synchronously or returns `undefined` if unavailable/not restored. Peek neither fetches nor subscribes/retains, and invalid refs/computation errors can still throw. | Use these as projection APIs, not as implicit source loaders.                                                                                          |
| Client mutation failure      | Call-site errors may be returned in `.error`; other errors reject. Staged and optimistic Fate changes are rolled back.                                                                                                       | Handle both result errors and rejections in commands and external event publishers. Reconcile already-applied document writes.                         |
| Fate persistence startup     | Reads/mutations wait for persistence readiness; an initial restore failure rejects `session.ready`.                                                                                                                          | This readiness is Fate persistence readiness, not Automerge repository readiness.                                                                      |
| Live transport error         | Last cached data remains visible; `onLiveError` handles reporting rather than the component error boundary.                                                                                                                  | A client-schema bridge needs its own event-error/status policy; there is no automatic `onLiveError` path for its external subscription.                |

Sources: [query resolution][client-query], [client-owned fetching][client-fetch],
[read/peek implementation][client-read], [client state guide][client-state-doc],
[view docs][views-doc], [mutations][mutations],
[persistence state documentation][persistence-doc], [live documentation][live-doc].

An illustrative adapter contract makes these missing semantics visible without
inventing an upstream API:

```ts
// Proposed application adapter, NOT an export from Fate or Automerge.
type PartyProjectionAdapter = {
  // Resolve after source readiness AND the initial Fate projection commit.
  // Reject on load/publication failure; subscribe without an initial-event gap.
  open(id: string): Promise<void>;

  // Release source listeners/handles and apply the chosen projection lifetime.
  close(id: string): void;

  // Use the existing document-write path, then reconcile from source state.
  // The application must define its durability/acknowledgement milestone.
  rename(id: string, title: string): Promise<void>;
};
```

This contract describes an alternative internal projection adapter. React and
route loaders would still use Fate exclusively; acquisition and source commands
would have to be coordinated privately. The recommended transport-backed slice
uses Fate's transport fetch/subscription/mutation hooks for that coordination.

## Persistence ownership

Fate persistence is optional. With `createPersistence` and a storage backend, it
owns a saved client graph, list membership, deletions, client-state migrations,
and its own storage budget. Client mutations save their changes before publishing
confirmed state. Saved client state survives remote-cache expiry and
`clearCache()`. Tabs sharing a persistence key coordinate client writes and check
for newer saves before client mutations. These guarantees concern Fate's saved
data, not an arbitrary external repository. [Client persistence][client-state-doc],
[storage contract and session behavior][persistence-doc].

| Candidate ownership                                                   | Benefit to investigate                                                                     | Extra contract                                                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automerge owns durable document state; Fate projection is in memory   | Projection can be rebuilt from the authoritative documents; no second saved document model | Define reconstruction, readiness, memory retention, and source event delivery. The minimal example demonstrates this Fate configuration.                                      |
| Automerge owns documents; Fate separately persists transient UI state | Client-only UI fields could use Fate's normal storage/migrations                           | Separate persistence scope and field ownership; avoid restoring stale projected document data as authoritative.                                                               |
| Persist a Fate copy of projected document data                        | Potential startup cache for the projection                                                 | Define validity/versioning, restoration order, deletion reconciliation, account/document isolation, and source-over-cache precedence. No two-store atomic commit is supplied. |

`PersistenceStorage` is a key/value storage protocol with atomic `writeBatch`,
prefix `scan`, cross-client `exclusive` locking, and optional notifications. It is
not an Automerge document interface. Implementing it on another storage system
would store Fate's representation and preserve Fate's transaction protocol; it
would not automatically reuse existing Automerge schemas or CRDT change semantics.
[PersistenceStorage documentation][persistence-doc].

Fate's durable remote mutation queue requires `mutateDurably` and server-side
deduplication. Client mutations instead execute locally and save their resulting
client graph when persistence is configured; arbitrary client resolver closures
are not a durable Automerge command queue. The mutation's `locallyPersisted`
promise describes Fate persistence, rejects without eligible persistence, and
does not acknowledge Automerge storage or peer synchronization.
[Persistence guide][persistence-doc], [mutation branching][mutations].

## Typed views and memo-derived fields

| Capability                            | Verified boundary                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataView`                            | Defines stored fields, relationship shape, and memo computations for a registered client type.                                                                                                          |
| `EntityOf<Client, Name>` / `ClientOf` | Extracts the configured entity or names the composed client type; definitions do not require a generated server schema for client-only use.                                                             |
| `view<Entity>()`                      | Selects/masks fields and composes child views. Refs carry view tags; resolving an unrelated view against a ref can throw even when its fields happen to be cached.                                      |
| `memo({ select, resolve })`           | Lazily derives a field and shares the result for the entity/field argument variant across views. The runtime compares dependency values with `Object.is` and rejects thenable results.                  |
| Dependency tracking                   | Selected scalar/relationship paths contribute dependency coverage. Memo dependencies can include other computed fields; schema registration rejects cycles.                                             |
| Limitations                           | Client computations must be synchronous, receive no server context/authorization, and select related field paths instead of whole normalized relationship objects. Treat computed outputs as read-only. |

Sources: [public definitions][schema], [view documentation][views-doc],
[memo definition][data-view], [memo runtime][state-memo],
[schema installation][state-install], [client computation guide][client-state-doc].

Memo can move shared derivation into the read model, but its benefit depends on
the projected dependency structure. Replacing a whole scalar document/object can
change dependency identities; repeated large-list selection still has a cost.
The pinned code establishes caching and notification mechanics, not a performance
improvement for trizum. Projection work, allocations, source patch conversion,
render behavior, and memory need workload-specific measurements before any
performance claim.

## Build and code generation requirements

| Setup                    | Requirement                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client-only schema       | `createClient().registerClientSchema(...)` from the normal package entry point. No transport, Fate Vite plugin, or code generation required.                                                                |
| React integration        | `react-fate@2.0.0`; React/React DOM `^19.2.0`; `FateClient` provider and typed hook registration.                                                                                                           |
| Core-only integration    | `@nkzw/fate` exports the client schema/core APIs without a React provider.                                                                                                                                  |
| Generated client path    | `createFateClient` from `react-fate/client` re-exports `@nkzw/fate/client`, whose shipped stub throws unless replaced/generated by the Fate Vite plugin. It is a different entry point from `createClient`. |
| Server/GraphQL codegen   | Fate's plugin imports schema/server module information and generates its client surface/types. This is relevant if choosing that architecture, not a prerequisite for the client-only projection example.   |
| Example input validation | `zod` is imported explicitly by the example; Fate accepts a suitable parser rather than requiring this particular schema library for application inputs.                                                    |

Sources: [client-only setup guide][client-state-doc],
[React manifest][packages-react], [core exports][core-exports],
[generated stub][client-stub], [Vite implementation][vite],
[React client re-export][react-client], [input parser types][schema].

## Verification

The two example files above were type-checked in an isolated temporary project
against the published `@nkzw/fate@2.0.0` and `react-fate@2.0.0` packages with React
19.2.0. A Node smoke check using those packages verified: absent by-ID query,
creation, publication of a changed title, memo invalidation, imperative request
subscription notification, and deletion returning the query to `null`.

The checks establish the illustrated Fate API behavior. They do not exercise
Automerge, browser persistence, actual React rendering, mobile/PWA lifecycle, or
trizum's workload. Upstream tests cited here were inspected as implementation
evidence, not rerun wholesale. No application dependency, source file, or Git
history was changed for this research. The repository change is documentation only.

[packages-core]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/package.json
[packages-react]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/react-fate/package.json
[schema]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client-schema.ts
[client]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client.ts
[client-register]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client.ts#L1007-L1104
[client-query]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client.ts#L3975-L4267
[client-fetch]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client.ts#L5595-L5650
[client-live]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client.ts#L2782-L2979
[client-writes]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client.ts#L2158-L2338
[client-read]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client.ts#L2361-L2634
[state-install]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client-state.ts#L134-L214
[state-memo]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client-state.ts#L448-L548
[state-mutations]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/client-state.ts#L551-L887
[mutations]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/mutation.ts
[identity]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/ref.ts#L15-L28
[store]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/store.ts
[store-delete]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/store.ts#L1521-L1626
[transport]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/transport.ts#L11-L120
[data-view]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/data-view.ts
[core-exports]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/index.ts
[react-exports]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/react-fate/src/index.tsx
[react-client]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/react-fate/src/client.ts
[react-request]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/react-fate/src/useRequest.tsx
[react-view]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/react-fate/src/useView.tsx
[react-snapshots]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/react-fate/src/useViewSnapshots.ts
[client-stub]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/clientStub.ts
[vite]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/vite.ts
[query-tests]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/__tests__/client-query-by-id.test.ts
[state-tests]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/packages/fate/src/__tests__/client-state.test.ts
[client-state-doc]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/docs/guide/client-state.md
[views-doc]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/docs/guide/views.md
[actions-doc]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/docs/guide/actions.md
[live-doc]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/docs/guide/live-views.md
[persistence-doc]: https://github.com/nkzw-tech/fate/blob/2f3c52c2448ca0004d82edbadffa3a5036b92446/docs/guide/persistence.md
