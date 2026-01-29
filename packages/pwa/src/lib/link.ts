export function getAppLink(path: string) {
  return `${getApiOrigin()}${path}`;
}

/**
 * Returns the origin for API requests.
 * In dev/preview environments, uses the current origin.
 * In production (including Capacitor mobile), uses the hardcoded domain.
 */
export function getApiOrigin() {
  if (window.location.origin.includes("horusdev") || import.meta.env.DEV) {
    return window.location.origin;
  }

  return "https://trizum.app";
}
