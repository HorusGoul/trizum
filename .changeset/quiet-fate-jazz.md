---
"@trizum/pwa": major
"@trizum/data": minor
"fate-jazz": minor
---

Migrate the PWA data layer from Automerge documents to Fate views backed by Jazz alpha.

- Adds entity-centric Fate models and mutations for parties, joined party state, participants, expenses, and media files.
- Replaces Automerge document writes in the PWA with Fate-masked reads and Jazz-backed local-first mutations.
- Removes expense chunk persistence in favor of paginated expense list reads.
- Existing Automerge client data is not preserved by this architecture change.
