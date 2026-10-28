import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import type { AppleSignInPlugin } from "@capawesome/capacitor-apple-sign-in";

const { initializeApple, appleSignIn, socialSignIn } = vi.hoisted(() => ({
  initializeApple: vi.fn<AppleSignInPlugin["initialize"]>(),
  appleSignIn: vi.fn<AppleSignInPlugin["signIn"]>(),
  socialSignIn: vi.fn<(request: unknown) => Promise<unknown>>(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
}));
vi.mock("@capawesome/capacitor-apple-sign-in", () => ({
  AppleSignIn: { initialize: initializeApple, signIn: appleSignIn },
  SignInScope: { Email: "email" },
}));
vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({ signIn: { social: socialSignIn } }),
}));

import { getAuthSettingsCallbackURL, signInWithSocialAuthAccount } from "./auth-client.ts";
import { AUTH_PROVIDER_CONFIG } from "./authConfig.ts";

beforeEach(() => {
  vi.clearAllMocks();
  initializeApple.mockResolvedValue(undefined);
  appleSignIn.mockResolvedValue({
    authorizationCode: "apple-code",
    idToken: "apple-id-token",
    email: "alex@example.com",
    user: "apple-user",
    givenName: "Alex",
    familyName: "Example",
  });
  socialSignIn.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test.each(["https://trizum.app", "https://preview.example"])(
  "uses the provider callback at %s while keeping post-login navigation separate",
  async (baseURL) => {
    vi.stubEnv("VITE_APP_AUTH_URL", baseURL);
    await signInWithSocialAuthAccount("apple");

    expect(initializeApple).toHaveBeenCalledWith({
      clientId: AUTH_PROVIDER_CONFIG.apple.serviceId,
    });
    expect(appleSignIn).toHaveBeenCalledWith({
      nonce: expect.any(String),
      redirectUrl: `${baseURL}/api/auth/callback/apple`,
      scopes: ["email"],
    });
    expect(socialSignIn).toHaveBeenCalledWith({
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

  await expect(signInWithSocialAuthAccount("apple")).rejects.toThrow("Sign in was canceled.");
  expect(socialSignIn).not.toHaveBeenCalled();
});
