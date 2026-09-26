import { describe, expect, test, vi } from "vite-plus/test";
import { createRememberedAuthSession, createRememberedSessionFetch } from "./rememberedAuthSession";

const alice = { id: "alice", email: "alice@example.com", name: "Alice", emailVerified: true };
const bob = { id: "bob", email: "bob@example.com", name: "Bob", emailVerified: true };

function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  let online = true;
  let nativeTokenAvailable = true;
  const createSession = () =>
    createRememberedAuthSession({
      storage: () => storage,
      isOnline: () => online,
      canRestore: () => nativeTokenAvailable,
    });
  const session = createSession();
  const fetchMock = vi.fn<typeof fetch>();
  const clearToken = vi.fn<() => void>();
  const captureToken = vi.fn<(response: Response, body?: unknown) => void>();
  const fetchAuth = createRememberedSessionFetch({
    session,
    fetch: fetchMock,
    clearToken,
    captureToken,
  });
  const request = (path = "get-session") => fetchAuth(`https://trizum.app/api/auth/${path}`);
  return {
    session,
    createSession,
    values,
    fetchMock,
    request,
    clearToken,
    captureToken,
    setOnline: (value: boolean) => {
      online = value;
      session.connectivityChanged();
    },
    removeNativeToken: () => {
      nativeTokenAvailable = false;
    },
    async signIn() {
      fetchMock.mockResolvedValueOnce(
        Response.json({ user: alice, session: { token: "private-token" } }),
      );
      await request();
    },
  };
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("remembered account continuity", () => {
  test("restores a minimal public account on a cold offline start without persisting session tokens", async () => {
    const app = setup();
    await app.signIn();
    app.setOnline(false);
    const coldStart = app.createSession();
    expect(coldStart.getSnapshot()).toMatchObject({ user: alice, isOffline: true });
    expect([...app.values.values()].join()).not.toContain("private-token");
    expect([...app.values.values()].join()).not.toContain('"session"');
  });

  test("does not restore a native identity after its bearer token is removed", async () => {
    const app = setup();
    await app.signIn();
    app.removeNativeToken();
    expect(app.createSession().getSnapshot().user).toBeNull();
    expect(app.values.size).toBe(0);
  });

  test("retains the same account on network failure and refreshes it after reconnecting", async () => {
    const app = setup();
    await app.signIn();
    app.fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(app.request()).rejects.toThrow("Failed to fetch");
    expect(app.session.getSnapshot()).toMatchObject({ user: alice, isOffline: true });
    app.fetchMock.mockResolvedValueOnce(
      Response.json({ user: { ...alice, name: "Alice updated" } }),
    );
    await app.request();
    expect(app.session.getSnapshot()).toMatchObject({
      user: { name: "Alice updated" },
      isOffline: false,
      error: null,
    });
  });

  test.each([401, 403])(
    "confirmed HTTP %i clears the remembered account even after a network failure",
    async (status) => {
      const app = setup();
      await app.signIn();
      app.fetchMock.mockResolvedValueOnce(new Response(null, { status }));
      await app.request();
      expect(app.session.getSnapshot()).toMatchObject({
        user: null,
        error: null,
        isResolved: true,
      });
      expect(app.createSession().getSnapshot().user).toBeNull();
    },
  );

  test("a successful null session clears cached identity", async () => {
    const app = setup();
    await app.signIn();
    app.fetchMock.mockResolvedValueOnce(Response.json(null));
    await app.request();
    expect(app.session.getSnapshot().user).toBeNull();
    expect(app.values.size).toBe(0);
  });

  test("a server failure is not classified as offline and does not delete remembered identity", async () => {
    const app = setup();
    await app.signIn();
    app.fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await app.request();
    expect(app.session.getSnapshot()).toMatchObject({ user: alice, isOffline: false });
    expect(app.session.getSnapshot().error).toBeInstanceOf(Error);
  });

  test("sign-out clears identity immediately even when offline, and ignores an old session response", async () => {
    const app = setup();
    await app.signIn();
    const pending = deferredResponse();
    app.fetchMock.mockReturnValueOnce(pending.promise);
    const oldSession = app.request();
    app.fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(app.request("sign-out")).rejects.toThrow("Failed to fetch");
    expect(app.session.getSnapshot().user).toBeNull();
    expect(app.clearToken).toHaveBeenCalledOnce();
    pending.resolve(Response.json({ user: alice }));
    await oldSession;
    expect(app.session.getSnapshot().user).toBeNull();
    expect(app.createSession().getSnapshot().user).toBeNull();
    expect(app.captureToken).toHaveBeenCalledTimes(1);
  });

  test("does not resurrect a signed-out account from a later refetch", async () => {
    const app = setup();
    await app.signIn();
    app.fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await app.request("sign-out");
    app.fetchMock.mockResolvedValueOnce(Response.json({ user: alice }));
    await app.request();
    expect(app.session.getSnapshot().user).toBeNull();
  });

  test("beginning an account switch immediately removes old identity, then persists only the new account", async () => {
    const app = setup();
    await app.signIn();
    const oldResponse = deferredResponse();
    app.fetchMock.mockReturnValueOnce(oldResponse.promise);
    const oldRequest = app.request();
    const signInResponse = deferredResponse();
    app.fetchMock.mockReturnValueOnce(signInResponse.promise);
    const signingIn = app.request("sign-in/email");
    expect(app.session.getSnapshot().user).toBeNull();
    expect(app.values.size).toBe(0);
    signInResponse.resolve(Response.json({ user: bob }));
    await signingIn;
    oldResponse.resolve(Response.json({ user: alice }));
    await oldRequest;
    expect(app.session.getSnapshot().user).toMatchObject(bob);
    expect(app.createSession().getSnapshot().user).toMatchObject(bob);
  });

  test("failed account switching cannot restore the previous cached account", async () => {
    const app = setup();
    await app.signIn();
    app.fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await app.request("sign-in/email");
    expect(app.session.getSnapshot().user).toBeNull();
    expect(app.createSession().getSnapshot().user).toBeNull();
  });

  test("older session responses cannot replace a newer confirmed session", async () => {
    const app = setup();
    await app.signIn();
    const older = deferredResponse();
    app.fetchMock.mockReturnValueOnce(older.promise);
    const olderRequest = app.request();
    app.fetchMock.mockResolvedValueOnce(Response.json(null));
    await app.request();
    older.resolve(Response.json({ user: alice }));
    await olderRequest;
    expect(app.session.getSnapshot().user).toBeNull();
  });

  test("successful account deletion removes the remembered account", async () => {
    const app = setup();
    await app.signIn();
    app.fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await app.request("delete-user");
    expect(app.session.getSnapshot().user).toBeNull();
    expect(app.createSession().getSnapshot().user).toBeNull();
    expect(app.clearToken).toHaveBeenCalledOnce();
  });

  test("restricted storage does not prevent in-memory offline continuity", () => {
    const session = createRememberedAuthSession({
      storage: () => {
        throw new Error("Denied");
      },
    });
    session.accept(session.beginRequest(), { user: alice });
    session.reject(session.beginRequest());
    expect(session.getSnapshot()).toMatchObject({ user: alice, isOffline: true });
  });
});

describe("external sign-in completion and invalid responses", () => {
  test.each(["sign-in/magic-link", "sign-in/social"])(
    "allows a confirmed session after %s completes externally",
    async (path) => {
      const app = setup();
      app.fetchMock.mockResolvedValueOnce(Response.json({ status: true, redirect: true }));
      await app.request(path);
      app.fetchMock.mockResolvedValueOnce(Response.json({ user: alice }));
      await app.request();
      expect(app.session.getSnapshot().user).toMatchObject(alice);
    },
  );

  test.each([{}, { user: { email: "incomplete@example.com" } }])(
    "does not revoke identity on malformed success body %j",
    async (body) => {
      const app = setup();
      await app.signIn();
      app.fetchMock.mockResolvedValueOnce(Response.json(body));
      await app.request();
      expect(app.session.getSnapshot().user).toMatchObject(alice);
      expect(app.session.getSnapshot().error).toBeInstanceOf(Error);
    },
  );

  test("first offline launch with no previous account reports unavailable", () => {
    const app = setup();
    app.setOnline(false);
    const coldStart = app.createSession().getSnapshot();
    expect(coldStart.user).toBeNull();
    expect(coldStart.isOffline).toBe(true);
    expect(coldStart.error).toBeInstanceOf(Error);
  });
});

describe("account changes in other browser tabs", () => {
  test("another tab signing out invalidates the in-memory identity and pending reads", async () => {
    const app = setup();
    await app.signIn();
    const storageKey = [...app.values.keys()][0]!;
    const request = app.session.beginRequest();
    app.session.storageChanged(storageKey, null);
    app.session.accept(request, { user: alice });
    expect(app.session.getSnapshot().user).toBeNull();
    // A logout request may still be clearing the shared cookie in the other tab.
    app.session.accept(app.session.beginRequest(), { user: alice });
    expect(app.session.getSnapshot().user).toBeNull();
  });

  test("another tab signing in replaces the remembered display account and permits revalidation", async () => {
    const app = setup();
    await app.signIn();
    const storageKey = [...app.values.keys()][0]!;
    expect(app.session.storageChanged(storageKey, JSON.stringify(bob))).toBe(true);
    expect(app.session.getSnapshot().user).toMatchObject(bob);
    app.session.accept(app.session.beginRequest(), null);
    expect(app.session.getSnapshot().user).toBeNull();
  });

  test("unrelated storage changes leave the remembered account intact", async () => {
    const app = setup();
    await app.signIn();
    app.session.storageChanged("other-setting", null);
    expect(app.session.getSnapshot().user).toMatchObject(alice);
  });
});
