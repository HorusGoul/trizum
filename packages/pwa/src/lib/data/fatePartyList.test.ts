import type { DocumentId } from "@automerge/automerge-repo/slim";
import { describe, expect, test } from "vite-plus/test";
import type { JoinedPartyEntity, UserEntity } from "@trizum/data";
import type { PartyList } from "#src/models/partyList.js";
import { applyFatePartyListState } from "./fatePartyList.js";

describe("applyFatePartyListState", () => {
  test("overlays Fate user settings and joined-party state onto the legacy party list", () => {
    const partyId = "party-1" as DocumentId;
    const legacyPartyList: PartyList = {
      id: "party-list-1" as DocumentId,
      archivedParties: {},
      autoOpenCalculator: false,
      hue: 120,
      lastOpenedPartyId: null,
      lastUsedAt: {
        [partyId]: 1,
      },
      openLastPartyOnLaunch: false,
      participantInParties: {
        [partyId]: "participant-legacy",
      },
      parties: {
        [partyId]: true,
      },
      phone: "",
      pinnedParties: {
        [partyId]: true,
      },
      type: "partyList",
      username: "",
    };
    const userSettings: UserEntity = {
      __typename: "User",
      accountProvider: null,
      authMode: "localFirst",
      autoOpenCalculator: true,
      avatarId: null,
      displayName: "Alice",
      fullAccountUserId: null,
      hue: 240,
      id: "user-1",
      lastOpenedPartyId: partyId,
      locale: "en",
      openLastPartyOnLaunch: true,
      phone: "+15550000000",
    };
    const joinedParty: JoinedPartyEntity = {
      __typename: "JoinedParty",
      id: "joined-party-1",
      isArchived: true,
      isPinned: false,
      joinedAt: new Date("2026-06-10T09:00:00.000Z"),
      lastUsedAt: new Date("2026-06-10T10:00:00.000Z"),
      participantId: "participant-fate",
      partyId,
      userId: "user-1",
    };

    const next = applyFatePartyListState(legacyPartyList, userSettings, [joinedParty]);

    expect(next).toMatchObject({
      archivedParties: {
        [partyId]: true,
      },
      autoOpenCalculator: true,
      hue: 240,
      lastOpenedPartyId: partyId,
      lastUsedAt: {
        [partyId]: new Date("2026-06-10T10:00:00.000Z").getTime(),
      },
      locale: "en",
      openLastPartyOnLaunch: true,
      participantInParties: {
        [partyId]: "participant-fate",
      },
      phone: "+15550000000",
      pinnedParties: {},
      username: "Alice",
    });
    expect(legacyPartyList.pinnedParties).toStrictEqual({
      [partyId]: true,
    });
  });
});
