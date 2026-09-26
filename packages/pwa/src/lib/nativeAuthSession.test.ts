import { Capacitor } from "@capacitor/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import {
  clearNativeAuthToken,
  fetchWithNativeAuth,
  getNativeAuthHeaders,
  getNativeAuthToken,
  setNativeAuthToken,
  setNativeAuthTokenFromResponse,
  subscribeNativeAuthTokenClear,
} from "./nativeAuthSession.ts";

describe("native auth session", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();

    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });

  afterEach(() => {
    clearNativeAuthToken();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("stores native auth tokens and adds bearer headers", () => {
    setNativeAuthToken("session-token");

    expect(getNativeAuthToken()).toBe("session-token");
    expect(getNativeAuthHeaders().get("authorization")).toBe("Bearer session-token");
  });

  test("does not replace an explicit authorization header", () => {
    setNativeAuthToken("session-token");

    const headers = getNativeAuthHeaders({
      authorization: "Bearer explicit-token",
    });

    expect(headers.get("authorization")).toBe("Bearer explicit-token");
  });

  test("captures exposed auth tokens from responses", () => {
    setNativeAuthTokenFromResponse(
      new Response(null, {
        headers: {
          "set-auth-token": "response-token",
        },
      }),
    );

    expect(getNativeAuthToken()).toBe("response-token");
  });

  test("keeps existing tokens when a response has no auth token header", () => {
    setNativeAuthToken("session-token");
    setNativeAuthTokenFromResponse(new Response(null));

    expect(getNativeAuthToken()).toBe("session-token");
  });

  test("fetches with credentials and captures response auth tokens", async () => {
    const fetchMock = vi.fn<typeof fetch>((_, init) => {
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer session-token");

      return Promise.resolve(
        new Response(null, {
          headers: {
            "set-auth-token": "new-session-token",
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    setNativeAuthToken("session-token");

    await fetchWithNativeAuth("https://trizum.app/api/cloud-sync/settings");

    expect(getNativeAuthToken()).toBe("new-session-token");
  });

  test("notifies remembered identity when a native token is explicitly cleared", () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeNativeAuthTokenClear(listener);
    setNativeAuthToken("session-token");
    expect(listener).not.toHaveBeenCalled();
    clearNativeAuthToken();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  test("ignores a token from an in-flight response after sign-out", async () => {
    let complete!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      complete = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => response),
    );
    setNativeAuthToken("old-token");
    const request = fetchWithNativeAuth("https://trizum.app/api/cloud-sync/settings");
    clearNativeAuthToken();
    complete(new Response(null, { headers: { "set-auth-token": "old-token" } }));
    await request;
    expect(getNativeAuthToken()).toBeUndefined();
  });

  test("ignores an older response after switching native accounts", async () => {
    let complete!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      complete = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => response),
    );
    setNativeAuthToken("alice-token");
    const request = fetchWithNativeAuth("https://trizum.app/api/cloud-sync/settings");
    clearNativeAuthToken();
    setNativeAuthToken("bob-token");
    complete(new Response(null, { headers: { "set-auth-token": "alice-token" } }));
    await request;
    expect(getNativeAuthToken()).toBe("bob-token");
  });
});
