---
name: automerge-testing
description: Add or review real-document round-trip tests for trizum Automerge models, forms, serializers, migrations, and write helpers. Use when changing persisted document shapes or read/edit/write paths, especially nested maps or lists and copying between documents. Pure styling and transient React state do not need this workflow.
---

# Automerge persistence testing

A serializer can produce the expected object and still fail when written into
Automerge. Spreading a document object retains its nested document-owned values;
even an empty map can trigger `Cannot create a reference to an existing document
object`. Test the persistence boundary, including existing save paths affected by
a new nested field.

## Exercise the real round trip

- Create a real in-memory `Repo` with `network: []` and seed the relevant document
  shape. Read the starting values from `handle.doc()`, as the application does.
  Plain fixtures alone do not reproduce document ownership restrictions.
- Pass those values through the production edit and serialization path. Use the
  real `FormApi` or rendered form when form updates or resets are part of the
  path. Do not pre-detach document values in test setup with JSON conversion,
  cloning, or extra spreads that the application does not perform.
- Call the production mutation helper and inspect the resulting document. For
  a serializer whose caller directly assigns its output in `handle.change`,
  exercising that exact assignment is sufficient; do not invent a second
  implementation of the save logic in the test.
- Assert the saved edit, preservation of unrelated fields, and intended deletion
  semantics. An object-equality assertion before the write, or a mocked
  `Repo`, `DocHandle`, or `change` callback, does not cover this boundary.
- Shut down each repo and clean up mounted forms, roots, and subscriptions using
  the existing test harness conventions. Keep external I/O at its service seam.

## Choose cases from the changed behavior

For a new or changed nested field, cover legacy absence, an explicitly empty
container, and populated data when the model supports those states. Include
`null` only where the model allows it. Preserve missing versus empty when that
distinction controls fallback or removal; never write an explicit `undefined`
property into Automerge.

Also exercise an existing operation that carries the nested value unchanged,
such as renaming a participant. Test adding, removing, or archiving records when
those paths are affected. Testing only creation of a fresh plain object misses
the failure when editing an existing document. For changed form reset or repeated
save behavior, read the saved document and edit/save it again.

When a value moves between documents, use real source and destination documents.
When changing concurrency or conflict behavior, exercise the relevant changes
and merge with real Automerge handles. When changing durability or when a save
is acknowledged, test flushing and reopening through the storage boundary.
These additional boundaries apply when affected, not to every persistence test.

For an ownership-error fix, run the regression against the failing path before
the fix and confirm it passes afterward. Fix the production boundary by
detaching the required nested values or updating the existing draft in place;
do not hide the bug by sanitizing only the test fixture or applying blanket JSON
cloning that changes domain values.

## Existing examples and validation

Extend nearby tests rather than introducing a parallel test harness:

- [Participant form round trip](../../../packages/pwa/src/routes/party_.$partyId.settings/-components/toPartyParticipantRecord.test.ts):
  real FormApi and document writes for absent, empty, and populated nested maps.
- [Settings propagation](../../../packages/pwa/src/lib/data/profileMutations.test.tsx):
  real source/destination documents and assertions on the destination state.
- [Party mutation tests](../../../packages/pwa/src/lib/data/partyCommands.test.ts):
  production mutation helpers and storage reopening for acknowledged saves.

Run the focused regression, then follow
[workspace validation](../../../docs/agents/validation-and-releases.md).
In the implementation or review summary, identify the read/edit/write path and
the document states covered; do not describe pure-object tests as persistence
coverage.
