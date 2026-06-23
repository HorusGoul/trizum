import { Capacitor } from "@capacitor/core";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { AUTH_PROVIDER_CONFIG } from "./authConfig";
import {
  clearNativeAuthToken,
  fetchWithNativeAuth,
  getNativeAuthHeaders,
  setNativeAuthToken,
  setNativeAuthTokenFromResponse,
} from "./nativeAuthSession";

export interface LinkedAuthAccount {
  accountId: string;
  createdAt: string | Date;
  id: string;
  providerId: string;
  scopes?: string[];
  updatedAt: string | Date;
  userId: string;
}

export type SocialAuthProvider = "apple" | "google";

interface NativeSocialIdToken {
  accessToken?: string;
  nonce?: string;
  scopes?: string[];
  token: string;
  user?: {
    email?: string;
  };
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  fetchOptions: {
    credentials: "include",
    onRequest(context) {
      return {
        ...context,
        headers: getNativeAuthHeaders(context.headers),
      };
    },
    onResponse(context) {
      setNativeAuthTokenFromResponse(context.response);
    },
  },
  plugins: [magicLinkClient()],
});

type AuthSession = ReturnType<typeof authClient.useSession>;

export type AuthSessionUser = NonNullable<NonNullable<AuthSession["data"]>["user"]>;

export function getAuthBaseURL() {
  if (import.meta.env.VITE_APP_AUTH_URL) {
    return import.meta.env.VITE_APP_AUTH_URL;
  }

  if (Capacitor.isNativePlatform()) {
    return "https://trizum.app";
  }

  return window.location.origin;
}

export function getAuthSettingsCallbackURL(searchParams?: Record<string, string | undefined>) {
  const url = new URL(
    "/settings/cloud-sync",
    Capacitor.isNativePlatform() ? getAuthBaseURL() : window.location.origin,
  );

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  if (Capacitor.isNativePlatform()) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
}

export function getAuthResetPasswordCallbackURL() {
  if (Capacitor.isNativePlatform()) {
    return new URL("/reset-password", getAuthBaseURL()).toString();
  }

  return "/reset-password";
}

export async function fetchLinkedAuthAccounts() {
  const response = await fetchWithNativeAuth(getAuthEndpointURL("/list-accounts"));

  if (!response.ok) {
    throw new Error(await getAuthErrorMessage(response, "Could not load sign-in methods."));
  }

  return (await response.json()) as LinkedAuthAccount[];
}

export async function signInWithSocialAuthAccount(provider: SocialAuthProvider) {
  if (Capacitor.isNativePlatform()) {
    clearNativeAuthToken();

    const idToken = await getNativeSocialIdToken(provider);

    const result = await authClient.signIn.social({
      idToken,
      provider,
    });

    setNativeAuthToken(getAuthResultToken(result.data));

    return result;
  }

  return authClient.signIn.social({
    callbackURL: getAuthSettingsCallbackURL({ auth: "success" }),
    errorCallbackURL: getAuthSettingsCallbackURL(),
    provider,
  });
}

export async function linkSocialAuthAccount(provider: SocialAuthProvider) {
  if (Capacitor.isNativePlatform()) {
    const idToken = await getNativeSocialIdToken(provider);

    return linkSocialAuthAccountWithIdToken(provider, idToken);
  }

  const response = await fetch(getAuthEndpointURL("/link-social"), {
    body: JSON.stringify({
      callbackURL: getAuthSettingsCallbackURL(),
      disableRedirect: true,
      errorCallbackURL: getAuthSettingsCallbackURL(),
      provider,
    }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await getAuthErrorMessage(response, "Could not connect sign-in method."));
  }

  return (await response.json()) as {
    redirect: boolean;
    status?: boolean;
    url?: string;
  };
}

async function linkSocialAuthAccountWithIdToken(
  provider: SocialAuthProvider,
  idToken: NativeSocialIdToken,
) {
  const response = await fetchWithNativeAuth(getAuthEndpointURL("/link-social"), {
    body: JSON.stringify({
      idToken,
      provider,
    }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await getAuthErrorMessage(response, "Could not connect sign-in method."));
  }

  return (await response.json()) as {
    redirect: boolean;
    status?: boolean;
    url?: string;
  };
}

async function getNativeSocialIdToken(provider: SocialAuthProvider): Promise<NativeSocialIdToken> {
  switch (provider) {
    case "apple":
      return getNativeAppleIdToken();
    case "google":
      return getNativeGoogleIdToken();
  }
}

async function getNativeGoogleIdToken(): Promise<NativeSocialIdToken> {
  // oxlint-disable-next-line react-doctor/async-parallel -- FIXME: address existing React Doctor diagnostics.
  const { GoogleSignIn } = await import("@capawesome/capacitor-google-sign-in");

  // The Capawesome plugin requires the web client ID on Android and iOS.
  // Platform-specific IDs are accepted by the Worker when verifying ID tokens.
  await GoogleSignIn.initialize({
    clientId: AUTH_PROVIDER_CONFIG.google.webClientId,
  });

  const result = await GoogleSignIn.signIn();

  return {
    accessToken: result.accessToken ?? undefined,
    token: result.idToken,
  };
}

async function getNativeAppleIdToken(): Promise<NativeSocialIdToken> {
  const { AppleSignIn, SignInScope } = await import("@capawesome/capacitor-apple-sign-in");
  const nonce = crypto.randomUUID();

  if (Capacitor.getPlatform() !== "ios") {
    await AppleSignIn.initialize({
      clientId: AUTH_PROVIDER_CONFIG.apple.serviceId,
    });
  }

  const result = await AppleSignIn.signIn({
    nonce,
    redirectUrl: getAuthSettingsCallbackURL(),
    scopes: [SignInScope.Email],
  });

  return {
    nonce,
    token: result.idToken,
    user: {
      email: result.email ?? undefined,
    },
  };
}

export async function requestPasswordResetEmail(email: string) {
  const response = await fetchWithNativeAuth(getAuthEndpointURL("/request-password-reset"), {
    body: JSON.stringify({
      email,
      redirectTo: getAuthResetPasswordCallbackURL(),
    }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await getAuthErrorMessage(response, "Could not send password email."));
  }
}

export async function requestMagicLinkEmail({ email, name }: { email: string; name: string }) {
  const result = await authClient.signIn.magicLink({
    callbackURL: getAuthSettingsCallbackURL({ auth: "success" }),
    email,
    errorCallbackURL: getAuthSettingsCallbackURL(),
    name,
    newUserCallbackURL: getAuthSettingsCallbackURL({ auth: "success" }),
  });

  if (result.error) {
    throw new Error(result.error.message ?? "Could not send magic link.");
  }
}

export async function resetPasswordWithToken({
  newPassword,
  token,
}: {
  newPassword: string;
  token: string;
}) {
  const response = await fetchWithNativeAuth(getAuthEndpointURL("/reset-password"), {
    body: JSON.stringify({
      newPassword,
      token,
    }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await getAuthErrorMessage(response, "Could not reset password."));
  }
}

export async function deleteAuthUserAccount() {
  const response = await fetchWithNativeAuth(getAuthEndpointURL("/delete-user"), {
    body: JSON.stringify({
      callbackURL: getAuthSettingsCallbackURL(),
    }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await getAuthErrorMessage(response, "Could not delete account."));
  }

  clearNativeAuthToken();
}

function getAuthEndpointURL(path: string) {
  return new URL(`/api/auth${path}`, getAuthBaseURL()).toString();
}

export function getAuthResultUser(data: unknown): AuthSessionUser | undefined {
  if (!data || typeof data !== "object" || !("user" in data)) {
    return undefined;
  }

  const user = data.user;

  if (!user || typeof user !== "object" || !("id" in user) || !("email" in user)) {
    return undefined;
  }

  if (typeof user.id !== "string" || typeof user.email !== "string") {
    return undefined;
  }

  return user as AuthSessionUser;
}

export function getAuthRedirectUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("url" in data)) {
    return undefined;
  }

  return typeof data.url === "string" ? data.url : undefined;
}

function getAuthResultToken(data: unknown) {
  if (!data || typeof data !== "object" || !("token" in data)) {
    return undefined;
  }

  return typeof data.token === "string" ? data.token : undefined;
}

async function getAuthErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);

  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
    return body.message;
  }

  return fallback;
}
