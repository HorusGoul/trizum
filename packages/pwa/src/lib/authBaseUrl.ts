import { Capacitor } from "@capacitor/core";

export function getAuthBaseURL() {
  if (import.meta.env.VITE_APP_AUTH_URL) {
    return import.meta.env.VITE_APP_AUTH_URL;
  }

  if (Capacitor.isNativePlatform()) {
    return "https://trizum.app";
  }

  return window.location.origin;
}
