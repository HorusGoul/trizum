---
"@trizum/pwa": major
"@trizum/data": minor
"fate-jazz": minor
---

Migrate the PWA data layer from Automerge documents to Fate views backed by Jazz alpha.

- Adds entity-centric Fate models and mutations for parties, joined party state, participants, expenses, and media files.
- Replaces Automerge document writes in the PWA with Fate-masked reads and Jazz-backed local-first mutations.
- Keeps Fate live views and live list views in sync from Jazz subscriptions, including joined party links and realtime expense editor drafts.
- Preserves cached Fate views during stale-while-revalidate reads so local-first screens do not flash route suspense when data is already available.
- Adds Jazz permission and join-flow support for secondary users to join parties, select their participant identity, and edit shared party data.
- Removes expense chunk persistence in favor of paginated expense list reads.
- Existing Automerge client data is not preserved by this architecture change.
