import type { Repo } from "@automerge/automerge-repo/slim";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { Party, PartyActivityLog } from "./party";
import type { Expense } from "./expense";

const addExpenseToPartyMock =
  vi.fn<(expense: Omit<Expense, "id" | "__hash">) => Promise<Expense>>();

vi.mock("#src/hooks/useParty.ts", () => ({
  getPartyHelpers: () => ({
    addExpenseToParty: addExpenseToPartyMock,
  }),
}));

vi.mock("#src/hooks/useMediaFileActions.ts", () => ({
  getMediaFileHelpers: () => ({
    createMediaFile:
      vi.fn<
        (
          blob: Blob,
          metadata: Record<string, unknown>,
        ) => Promise<readonly [mediaFileId: string, handle: unknown]>
      >(),
  }),
}));

import { createPartyFromMigrationData, type MigrationData } from "./migration";

function assertNoUndefinedValues(value: unknown, path: string) {
  if (value === undefined) {
    throw new RangeError(
      `Cannot assign undefined value at ${path}, because \`undefined\` is not a valid JSON data type. You might consider setting the property's value to \`null\`, or using \`delete\` to remove it altogether.`,
    );
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertNoUndefinedValues(item, `${path}/${index}`);
    }

    return;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertNoUndefinedValues(item, `${path}/${key}`);
    }
  }
}

function createMockRepo() {
  let nextId = 0;
  const createdHandles: {
    doc: Party | PartyActivityLog;
    documentId: string;
    change: (changeFn: (nextDoc: Party | PartyActivityLog) => void) => void;
  }[] = [];

  function getCreatedHandle(type: Party["type"] | PartyActivityLog["type"]) {
    const handle = createdHandles.find((handle) => handle.doc.type === type);

    if (!handle) {
      throw new Error(`Expected a created ${type} handle`);
    }

    return handle;
  }

  return {
    repo: {
      create<T>(doc: T) {
        assertNoUndefinedValues(doc, "");

        const handle = {
          doc,
          documentId: `mock-doc-${++nextId}`,
          change(changeFn: (nextDoc: T) => void) {
            changeFn(handle.doc);
          },
        };

        createdHandles.push(handle as unknown as (typeof createdHandles)[number]);

        return handle;
      },
    } as unknown as Repo,
    getCreatedPartyHandle: () =>
      getCreatedHandle("party") as {
        doc: Party;
        documentId: string;
        change: (changeFn: (nextDoc: Party) => void) => void;
      },
    getCreatedActivityLogHandle: () =>
      getCreatedHandle("partyActivityLog") as {
        doc: PartyActivityLog;
        documentId: string;
        change: (changeFn: (nextDoc: PartyActivityLog) => void) => void;
      },
  };
}

function createMigrationData(partyOverrides: Partial<MigrationData["party"]> = {}): MigrationData {
  return {
    party: {
      type: "party",
      name: "Andalusian Point",
      description: "Trip to the best place in the world",
      currency: "EUR" as Party["currency"],
      participants: {},
      ...partyOverrides,
    },
    expenses: [],
    photos: [],
  };
}

describe("createPartyFromMigrationData", () => {
  beforeEach(() => {
    addExpenseToPartyMock.mockReset();
  });

  test("omits an undefined party symbol before creating the Automerge document", async () => {
    const mockRepo = createMockRepo();

    await expect(
      createPartyFromMigrationData({
        repo: mockRepo.repo,
        data: createMigrationData(),
      }),
    ).resolves.toBe("mock-doc-1");

    expect(mockRepo.getCreatedPartyHandle().doc).not.toHaveProperty("symbol");
  });

  test("preserves the party symbol when migration data includes one", async () => {
    const mockRepo = createMockRepo();

    await createPartyFromMigrationData({
      repo: mockRepo.repo,
      data: createMigrationData({
        symbol: "🏕️",
      }),
    });

    expect(mockRepo.getCreatedPartyHandle().doc).toMatchObject({
      symbol: "🏕️",
    });
  });

  test("creates a separate activity log document for the imported party", async () => {
    const mockRepo = createMockRepo();

    await createPartyFromMigrationData({
      repo: mockRepo.repo,
      data: createMigrationData(),
    });

    const partyHandle = mockRepo.getCreatedPartyHandle();
    const activityLogHandle = mockRepo.getCreatedActivityLogHandle();

    expect(partyHandle.doc.activityLogId).toBe(activityLogHandle.documentId);
    expect(activityLogHandle.doc).toMatchObject({
      type: "partyActivityLog",
      partyId: partyHandle.documentId,
      entries: [
        {
          type: "party-created",
          partyName: "Andalusian Point",
        },
      ],
    });
  });
});
