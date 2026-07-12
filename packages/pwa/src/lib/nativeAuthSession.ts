import { Capacitor } from "@capacitor/core";

const NATIVE_AUTH_TOKEN_STORAGE_KEY = "trizumNativeAuthToken";
const AUTH_TOKEN_RESPONSE_HEADER = "set-auth-token";

export function getNativeAuthToken() {
  if (!Capacitor.isNativePlatform()) {
    return undefined;
  }

  try {
    return localStorage.getItem(NATIVE_AUTH_TOKEN_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setNativeAuthToken(token: string | undefined) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    if (token) {
      // eslint-disable-next-line react-doctor/auth-token-in-web-storage -- Capacitor's native bridge cannot rely on browser HttpOnly cookies; native requests must persist and forward this bearer token.
      localStorage.setItem(NATIVE_AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(NATIVE_AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

export function clearNativeAuthToken() {
  setNativeAuthToken(undefined);
}

export function getNativeAuthHeaders(headers?: HeadersInit) {
  const resolvedHeaders = new Headers(headers);
  const token = getNativeAuthToken();

  if (token && !resolvedHeaders.has("authorization")) {
    resolvedHeaders.set("authorization", `Bearer ${token}`);
  }

  return resolvedHeaders;
}

export function setNativeAuthTokenFromResponse(response: Response) {
  const token = response.headers.get(AUTH_TOKEN_RESPONSE_HEADER);

  if (token) {
    setNativeAuthToken(token);
  }
}

export async function fetchWithNativeAuth(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers: getNativeAuthHeaders(init?.headers),
  });

  setNativeAuthTokenFromResponse(response);

  return response;
}
