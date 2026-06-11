# fate-jazz

Reusable Fate adapter helpers for Jazz alpha.

This package deliberately has no Trizum model knowledge. Apps provide entity
definitions, list roots, mutations, and their own Jazz app schema. The package
handles the common integration pieces:

- resolving local-first, anonymous guest, JWT, or cookie auth into Jazz DB
  config;
- creating a Jazz DB with the resolved auth;
- projecting Jazz rows to Fate entities with field masking;
- exposing a generic Jazz DB repository through a Fate transport.

The default auth mode is `localFirstUser`, backed by Jazz's `secret` option.
Use `anonymousGuest` only for explicit guest or read-limited sessions.
