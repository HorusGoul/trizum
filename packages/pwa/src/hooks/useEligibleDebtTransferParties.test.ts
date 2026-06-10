import { describe, expect, test } from "vite-plus/test";
import type { Party } from "#src/models/party.ts";
import { getEligibleDebtTransferParticipants } from "./useEligibleDebtTransferParties";

describe("getEligibleDebtTransferParticipants", () => {
  test("returns active counterparties sorted by name", () => {
    const result = getEligibleDebtTransferParticipants(
      createParty({
        me: { id: "me", name: "Me" },
        zoe: { id: "zoe", name: "Zoe" },
        alex: { id: "alex", name: "Alex" },
        archived: { id: "archived", name: "Archived", isArchived: true },
      }),
      "me",
    );

    expect(result?.currentParticipant.id).toBe("me");
    expect(result?.otherParticipants.map(({ id }) => id)).toEqual(["alex", "zoe"]);
  });

  test("rejects parties where the joined participant is archived", () => {
    expect(
      getEligibleDebtTransferParticipants(
        createParty({
          me: { id: "me", name: "Me", isArchived: true },
          alex: { id: "alex", name: "Alex" },
        }),
        "me",
      ),
    ).toBeNull();
  });

  test("rejects parties without another active participant", () => {
    expect(
      getEligibleDebtTransferParticipants(
        createParty({
          me: { id: "me", name: "Me" },
          archived: { id: "archived", name: "Archived", isArchived: true },
        }),
        "me",
      ),
    ).toBeNull();
  });
});

function createParty(participants: Party["participants"]): Party {
  return {
    id: "party-id" as Party["id"],
    type: "party",
    name: "Test party",
    description: "",
    currency: "EUR",
    participants,
  };
}
