import type { AuthSessionUser } from "./auth-client";

const STORAGE_KEY = "trizumRememberedAccount.v1";

type AccountStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface RememberedSessionState {
  user: AuthSessionUser | null;
  error: Error | null;
  isOffline: boolean;
  isResolved: boolean;
}

/** A display identity, never proof of authorization for a server operation. */
export function createRememberedAuthSession({
  storage,
  canRestore = () => true,
  isOnline = () => true,
}: {
  storage: () => AccountStorage | undefined;
  canRestore?: () => boolean;
  isOnline?: () => boolean;
}) {
  const listeners = new Set<() => void>();
  let generation = 0;
  let requestId = 0;
  let appliedRequestId = 0;
  let acceptingSessions = true;
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

  function clear() {
    generation += 1;
    acceptingSessions = false;
    persist(null);
    update({ user: null, error: null, isOffline: !isOnline(), isResolved: true });
  }

  return {
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    clear,
    connectivityChanged(this: void) {
      update({ ...state, isOffline: !isOnline() || state.isOffline });
    },
    storageChanged(key: string | null, value: string | null) {
      if (key !== null && key !== STORAGE_KEY) return false;
      generation += 1;
      let user: AuthSessionUser | null = null;
      try {
        user = value && canRestore() ? readUser(JSON.parse(value)) : null;
      } catch {
        // Invalid or removed data from another tab must not retain an old identity.
      }
      acceptingSessions = Boolean(user);
      update({ user, error: null, isOffline: !isOnline(), isResolved: true });
      return Boolean(user);
    },
    beginRequest() {
      return { generation, id: ++requestId };
    },
    isCurrent(request: { generation: number; id: number }) {
      return request.generation === generation && request.id >= appliedRequestId;
    },
    canAcceptSession(request: { generation: number; id: number }) {
      return this.isCurrent(request) && acceptingSessions;
    },
    accept(request: { generation: number; id: number }, body: unknown, signingIn = false) {
      if (!this.isCurrent(request) || (!acceptingSessions && !signingIn)) return;
      const user = readUser(body);
      if (signingIn && !user) {
        // Magic-link requests and browser OAuth redirects finish authentication later.
        acceptingSessions = true;
        return;
      }
      if (body !== null && !user) {
        this.reject(request, 502);
        return;
      }
      acceptingSessions = true;
      appliedRequestId = request.id;
      persist(user);
      update({ user, error: null, isOffline: !isOnline(), isResolved: true });
    },
    reject(request: { generation: number; id: number }, status?: number) {
      if (!this.isCurrent(request) || !acceptingSessions) return;
      appliedRequestId = request.id;
      if (status === 401 || status === 403) {
        persist(null);
        update({ user: null, error: null, isOffline: !isOnline(), isResolved: true });
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
    },
  };
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

export function createRememberedSessionFetch({
  session,
  fetch: fetchRequest,
  clearToken,
  captureToken,
}: {
  session: ReturnType<typeof createRememberedAuthSession>;
  fetch: typeof fetch;
  clearToken: () => void;
  captureToken: (response: Response, body?: unknown) => void;
}): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const sessionRequest = url.pathname.endsWith("/get-session");
    const signingIn =
      /\/(sign-in|sign-up)\//.test(url.pathname) || url.pathname.endsWith("/magic-link/verify");
    const signingOut = url.pathname.endsWith("/sign-out");
    const deletingAccount = url.pathname.endsWith("/delete-user");
    if (signingIn || signingOut) {
      session.clear();
      clearToken();
    }
    const request = session.beginRequest();
    let response: Response;
    try {
      response = await fetchRequest(input, init);
    } catch (error) {
      if (sessionRequest) session.reject(request);
      throw error;
    }
    if (!session.isCurrent(request)) return response;
    if (response.ok) {
      if (deletingAccount) {
        session.clear();
        clearToken();
      } else if (!signingOut) {
        if (sessionRequest || signingIn) {
          const body: unknown = await response
            .clone()
            .json()
            .catch(() => undefined);
          if (!session.isCurrent(request)) return response;
          if (signingIn || session.canAcceptSession(request)) captureToken(response, body);
          // A malformed success body is not evidence that the user signed out.
          if (body !== undefined) session.accept(request, body, signingIn);
          else if (sessionRequest) session.reject(request, 502);
        } else {
          captureToken(response);
        }
      }
    } else if (sessionRequest) {
      session.reject(request, response.status);
    }
    return response;
  };
}
