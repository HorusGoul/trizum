import { z } from "zod";

const collectConfigSchema = z.object({
  siteId: z.string(),
  collectToken: z
    .string()
    .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    .max(4096),
});

/** InsightFlare v6 puts JSON configuration before its SDK. Never execute the SDK. */
export function readCollectToken(script: string, siteId: string): string | undefined {
  const match = script.match(
    /^(?:"use strict";)?globalThis\["__insightflare_tracker_runtime_config__"\] = (\{[^\n]+\});\r?\n/,
  );

  if (!match) return;

  try {
    const config = collectConfigSchema.safeParse(JSON.parse(match[1]));

    if (config.success && config.data.siteId === siteId) return config.data.collectToken;
  } catch {
    // An upstream format change disables collection; there is no script fallback.
  }
}
