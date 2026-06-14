import { Capacitor } from "@capacitor/core";
import { createAuthClient } from "better-auth/react";
import { AUTH_PROVIDER_CONFIG } from "./authConfig";

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
    name?: {
      firstName?: string;
      lastName?: string;
    };
  };
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  fetchOptions: {
    credentials: "include",
  },
});

export function getAuthBaseURL() {
  if (import.meta.env.VITE_APP_AUTH_URL) {
    return import.meta.env.VITE_APP_AUTH_URL;
  }

  if (Capacitor.isNativePlatform()) {
    return "https://trizum.app";
  }

  return window.location.origin;
}

export function getAuthSettingsCallbackURL() {
  if (Capacitor.isNativePlatform()) {
    return new URL("/settings", getAuthBaseURL()).toString();
  }

  return "/settings";
}

export function getAuthResetPasswordCallbackURL() {
  if (Capacitor.isNativePlatform()) {
    return new URL("/reset-password", getAuthBaseURL()).toString();
  }

  return "/reset-password";
}

export async function fetchLinkedAuthAccounts() {
  const response = await fetch(getAuthEndpointURL("/list-accounts"), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await getAuthErrorMessage(response, "Could not load sign-in methods."));
  }

  return (await response.json()) as LinkedAuthAccount[];
}

export async function signInWithSocialAuthAccount(provider: SocialAuthProvider) {
  if (Capacitor.isNativePlatform()) {
    const idToken = await getNativeSocialIdToken(provider);

    return authClient.signIn.social({
      idToken,
      provider,
    });
  }

  return authClient.signIn.social({
    callbackURL: getAuthSettingsCallbackURL(),
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
  const response = await fetch(getAuthEndpointURL("/link-social"), {
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
  const { GoogleSignIn } = await import("@capawesome/capacitor-google-sign-in");

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
    scopes: [SignInScope.Email, SignInScope.FullName],
  });

  return {
    nonce,
    token: result.idToken,
    user: {
      email: result.email ?? undefined,
      name: {
        firstName: result.givenName ?? undefined,
        lastName: result.familyName ?? undefined,
      },
    },
  };
}

export async function requestPasswordResetEmail(email: string) {
  const response = await fetch(getAuthEndpointURL("/request-password-reset"), {
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

export async function resetPasswordWithToken({
  newPassword,
  token,
}: {
  newPassword: string;
  token: string;
}) {
  const response = await fetch(getAuthEndpointURL("/reset-password"), {
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

function getAuthEndpointURL(path: string) {
  return new URL(`/api/auth${path}`, getAuthBaseURL()).toString();
}

async function getAuthErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);

  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
    return body.message;
  }

  return fallback;
}
