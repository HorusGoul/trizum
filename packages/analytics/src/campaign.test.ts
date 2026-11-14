import { describe, expect, it } from "vite-plus/test";
import { MCP_HANDOFF_CAMPAIGN, readAnalyticsCampaign } from "./campaign.js";

const campaign = new URLSearchParams(MCP_HANDOFF_CAMPAIGN).toString();

describe("approved acquisition campaigns", () => {
  it.each(["mcp", "chatgpt"])("accepts the fixed %s campaign and discards other data", (source) => {
    expect(
      readAnalyticsCampaign(
        `?${campaign.replace("mcp", source)}&name=Alice&code=secret&utm_content=private`,
      ),
    ).toEqual({ ...MCP_HANDOFF_CAMPAIGN, utm_source: source });
  });

  it.each([
    "",
    "?utm_source=mcp",
    `?${campaign}&utm_source=chatgpt`,
    `?${campaign.replace("mcp", "Alice")}`,
    `?${campaign.replace("ai_app", "email")}`,
    `?${campaign.replace("party_handoff", "secret")}`,
  ])("rejects partial, duplicate or unapproved labels: %s", (search) => {
    expect(readAnalyticsCampaign(search)).toBeUndefined();
  });
});
