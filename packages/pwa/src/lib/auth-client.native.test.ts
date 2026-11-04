// @vitest-environment jsdom

import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { Capacitor } from "@capacitor/core";
import { SignInScope, type AppleSignInPlugin } from "@capawesome/capacitor-apple-sign-in";
import { getAuthSettingsCallbackURL, signInWithSocialAuthAccount } from "./auth-client.ts";
import { AUTH_PROVIDER_CONFIG } from "./authConfig.ts";

const initializeApple = vi.fn<AppleSignInPlugin["initialize"]>();
const appleSignIn = vi.fn<AppleSignInPlugin["signIn"]>();
const fetcher = vi.fn<typeof fetch>();
const apple = { initialize: initializeApple, signIn: appleSignIn };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
  vi.stubGlobal("fetch", fetcher);
  initializeApple.mockResolvedValue(undefined);
  appleSignIn.mockResolvedValue({
    authorizationCode: "apple-code",
    idToken: "apple-id-token",
    email: "alex@example.com",
    user: "apple-user",
    givenName: "Alex",
    familyName: "Example",
  });
  fetcher.mockImplementation(async () =>
    Response.json({ redirect: false, url: "https://trizum.app" }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each(["https://trizum.app", "https://preview.example"])(
  "uses the provider callback at %s while keeping post-login navigation separate",
  async (baseURL) => {
    vi.stubEnv("VITE_APP_AUTH_URL", baseURL);
    await signInWithSocialAuthAccount("apple", undefined, apple);
    expect(initializeApple).toHaveBeenCalledWith({
      clientId: AUTH_PROVIDER_CONFIG.apple.serviceId,
    });
    expect(appleSignIn).toHaveBeenCalledWith({
      nonce: expect.any(String),
      redirectUrl: `${baseURL}/api/auth/callback/apple`,
      scopes: [SignInScope.Email],
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = fetcher.mock.calls[0]!;
    const body = await new Response(init?.body).json();
    expect(body).toMatchObject({
      provider: "apple",
      idToken: {
        nonce: appleSignIn.mock.calls[0]?.[0]?.nonce,
        token: "apple-id-token",
        user: { email: "alex@example.com" },
      },
    });
    expect(getAuthSettingsCallbackURL()).toBe(`${baseURL}/settings/cloud-sync`);
  },
);

test("does not submit a backend sign-in when native Apple authorization is cancelled", async () => {
  appleSignIn.mockRejectedValue(new Error("Sign in was canceled."));
  await expect(signInWithSocialAuthAccount("apple", undefined, apple)).rejects.toThrow(
    "Sign in was canceled.",
  );
  expect(fetcher).not.toHaveBeenCalled();
});
