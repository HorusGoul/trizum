# @trizum/data

Trizum's local-first data model for the Jazz alpha PoC.

This package owns Trizum-specific tables, row policies, Fate views, mutations,
and client roots. The reusable Jazz/Fate adapter code lives in `fate-jazz`, so
the model package can evolve independently from the PWA runtime.

The Jazz model surface currently covers users, parties, party memberships,
joined party list entries, participants, media files, and expenses. Expenses are
intended to use Jazz list pagination instead of carrying the PWA's Automerge
expense chunk optimization into the target model.

The default no-account path is a local-first Jazz user. Full accounts can opt in
later through JWT or cookie-backed Jazz auth without changing the Fate client API
that screens consume.
