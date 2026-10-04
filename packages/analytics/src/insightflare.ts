/** InsightFlare v6 puts JSON configuration before its SDK. Never execute the SDK. */
export function readCollectToken(script: string, siteId: string): string | undefined {
  const match = script.match(
    /^(?:"use strict";)?globalThis\["__insightflare_tracker_runtime_config__"\] = (\{[^\n]+\});\r?\n/,
  );
  if (!match) return;
  try {
    const config: unknown = JSON.parse(match[1]);
    if (
      config &&
      typeof config === "object" &&
      "siteId" in config &&
      config.siteId === siteId &&
      "collectToken" in config &&
      typeof config.collectToken === "string" &&
      /^[\w-]+\.[\w-]+\.[\w-]+$/.test(config.collectToken) &&
      config.collectToken.length <= 4096
    ) {
      return config.collectToken;
    }
  } catch {
    // An upstream format change disables collection; there is no script fallback.
  }
}
