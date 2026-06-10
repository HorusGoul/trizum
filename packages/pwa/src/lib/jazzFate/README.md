# Jazz Fate data layer PoC

This folder is an experimental data layer spike. It does not replace the current
Automerge runtime yet.

The PoC keeps Fate as the client API:

- screens declare data through `view(...)`, `client.request(...)`, list roots,
  and `client.mutations.*`;
- Fate owns view references and masking;
- the transport delegates reads and writes to a Jazz alpha repository.

Jazz alpha provides the storage and sync direction:

- `schema.defineApp(...)` models Trizum data as entity tables;
- `definePermissions(...)` attaches row policies to the Jazz wasm schema;
- `createLocalFirstJazzFateClient()` creates a Jazz `Db` and wraps it in a Fate
  client;
- the default auth mode is a Trizum local-first user backed by Jazz's `secret`
  option, so people can use the app without an account while retaining a durable
  local identity.

Use Jazz `anonymous` mode only for explicit guest/read-limited sessions. For the
normal no-account product path, use `mode: "localFirstUser"` or omit `auth`.

Full account opt-in should pass `mode: "externalAccount"` with a Jazz-compatible
JWT, or `mode: "cookieAccount"` with a mirrored Jazz session. A later migration
can decide whether account upgrade preserves the local-first secret as a backup
identity or replaces it with external auth.
