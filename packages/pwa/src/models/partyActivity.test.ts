import { describe, expect, test } from "vite-plus/test";
import type { Party } from "./party";
import { getPartySettingsActivityEntries, getParticipantActivityChanges } from "./partyActivity";

describe("party activity", () => {
  test("describes party setting and participant changes", () => {
    const previous = {
      name: "Trip",
      symbol: "T",
      description: "Summer",
      participants: {
        alice: { id: "alice", name: "Alice" },
        bob: { id: "bob", name: "Bob" },
        clara: { id: "clara", name: "Clara", isArchived: true },
      },
    } satisfies Pick<Party, "name" | "symbol" | "description" | "participants">;
    const next = {
      name: "Beach trip",
      symbol: "B",
      description: "Summer",
      participants: {
        alice: { id: "alice", name: "Alicia" },
        bob: { id: "bob", name: "Bob", isArchived: true },
        clara: { id: "clara", name: "Clara" },
        diego: { id: "diego", name: "Diego" },
      },
    } satisfies Pick<Party, "name" | "symbol" | "description" | "participants">;

    expect(getPartySettingsActivityEntries(previous, next)).toEqual([
      {
        type: "party-settings-updated",
        changes: ["name", "symbol"],
      },
      {
        type: "participant-updated",
        participantId: "alice",
        participantName: "Alicia",
        changes: ["name"],
      },
      {
        type: "participant-archived",
        participantId: "bob",
        participantName: "Bob",
      },
      {
        type: "participant-restored",
        participantId: "clara",
        participantName: "Clara",
      },
      {
        type: "participant-added",
        participantId: "diego",
        participantName: "Diego",
      },
    ]);
  });

  test("ignores participant view preferences", () => {
    expect(
      getParticipantActivityChanges(
        {
          id: "alice",
          name: "Alice",
          personalMode: false,
          balancesSortedBy: "name",
        },
        {
          id: "alice",
          name: "Alice",
          personalMode: true,
          balancesSortedBy: "balance-descending",
        },
      ),
    ).toEqual([]);
  });
});
