import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock("./log.ts", () => ({ getLogger: () => ({ warning() {} }) }));

const user = { id: "magic-link-user", email: "alex@example.com", name: "Alex" };
const magicLink = "https://trizum.app/api/auth/magic-link/verify?token=test-magic-link";

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("native magic-link session completion", () => {
  const storage = new Map<string, string>();
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.resetModules();
    storage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  test("accepts a link requested elsewhere after signing out without restarting", async () => {
    const { authClient } = await import("./auth-client.ts");
    const { getNativeAuthToken, setNativeAuthToken } = await import("./nativeAuthSession.ts");
    const { resolveNativeDeepLink } = await import("./nativeDeepLinks.ts");
    setNativeAuthToken("old-session");
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await authClient.signOut();
    expect(getNativeAuthToken()).toBeUndefined();

    fetchMock.mockResolvedValueOnce(
      Response.json(
        { user, token: "new-session" },
        { headers: { "set-auth-token": "new-session" } },
      ),
    );
    await expect(resolveNativeDeepLink(magicLink)).resolves.toMatchObject({
      href: "/settings/cloud-sync?auth=success",
    });
    expect(getNativeAuthToken()).toBe("new-session");

    fetchMock.mockResolvedValueOnce(Response.json({ user, session: { userId: user.id } }));
    await authClient.getSession();
    expect(JSON.parse(storage.get("trizumRememberedAccount.v1") ?? "null")).toMatchObject(user);
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer new-session");
  });

  test("ignores verification that finishes after another sign-out", async () => {
    const { authClient } = await import("./auth-client.ts");
    const { rememberedSession } = await import("./authSession.ts");
    const { getNativeAuthToken } = await import("./nativeAuthSession.ts");
    const { resolveNativeDeepLink } = await import("./nativeDeepLinks.ts");
    const verification = deferredResponse();
    fetchMock.mockReturnValueOnce(verification.promise);
    const resolving = resolveNativeDeepLink(magicLink);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await authClient.signOut();
    verification.resolve(
      Response.json({ user }, { headers: { "set-auth-token": "late-session" } }),
    );
    await resolving;

    expect(getNativeAuthToken()).toBeUndefined();
    expect(rememberedSession.getSnapshot().user).toBeNull();
    fetchMock.mockResolvedValueOnce(Response.json({ user, session: { userId: user.id } }));
    await authClient.getSession();
    expect(rememberedSession.getSnapshot().user).toBeNull();
  });

  test("keeps the verified account when an older session read finishes afterward", async () => {
    const { authClient } = await import("./auth-client.ts");
    const { rememberedSession } = await import("./authSession.ts");
    const { getNativeAuthToken } = await import("./nativeAuthSession.ts");
    const { resolveNativeDeepLink } = await import("./nativeDeepLinks.ts");
    const oldSession = deferredResponse();
    fetchMock.mockReturnValueOnce(oldSession.promise);
    const reading = authClient.getSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    fetchMock.mockResolvedValueOnce(
      Response.json({ user }, { headers: { "set-auth-token": "verified-session" } }),
    );
    await resolveNativeDeepLink(magicLink);
    oldSession.resolve(
      Response.json(
        { user: { id: "old-user", email: "old@example.com" } },
        { headers: { "set-auth-token": "old-session" } },
      ),
    );
    await reading;
    expect(getNativeAuthToken()).toBe("verified-session");
    expect(rememberedSession.getSnapshot().user).toMatchObject(user);
  });
});
