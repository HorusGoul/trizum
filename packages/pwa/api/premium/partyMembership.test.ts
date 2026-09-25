import { describe, expect, it } from "vite-plus/test";
import type { DocumentId } from "@automerge/automerge-repo";
import type { Party } from "../../src/models/party";
import { isPartyMembershipValid } from "./partyMembership";

describe("isPartyMembershipValid", () => {
  const party = {
    chunkRefs: [],
    currency: "EUR",
    description: "",
    id: "party-id" as DocumentId,
    name: "Party",
    type: "party",
    participants: {
      member: { id: "member", name: "Member" },
      archived: { id: "archived", isArchived: true, name: "Archived" },
    },
  } satisfies Party;

  it("accepts an active participant in the expected party", () => {
    expect(
      isPartyMembershipValid({ participantId: "member", party, partyDocumentId: "party-id" }),
    ).toBe(true);
  });

  it("rejects an archived participant", () => {
    expect(
      isPartyMembershipValid({ participantId: "archived", party, partyDocumentId: "party-id" }),
    ).toBe(false);
  });

  it("rejects a mismatched party document", () => {
    expect(
      isPartyMembershipValid({ participantId: "member", party, partyDocumentId: "other-party" }),
    ).toBe(false);
  });
});
