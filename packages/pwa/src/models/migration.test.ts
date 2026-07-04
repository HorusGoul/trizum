import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { Party } from "./party";
import type { Expense } from "./expense";

const addExpenseToPartyMock =
  vi.fn<(expense: Omit<Expense, "id" | "__hash">) => Promise<Expense>>();
const recalculateBalancesMock = vi.fn<() => Promise<boolean>>();

vi.mock("#src/hooks/useParty.ts", () => ({
  getPartyHelpers: () => ({
    addExpenseToParty: addExpenseToPartyMock,
    recalculateBalances: recalculateBalancesMock,
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

vi.mock("#src/lib/requestIdleCallback.ts", () => ({
  requestIdleCallback: (
    callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
  ) => {
    callback({
      didTimeout: false,
      timeRemaining: () => 50,
    });

    return 0;
  },
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
  const flush = vi.fn<(documents?: DocumentId[]) => Promise<void>>(() => Promise.resolve());
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
      flush,
    } as unknown as Repo,
    flush,
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
    recalculateBalancesMock.mockReset();
    recalculateBalancesMock.mockResolvedValue(true);
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

  test("flushes imported party documents before waiting for balance recalculation", async () => {
    const mockRepo = createMockRepo();
    const balanceRecalculation = createDeferred<boolean>();

    addExpenseToPartyMock.mockImplementation(async () => {
      mockRepo
        .getLastCreatedHandle()
        .doc()
        .chunkRefs.push({
          chunkId: "chunk-1" as DocumentId,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          balancesId: "balances-1" as DocumentId,
        });

      return createExpense();
    });
    recalculateBalancesMock.mockReturnValueOnce(balanceRecalculation.promise);

    const migrationPromise = createPartyFromMigrationData({
      repo: mockRepo.repo,
      data: createMigrationData(
        {
          participants: {
            alice: { id: "alice", name: "Alice" },
            bob: { id: "bob", name: "Bob" },
          },
        },
        {
          expenses: [createMigrationExpense()],
        },
      ),
    });

    await vi.waitFor(() => {
      expect(mockRepo.flush).toHaveBeenCalledWith(["mock-doc-1", "chunk-1", "balances-1"]);
    });

    expect(recalculateBalancesMock).toHaveBeenCalledOnce();
    expect(mockRepo.flush.mock.invocationCallOrder[0]).toBeLessThan(
      recalculateBalancesMock.mock.invocationCallOrder[0]!,
    );

    let resolved = false;
    void migrationPromise.then(() => {
      resolved = true;
    });

    await flushPromises();
    expect(resolved).toBe(false);

    balanceRecalculation.resolve(true);

    await expect(migrationPromise).resolves.toBe("mock-doc-1");
    expect(resolved).toBe(true);
  });
});

function createMigrationExpense(): MigrationData["expenses"][number] {
  return {
    name: "Lunch",
    paidAt: "2024-01-01T12:00:00.000Z",
    paidBy: {
      alice: 1000,
    },
    shares: {
      alice: {
        type: "divide",
        value: 1,
      },
      bob: {
        type: "divide",
        value: 1,
      },
    },
    photos: [],
  };
}

function createExpense(): Expense {
  return {
    id: "expense-1",
    name: "Lunch",
    paidAt: new Date("2024-01-01T12:00:00.000Z"),
    paidBy: {
      alice: 1000,
    },
    shares: {
      alice: {
        type: "divide",
        value: 1,
      },
      bob: {
        type: "divide",
        value: 1,
      },
    },
    photos: [],
    __hash: "hash",
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return {
    promise,
    resolve: resolve!,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
