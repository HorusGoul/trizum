import { Capacitor } from "@capacitor/core";
import { createRememberedAuthSession, createRememberedSessionFetch } from "./rememberedAuthSession";
import {
  clearNativeAuthToken,
  getNativeAuthToken,
  subscribeNativeAuthTokenClear,
  setNativeAuthToken,
  setNativeAuthTokenFromResponse,
} from "./nativeAuthSession";

export const rememberedSession = createRememberedAuthSession({
  storage: () => (typeof localStorage === "undefined" ? undefined : localStorage),
  canRestore: () => !Capacitor.isNativePlatform() || Boolean(getNativeAuthToken()),
  isOnline: () => typeof navigator === "undefined" || navigator.onLine,
});
subscribeNativeAuthTokenClear(rememberedSession.clear);

export const fetchAuth = createRememberedSessionFetch({
  session: rememberedSession,
  fetch: (...args) => fetch(...args),
  clearToken: clearNativeAuthToken,
  captureToken(response, body) {
    setNativeAuthTokenFromResponse(response);
    if (!response.headers.has("set-auth-token")) {
      const token = getAuthResultToken(body);
      if (token) setNativeAuthToken(token);
    }
  },
});

function getAuthResultToken(data: unknown) {
  if (!data || typeof data !== "object" || !("token" in data)) {
    return undefined;
  }

  return typeof data.token === "string" ? data.token : undefined;
}
