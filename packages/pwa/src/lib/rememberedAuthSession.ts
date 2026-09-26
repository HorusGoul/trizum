import type { AuthSessionUser } from "./auth-client";

const STORAGE_KEY = "trizumRememberedAccount.v1";

type AccountStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface RememberedSessionState {
  user: AuthSessionUser | null;
  error: Error | null;
  isOffline: boolean;
  isResolved: boolean;
}

/** Owns auth fetches and a remembered display identity, never server authorization. */
export function createRememberedAuthSession({
  storage,
  canRestore = () => true,
  isOnline = () => true,
  fetch: fetchRequest,
  clearToken,
  captureToken,
}: {
  storage: () => AccountStorage | undefined;
  canRestore?: () => boolean;
  isOnline?: () => boolean;
  fetch: typeof fetch;
  clearToken: () => void;
  captureToken: (response: Response, body?: unknown) => void;
}) {
  const listeners = new Set<() => void>();
  let nextRequestId = 0;
  // Applying a response rejects older reads; invalidation also rejects every pending request.
  let oldestAcceptedRequestId = 0;
  // Explicit sign-out blocks even fresh reads until sign-in succeeds. A server null/401/403
  // only clears the identity, allowing subsequent reads to discover a valid session.
  let sessionReadsBlocked = false;
  let state: RememberedSessionState = {
    user: restoreUser(),
    error: isOnline() ? null : new Error("Session network unavailable"),
    isOffline: !isOnline(),
    isResolved: false,
  };

  function restoreUser() {
    try {
      if (!canRestore()) {
        storage()?.removeItem(STORAGE_KEY);
        return null;
      }
      const stored = storage()?.getItem(STORAGE_KEY);
      return stored ? readUser(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  }

  function update(next: RememberedSessionState) {
    state = next;
    for (const listener of listeners) listener();
  }

  function persist(user: AuthSessionUser | null) {
    try {
      if (user) storage()?.setItem(STORAGE_KEY, JSON.stringify(user));
      else storage()?.removeItem(STORAGE_KEY);
    } catch {
      // Account continuity is best effort when device storage is unavailable.
    }
  }

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
    if (status === 401 || status === 403) {
      confirmUser(null);
      return;
    }
    update({
      ...state,
      error: new Error(
        status ? `Session request failed (${status})` : "Session network unavailable",
      ),
      isOffline: status === undefined || !isOnline(),
      isResolved: true,
    });
  }

  const fetchAuth: typeof fetch = async (input, init) => {
    const operation = getAuthOperation(input);
    if (operation === "sign-in" || operation === "sign-out") {
      clear();
      clearToken();
    }
    const requestId = ++nextRequestId;
    let response: Response;
    try {
      response = await fetchRequest(input, init);
    } catch (error) {
      if (operation === "session") recordFailure(requestId);
      throw error;
    }
    if (!isCurrent(requestId)) return response;
    if (!response.ok) {
      if (operation === "session") recordFailure(requestId, response.status);
      return response;
    }
    if (operation === "sign-out") return response;
    if (operation === "delete-account") {
      clear();
      clearToken();
      return response;
    }
    if (operation === "other") {
      captureToken(response);
      return response;
    }
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined);
    if (!isCurrent(requestId)) return response;
    if (operation === "session" && sessionReadsBlocked) return response;
    captureToken(response, body);
    if (body === undefined) {
      // A malformed success body is not evidence that the user signed out.
      if (operation === "session") recordFailure(requestId, 502);
      return response;
    }
    const user = readUser(body);
    if (operation === "sign-in" && !user) {
      // Magic-link requests and browser OAuth redirects finish authentication later.
      sessionReadsBlocked = false;
      return response;
    }
    if (body !== null && !user) {
      recordFailure(requestId, 502);
      return response;
    }
    sessionReadsBlocked = false;
    oldestAcceptedRequestId = requestId;
    confirmUser(user);
    return response;
  };

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function connectivityChanged() {
    update({ ...state, isOffline: !isOnline() || state.isOffline });
  }

  function storageChanged(key: string | null, value: string | null) {
    if (key !== null && key !== STORAGE_KEY) return false;
    invalidatePendingRequests();
    let user: AuthSessionUser | null = null;
    try {
      user = value && canRestore() ? readUser(JSON.parse(value)) : null;
    } catch {
      // Invalid or removed data from another tab must not retain an old identity.
    }
    sessionReadsBlocked = !user;
    update({ user, error: null, isOffline: !isOnline(), isResolved: true });
    return Boolean(user);
  }

  return {
    fetch: fetchAuth,
    subscribe,
    getSnapshot: () => state,
    clear,
    connectivityChanged,
    storageChanged,
  };
}

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

/** Persist only the public user fields used by the UI, never the session or bearer token. */
function readUser(value: unknown): AuthSessionUser | null {
  if (!value || typeof value !== "object") return null;
  const candidate = "user" in value ? value.user : value;
  if (!candidate || typeof candidate !== "object") return null;
  const user = candidate as Record<string, unknown>;
  if (typeof user.id !== "string" || !user.id || typeof user.email !== "string") return null;
  const createdAt = new Date(typeof user.createdAt === "string" ? user.createdAt : 0);
  const updatedAt = new Date(typeof user.updatedAt === "string" ? user.updatedAt : 0);
  return {
    id: user.id,
    email: user.email,
    name: typeof user.name === "string" ? user.name : "",
    emailVerified: user.emailVerified === true,
    image: typeof user.image === "string" ? user.image : null,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0) : createdAt,
    updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date(0) : updatedAt,
  };
}
