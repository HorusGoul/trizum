import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { describe, expect, it } from "vite-plus/test";
import { MCP_HANDOFF_CAMPAIGN } from "@trizum/analytics";
import {
  createAiInviteUrl,
  parseAiInviteSearch,
  createAiHandoffUrl,
  createNativePartyUrl,
} from "./aiInvite.ts";
import { parseAppSearch } from "./routerSearch.ts";
import { parseQRCodeForPartyId } from "./qr.ts";

const partyId = parseAutomergeUrl(generateAutomergeUrl()).documentId;

describe("AI invite links", () => {
  it("keeps the browser fallback away from the existing native-associated origin", () => {
    const handoff = new URL(createAiHandoffUrl(partyId, MCP_HANDOFF_CAMPAIGN));
    const native = new URL(createNativePartyUrl(partyId, MCP_HANDOFF_CAMPAIGN));
    expect(handoff.origin).toBe("https://join.trizum.app");
    expect(native.origin).toBe("https://trizum.app");
    expect(handoff.origin).not.toBe(native.origin);
    expect(native.pathname).toBe(`/party/${partyId}`);
    expect(native.searchParams.has("entry")).toBe(false);
    expect(native.searchParams.get("utm_source")).toBe("mcp");
    expect(new URL(createAiHandoffUrl(partyId, { utm_source: "mcp" })).search).toBe("?entry=ai");
  });

  it("keeps the canonical party path readable by existing invite scanners", () => {
    const url = createAiInviteUrl("https://trizum.app", partyId, MCP_HANDOFF_CAMPAIGN);
    expect(url).toBe(
      `https://trizum.app/party/${partyId}?entry=ai&utm_source=mcp&utm_medium=ai_app&utm_campaign=party_handoff`,
    );
    expect(parseQRCodeForPartyId(url)).toBe(partyId);
    expect(parseAiInviteSearch(parseAppSearch(new URL(url).search))).toEqual({
      entry: "ai",
      ...MCP_HANDOFF_CAMPAIGN,
    });
  });

  it("keeps entry behavior independent from attribution and strips other search fields", () => {
    expect(parseAiInviteSearch({ entry: "ai", utm_source: "Alice", code: "secret" })).toEqual({
      entry: "ai",
      utm_source: undefined,
      utm_medium: undefined,
      utm_campaign: undefined,
    });
    expect(parseAiInviteSearch({ ...MCP_HANDOFF_CAMPAIGN, entry: ["ai"] }).entry).toBeUndefined();
    expect(
      parseAiInviteSearch({ ...MCP_HANDOFF_CAMPAIGN, utm_source: ["mcp", "chatgpt"] }).utm_source,
    ).toBeUndefined();
    expect(new URL(createAiInviteUrl("https://trizum.app", partyId)).search).toBe("?entry=ai");
  });
});
