import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { getRouteHref, isNativeAppLink, resolveNativeDeepLink } from "./nativeDeepLinks.ts";

vi.mock("./log.ts", () => ({
  getLogger: () => ({
    warning() {},
  }),
}));

describe("native deep links", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("ignores non-trizum URL schemes", async () => {
    await expect(
      resolveNativeDeepLink(
        "com.googleusercontent.apps.554871818976-adac4tobqolhrgp7e64siieslsc2jf84:/oauth2redirect",
      ),
    ).resolves.toStrictEqual({ isAppLink: false });
  });

  test("routes regular trizum links inside the native app", async () => {
    await expect(
      resolveNativeDeepLink("https://trizum.app/settings/cloud-sync?auth=success#done"),
    ).resolves.toStrictEqual({
      href: "/settings/cloud-sync?auth=success#done",
      isAppLink: true,
    });
  });

  test("verifies magic links through the Worker before routing to the callback", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: true }), {
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveNativeDeepLink(
        "https://trizum.app/api/auth/magic-link/verify?token=secret-token&callbackURL=https%3A%2F%2Ftrizum.app%2Fsettings%2Fcloud-sync%3Fauth%3Dsuccess&errorCallbackURL=https%3A%2F%2Ftrizum.app%2Fsettings%2Fcloud-sync",
      ),
    ).resolves.toStrictEqual({
      href: "/settings/cloud-sync?auth=success",
      isAppLink: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://trizum.app/api/auth/magic-link/verify?token=secret-token");
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).get("accept")).toBe("application/json");
  });

  test("routes failed magic links to the auth error callback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(null, {
            status: 401,
          }),
        ),
      ),
    );

    await expect(
      resolveNativeDeepLink(
        "https://trizum.app/api/auth/magic-link/verify?token=expired-token&callbackURL=https%3A%2F%2Ftrizum.app%2Fsettings%2Fcloud-sync%3Fauth%3Dsuccess&errorCallbackURL=https%3A%2F%2Ftrizum.app%2Fsettings%2Fcloud-sync",
      ),
    ).resolves.toStrictEqual({
      href: "/settings/cloud-sync?error=INVALID_TOKEN",
      isAppLink: true,
    });
  });

  test("converts password reset verifier links into the app reset route", async () => {
    await expect(
      resolveNativeDeepLink(
        "https://trizum.app/api/auth/reset-password/reset-token?callbackURL=https%3A%2F%2Ftrizum.app%2Freset-password",
      ),
    ).resolves.toStrictEqual({
      href: "/reset-password?token=reset-token",
      isAppLink: true,
    });
  });

  test("does not route unsupported auth API links into the SPA", async () => {
    await expect(
      resolveNativeDeepLink("https://trizum.app/api/auth/list-accounts"),
    ).resolves.toStrictEqual({
      isAppLink: true,
    });
  });

  test("keeps route hrefs and native app origin checks explicit", () => {
    expect(isNativeAppLink(new URL("https://trizum.app/join"))).toBe(true);
    expect(isNativeAppLink(new URL("https://example.com/join"))).toBe(false);
    expect(getRouteHref(new URL("https://trizum.app/join?code=abc#top"))).toBe(
      "/join?code=abc#top",
    );
  });
});
