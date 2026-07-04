import type { Repo } from "@automerge/automerge-repo/slim";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { Party } from "./party";

const addExpenseToPartyMock =
  vi.fn<(expense: MigrationData["expenses"][number]) => Promise<unknown>>();

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
  let lastCreatedHandle:
    | {
        doc: () => Party;
        documentId: string;
        change: (changeFn: (nextDoc: Party) => void) => void;
      }
    | undefined;

  return {
    repo: {
      create<T>(doc: T) {
        assertNoUndefinedValues(doc, "");

        const handle = {
          doc: () => doc,
          documentId: `mock-doc-${++nextId}`,
          change(changeFn: (nextDoc: T) => void) {
            changeFn(doc);
          },
        };

        lastCreatedHandle = handle as unknown as typeof lastCreatedHandle;

        return handle;
      },
    } as unknown as Repo,
    getLastCreatedHandle: () => {
      if (!lastCreatedHandle) {
        throw new Error("Expected a created party handle");
      }

      return lastCreatedHandle;
    },
  };
}

function createMigrationData(
  partyOverrides: Partial<MigrationData["party"]> = {},
  dataOverrides: Partial<Pick<MigrationData, "expenses" | "photos">> = {},
): MigrationData {
  return {
    party: {
      type: "party",
      name: "Andalusian Point",
      description: "Trip to the best place in the world",
      currency: "EUR" as Party["currency"],
      participants: {},
      ...partyOverrides,
    },
    expenses: dataOverrides.expenses ?? [],
    photos: dataOverrides.photos ?? [],
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

    expect(mockRepo.getLastCreatedHandle().doc()).not.toHaveProperty("symbol");
  });

  test("preserves the party symbol when migration data includes one", async () => {
    const mockRepo = createMockRepo();

    await createPartyFromMigrationData({
      repo: mockRepo.repo,
      data: createMigrationData({
        symbol: "🏕️",
      }),
    });

    expect(mockRepo.getLastCreatedHandle().doc()).toMatchObject({
      symbol: "🏕️",
    });
  });
});
