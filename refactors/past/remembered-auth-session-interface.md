# Remembered authentication session interface

## Public interface

Keep request ordering, response validation, and remembered identity transitions in
`packages/pwa/src/lib/rememberedAuthSession.ts`. The identity remains display data;
server operations continue to require the native bearer token or browser cookie.

Before:

```ts
const session = createRememberedAuthSession({ storage, canRestore, isOnline });
const fetchAuth = createRememberedSessionFetch({ session, fetch, clearToken, captureToken });
// The fetch wrapper must call these in the correct order:
session.beginRequest();
session.isCurrent(request);
session.canAcceptSession(request);
session.accept(request, body, signingIn);
session.reject(request, status);
```

After:

```ts
const session = createRememberedAuthSession({
  storage,
  canRestore,
  isOnline,
  fetch: fetchRequest,
  clearToken,
  captureToken,
});
const fetchAuth = session.fetch;
// Remaining public methods serve React subscriptions and external invalidation.
return {
  fetch: fetchAuth,
  subscribe,
  getSnapshot: () => state,
  clear,
  connectivityChanged,
  storageChanged,
};
```

## Private request ordering and transitions

Before:

```ts
let generation = 0;
let requestId = 0;
let appliedRequestId = 0;
let acceptingSessions = true;
// Object methods depend on this.isCurrent and this.reject.
```

After:

```ts
let nextRequestId = 0;
let oldestAcceptedRequestId = 0;
let sessionReadsBlocked = false;
function invalidatePendingRequests() {
  oldestAcceptedRequestId = ++nextRequestId;
}
function isCurrent(requestId: number) {
  return requestId >= oldestAcceptedRequestId;
}
function confirmUser(user: AuthSessionUser | null) {
  persist(user);
  update({ user, error: null, isOffline: !isOnline(), isResolved: true });
}
function clear() {
  invalidatePendingRequests();
  sessionReadsBlocked = true;
  confirmUser(null);
}
function recordFailure(requestId: number, status?: number) {
  if (!isCurrent(requestId) || sessionReadsBlocked) return;
  oldestAcceptedRequestId = requestId;
  if (status === 401 || status === 403) return confirmUser(null);
  update({
    ...state,
    error: new Error(status ? `Session request failed (${status})` : "Session network unavailable"),
    isOffline: status === undefined || !isOnline(),
    isResolved: true,
  });
}
```

A successful explicit sign-in unblocks session reads. Successful magic-link email
requests and social redirects unblock the later completion read without inventing a
user. Invalid JSON preserves the existing account. Explicit sign-out, account
switching, native token removal, and storage events invalidate pending responses.
Storage events keep their existing parsing and revalidation return value.

## Fetch control flow

Before: nested successful-response branches and calls back into the public store.

After: private `getAuthOperation(input)` returns `session`, `sign-in`, `sign-out`,
`delete-account`, or `other`, based on the current endpoint rules:

```ts
function getAuthOperation(input: RequestInfo | URL) {
  const { pathname } = new URL(input instanceof Request ? input.url : input.toString());
  if (pathname.endsWith("/get-session")) return "session";
  if (/\/(sign-in|sign-up)\//.test(pathname) || pathname.endsWith("/magic-link/verify")) {
    return "sign-in";
  }
  if (pathname.endsWith("/sign-out")) return "sign-out";
  if (pathname.endsWith("/delete-user")) return "delete-account";
  return "other";
}
```

In `fetchAuth`:

```ts
const operation = getAuthOperation(input);
if (operation === "sign-in" || operation === "sign-out") {
  clear();
  clearToken();
}
const requestId = ++nextRequestId;
// Fetch failures update only session reads; preserve the thrown fetch error.
// Ignore stale responses before any token or identity side effect.
// Failed session reads call recordFailure; other failures return unchanged.
// Successful deletion clears identity and token; sign-out returns unchanged.
// Other endpoints capture token headers and return unchanged.
// Parse session/sign-in response JSON, then check requestId again.
// A blocked session read returns unchanged.
// Capture token, allow a valid sign-in completion, reject malformed sessions,
// advance oldestAcceptedRequestId and confirmUser on an authoritative response.
```

## Wiring and tests

Before: singleton creation and fetch wrapping are separate calls in `authSession.ts`.
After: pass the existing native token callbacks into the session factory and export
`fetchAuth = rememberedSession.fetch`. Keep the React hook and native token module
unchanged.

Tests replace direct `accept`/`reject`/`beginRequest` calls with mocked fetch
responses. Keep the real auth-client/native-magic-link tests intact. Verify offline
restoration, token absence, account switching, sign-out, authoritative null and
401/403 and later recovery, stale responses including sign-out during JSON decoding,
malformed JSON, storage events, and restricted storage.

Validation: focused remembered-session and native-auth tests, followed by root
check, test, and build. Move this document to `refactors/past/` after validation.
