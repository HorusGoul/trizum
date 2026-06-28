const DEFAULT_WSS_URL = "wss://dev-sync.trizum.app";
const OFFLINE_ONLY_PARAM = "__internal_offline_only";

export function getAutomergeWssUrl() {
  return import.meta.env.VITE_APP_WSS_URL ?? DEFAULT_WSS_URL;
}

export function getIsAutomergeOfflineOnly(url = globalThis.location?.href) {
  if (!url) {
    return false;
  }

  return new URL(url).searchParams.get(OFFLINE_ONLY_PARAM) === "true";
}
