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
