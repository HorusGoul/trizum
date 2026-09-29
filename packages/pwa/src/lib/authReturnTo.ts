/** Authentication may return to an app path, never an external destination. */
export function parseAuthReturnTo(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\p{Cc}\s]/u.test(value)
  )
    return undefined;
  try {
    const url = new URL(value, "https://trizum.app");
    if (url.origin !== "https://trizum.app" || url.pathname.startsWith("//")) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}
