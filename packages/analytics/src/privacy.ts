/** Only trusted, build-time route templates may supply text to analytics URLs. */
export function redactPathname(pathname: string, routes: readonly string[]): string {
  const parts = pathname.split(/[?#]/, 1)[0].replace(/\/$/, "").split("/");
  for (const route of routes) {
    const template = route.replace(/\/$/, "").split("/");
    if (
      parts.length === template.length &&
      template.every((part, index) =>
        part.startsWith("$") ? parts[index].length > 0 : part === parts[index],
      )
    ) {
      return template.map((part) => (part.startsWith("$") ? ":redacted" : part)).join("/") || "/";
    }
  }
  return "/:unknown";
}

export function hasPrivacySignal(navigator: {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}): boolean {
  const dnt = navigator.doNotTrack?.trim().toLowerCase();
  return navigator.globalPrivacyControl === true || dnt === "1" || dnt === "yes";
}
/** Random UUID v4 only: never accept a document ID or arbitrary identity string. */
export function isTelemetryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  );
}
