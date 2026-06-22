import { getLogger } from "./log.ts";

const logger = getLogger("lib", "nativeDeepLinks");

const DEFAULT_APP_LINK_ORIGIN = "https://trizum.app";
const MAGIC_LINK_VERIFY_PATH = "/api/auth/magic-link/verify";
const VERIFY_EMAIL_PATH = "/api/auth/verify-email";
const PASSWORD_RESET_PATH_PATTERN = /^\/api\/auth\/reset-password\/(?<token>[^/]+)$/;
const AUTH_PATH_PREFIX = "/api/auth/";
const CALLBACK_SEARCH_PARAMS = ["callbackURL", "newUserCallbackURL", "errorCallbackURL"];

const configuredAuthOrigin = getConfiguredAuthOrigin();
const appLinkOrigins = new Set(
  [DEFAULT_APP_LINK_ORIGIN, configuredAuthOrigin].filter((origin): origin is string =>
    Boolean(origin),
  ),
);

export interface NativeDeepLinkResolution {
  href?: string;
  isAppLink: boolean;
}

export async function resolveNativeDeepLink(rawUrl: string): Promise<NativeDeepLinkResolution> {
  const url = parseUrl(rawUrl);

  if (!url || !isNativeAppLink(url)) {
    return { isAppLink: false };
  }

  if (url.pathname === MAGIC_LINK_VERIFY_PATH) {
    return {
      href: await resolveNativeMagicLink(url),
      isAppLink: true,
    };
  }

  if (url.pathname === VERIFY_EMAIL_PATH) {
    return {
      href: await resolveNativeEmailVerification(url),
      isAppLink: true,
    };
  }

  const passwordResetHref = resolveNativePasswordReset(url);

  if (passwordResetHref) {
    return {
      href: passwordResetHref,
      isAppLink: true,
    };
  }

  if (url.pathname.startsWith(AUTH_PATH_PREFIX)) {
    logger.warning("Ignored unsupported native auth deep link", { path: url.pathname });
    return { isAppLink: true };
  }

  return {
    href: getRouteHref(url),
    isAppLink: true,
  };
}

export function isNativeAppLink(url: URL): boolean {
  return appLinkOrigins.has(url.origin);
}

export function getRouteHref(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

async function resolveNativeMagicLink(url: URL): Promise<string> {
  const callbackUrl = getCallbackUrl(url, "callbackURL", "/settings/cloud-sync?auth=success");
  const errorCallbackUrl = getCallbackUrl(url, "errorCallbackURL", "/settings/cloud-sync");
  const verificationUrl = getAuthVerificationUrl(url);

  try {
    const response = await fetch(verificationUrl, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok || !isJsonResponse(response)) {
      throw new Error("Native magic link verification failed.");
    }

    await response.json();

    return getRouteHref(callbackUrl);
  } catch (error) {
    logger.warning("Native magic link verification failed", { error });

    errorCallbackUrl.searchParams.set("error", "INVALID_TOKEN");
    return getRouteHref(errorCallbackUrl);
  }
}

async function resolveNativeEmailVerification(url: URL): Promise<string> {
  const callbackUrl = getCallbackUrl(url, "callbackURL", "/settings/cloud-sync");
  const verificationUrl = getAuthVerificationUrl(url);

  try {
    const response = await fetch(verificationUrl, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok || !isJsonResponse(response)) {
      throw new Error("Native email verification failed.");
    }

    await response.json();

    return getRouteHref(callbackUrl);
  } catch (error) {
    logger.warning("Native email verification failed", { error });

    callbackUrl.searchParams.set("error", "INVALID_TOKEN");
    return getRouteHref(callbackUrl);
  }
}

function resolveNativePasswordReset(url: URL): string | undefined {
  const match = PASSWORD_RESET_PATH_PATTERN.exec(url.pathname);
  const token = match?.groups?.token;

  if (!token) {
    return undefined;
  }

  const callbackUrl = getCallbackUrl(url, "callbackURL", "/reset-password");
  callbackUrl.searchParams.set("token", decodeURIComponent(token));

  return getRouteHref(callbackUrl);
}

function getAuthVerificationUrl(url: URL): string {
  const verificationUrl = new URL(url);

  for (const searchParam of CALLBACK_SEARCH_PARAMS) {
    verificationUrl.searchParams.delete(searchParam);
  }

  return verificationUrl.toString();
}

function getCallbackUrl(url: URL, searchParam: string, fallbackPath: string): URL {
  const fallbackUrl = new URL(fallbackPath, DEFAULT_APP_LINK_ORIGIN);
  const value = url.searchParams.get(searchParam);

  if (!value) {
    return fallbackUrl;
  }

  const callbackUrl = parseUrl(value, DEFAULT_APP_LINK_ORIGIN);

  if (!callbackUrl || !isNativeAppLink(callbackUrl)) {
    return fallbackUrl;
  }

  return callbackUrl;
}

function parseUrl(value: string, base?: string): URL | undefined {
  try {
    return new URL(value, base);
  } catch {
    logger.warning("Ignored invalid native deep link URL");
    return undefined;
  }
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get("content-type")?.includes("application/json") === true;
}

function getConfiguredAuthOrigin(): string | undefined {
  const authUrl = import.meta.env.VITE_APP_AUTH_URL;

  if (!authUrl) {
    return undefined;
  }

  try {
    return new URL(authUrl).origin;
  } catch {
    return undefined;
  }
}
