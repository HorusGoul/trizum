import { analyticsCampaignSchema, type AnalyticsCampaign } from "@trizum/analytics";
import type { AppSearch } from "./routerSearch.ts";

export type AiInviteSearch = Partial<AnalyticsCampaign> & { entry?: "ai" };

export function parseAiInviteSearch(search: AppSearch): AiInviteSearch {
  const result = analyticsCampaignSchema.safeParse(search);
  const campaign = result.success ? result.data : undefined;

  return {
    entry: search.entry === "ai" ? "ai" : undefined,
    utm_source: campaign?.utm_source,
    utm_medium: campaign?.utm_medium,
    utm_campaign: campaign?.utm_campaign,
  };
}

export function createAiInviteUrl(origin: string, partyId: string, campaign?: AnalyticsCampaign) {
  const url = new URL(`/party/${encodeURIComponent(partyId)}`, origin);
  url.searchParams.set("entry", "ai");
  const result = analyticsCampaignSchema.safeParse(campaign);

  if (result.success) {
    for (const [key, value] of Object.entries(result.data)) url.searchParams.set(key, value);
  }

  return url.href;
}
