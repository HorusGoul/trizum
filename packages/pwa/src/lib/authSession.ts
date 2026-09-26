import { Capacitor } from "@capacitor/core";
import { createRememberedAuthSession } from "./rememberedAuthSession";
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
subscribeNativeAuthTokenClear(rememberedSession.clear);

export const fetchAuth = rememberedSession.fetch;

function getAuthResultToken(data: unknown) {
  if (!data || typeof data !== "object" || !("token" in data)) {
    return undefined;
  }

  return typeof data.token === "string" ? data.token : undefined;
}
