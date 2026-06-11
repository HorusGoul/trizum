import { beforeAll, describe, expect, test } from "vite-plus/test";
import type { PartyList } from "#src/models/partyList.js";
import { getOrderedPartySections } from "./partyListOrdering";

let PARTY_LIST_ID!: string;
let PARTY_A_ID!: string;
let PARTY_B_ID!: string;
let PARTY_C_ID!: string;
let PARTY_D_ID!: string;

beforeAll(() => {
  PARTY_LIST_ID = createPartyId();
  PARTY_A_ID = createPartyId();
  PARTY_B_ID = createPartyId();
  PARTY_C_ID = createPartyId();
  PARTY_D_ID = createPartyId();
});

describe("getOrderedPartySections", () => {
  test("orders pinned parties before more recently used unpinned parties", () => {
    const partyList = createPartyList({
      parties: createFlagMap(PARTY_A_ID, PARTY_B_ID, PARTY_C_ID),
      pinnedParties: createFlagMap(PARTY_B_ID),
      lastUsedAt: createLastUsedAtMap([PARTY_A_ID, 200], [PARTY_B_ID, 50], [PARTY_C_ID, 100]),
    });

    expect(getOrderedPartySections(partyList)).toMatchObject({
      activePartyIds: [PARTY_B_ID, PARTY_A_ID, PARTY_C_ID],
      archivedPartyIds: [],
      activeCount: 3,
      archivedCount: 0,
      pinnedActiveCount: 1,
    });
  });

  test("moves archived parties into their own ordered section by recent use", () => {
    const partyList = createPartyList({
      parties: createFlagMap(PARTY_A_ID, PARTY_B_ID, PARTY_C_ID, PARTY_D_ID),
      pinnedParties: createFlagMap(PARTY_C_ID, PARTY_D_ID),
      archivedParties: createFlagMap(PARTY_B_ID, PARTY_D_ID),
      lastUsedAt: createLastUsedAtMap(
        [PARTY_A_ID, 10],
        [PARTY_B_ID, 30],
        [PARTY_C_ID, 20],
        [PARTY_D_ID, 5],
      ),
    });

    expect(getOrderedPartySections(partyList)).toMatchObject({
      activePartyIds: [PARTY_C_ID, PARTY_A_ID],
      archivedPartyIds: [PARTY_B_ID, PARTY_D_ID],
      activeCount: 2,
      archivedCount: 2,
      pinnedActiveCount: 1,
    });
  });

  test("falls back to the last opened party when newer timestamps are missing", () => {
    const partyList = createPartyList({
      parties: createFlagMap(PARTY_A_ID, PARTY_B_ID),
      lastOpenedPartyId: PARTY_B_ID,
    });

    expect(getOrderedPartySections(partyList).activePartyIds).toEqual([PARTY_B_ID, PARTY_A_ID]);
  });
});

function createPartyList(overrides: Partial<PartyList>): PartyList {
  return {
    id: PARTY_LIST_ID,
    type: "partyList",
    username: "",
    phone: "",
    parties: {},
    participantInParties: {},
    pinnedParties: {},
    archivedParties: {},
    lastUsedAt: {},
    ...overrides,
  };
}

function createPartyId(): string {
  return crypto.randomUUID();
}

function createFlagMap(...partyIds: string[]) {
  return Object.fromEntries(partyIds.map((partyId) => [partyId, true as const])) as Record<
    string,
    true
  >;
}

function createLastUsedAtMap(...entries: [string, number][]) {
  return Object.fromEntries(entries) as Record<string, number>;
}
