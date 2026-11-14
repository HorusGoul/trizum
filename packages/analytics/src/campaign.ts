import { z } from "zod";

/** Fixed campaign labels only; this is not permission to collect arbitrary query strings. */
export const analyticsCampaignSchema = z.object({
  utm_source: z.enum(["mcp", "chatgpt"]),
  utm_medium: z.literal("ai_app"),
  utm_campaign: z.literal("party_handoff"),
});

export type AnalyticsCampaign = z.infer<typeof analyticsCampaignSchema>;

export const MCP_HANDOFF_CAMPAIGN: AnalyticsCampaign = {
  utm_source: "mcp",
  utm_medium: "ai_app",
  utm_campaign: "party_handoff",
};

export function readAnalyticsCampaign(search: string) {
  const params = new URLSearchParams(search);

  if (["utm_source", "utm_medium", "utm_campaign"].some((key) => params.getAll(key).length !== 1))
    return undefined;

  const result = analyticsCampaignSchema.safeParse({
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  });

  return result.success ? result.data : undefined;
}
