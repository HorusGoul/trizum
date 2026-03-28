import { beforeAll, describe, expect, test } from "vitest";
import {
  generateAutomergeUrl,
  parseAutomergeUrl,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
import type { PartyList } from "#src/models/partyList.js";
import { getOrderedPartySections } from "./partyListOrdering";

let PARTY_LIST_ID!: DocumentId;
let PARTY_A_ID!: DocumentId;
let PARTY_B_ID!: DocumentId;
let PARTY_C_ID!: DocumentId;
let PARTY_D_ID!: DocumentId;

beforeAll(() => {
  PARTY_LIST_ID = createDocumentId();
  PARTY_A_ID = createDocumentId();
  PARTY_B_ID = createDocumentId();
  PARTY_C_ID = createDocumentId();
  PARTY_D_ID = createDocumentId();
});

describe("getOrderedPartySections", () => {
  test("orders pinned parties before more recently used unpinned parties", () => {
    const partyList = createPartyList({
      parties: createFlagMap(PARTY_A_ID, PARTY_B_ID, PARTY_C_ID),
      pinnedParties: createFlagMap(PARTY_B_ID),
      lastUsedAt: createLastUsedAtMap(
        [PARTY_A_ID, 200],
        [PARTY_B_ID, 50],
        [PARTY_C_ID, 100],
      ),
    });

    expect(getOrderedPartySections(partyList)).toMatchObject({
      activePartyIds: [PARTY_B_ID, PARTY_A_ID, PARTY_C_ID],
      archivedPartyIds: [],
      activeCount: 3,
      archivedCount: 0,
      pinnedActiveCount: 1,
    });
  });

  test("moves archived parties into their own ordered section", () => {
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
      archivedPartyIds: [PARTY_D_ID, PARTY_B_ID],
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

    expect(getOrderedPartySections(partyList).activePartyIds).toEqual([
      PARTY_B_ID,
      PARTY_A_ID,
    ]);
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

function createDocumentId(): DocumentId {
  return parseAutomergeUrl(generateAutomergeUrl()).documentId;
}

function createFlagMap(...partyIds: DocumentId[]) {
  return Object.fromEntries(
    partyIds.map((partyId) => [partyId, true as const]),
  ) as Record<DocumentId, true>;
}

function createLastUsedAtMap(...entries: [DocumentId, number][]) {
  return Object.fromEntries(entries) as Record<DocumentId, number>;
}
