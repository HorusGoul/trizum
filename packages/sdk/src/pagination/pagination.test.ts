import { describe, test, expect } from "vitest";
import {
  createChunkPagination,
  getNextChunkIds,
  collectExpensesFromChunks,
  updatePaginationAfterLoad,
  needsInitialChunkLoad,
  getInitialChunkId,
  createPaginatedExpenses,
} from "./chunk-iterator.js";
import type { Party, PartyExpenseChunk } from "../models/party.js";
import type { DocumentId } from "../types.js";
import type { Expense } from "../models/expense.js";

function createMockParty(chunkIds: string[]): Party {
  return {
    id: "party-1" as DocumentId,
    type: "party",
    __schemaVersion: 1,
    name: "Test Party",
    description: "",
    currency: "EUR",
    participants: {},
    chunkRefs: chunkIds.map((chunkId, index) => ({
      chunkId: chunkId as DocumentId,
      createdAt: new Date(2024, 0, index + 1),
      balancesId: `balances-${index}` as DocumentId,
    })),
  };
}

function createMockChunk(
  id: string,
  expenses: Partial<Expense>[],
  createdAt: Date,
): PartyExpenseChunk {
  return {
    id: id as DocumentId,
    type: "expenseChunk",
    __schemaVersion: 1,
    createdAt,
    expenses: expenses.map((e, i) => ({
      id: `expense-${i}`,
      __schemaVersion: 1,
      name: `Expense ${i}`,
      paidAt: new Date(),
      paidBy: {},
      shares: {},
      photos: [],
      __hash: "",
      ...e,
    })),
    maxSize: 500,
    partyId: "party-1" as DocumentId,
  };
}

describe("createChunkPagination", () => {
  test("should create initial pagination state with no loaded chunks", () => {
    const party = createMockParty(["chunk-1", "chunk-2", "chunk-3"]);

    const state = createChunkPagination(party);

    expect(state.loadedChunkIds).toEqual([]);
    expect(state.availableChunkIds).toEqual(["chunk-3", "chunk-2", "chunk-1"]);
    expect(state.hasMore).toBe(true);
    expect(state.totalChunks).toBe(3);
    expect(state.loadedChunks).toBe(0);
  });

  test("should track loaded chunks", () => {
    const party = createMockParty(["chunk-1", "chunk-2", "chunk-3"]);

    const state = createChunkPagination(party, ["chunk-3" as DocumentId]);

    expect(state.loadedChunkIds).toEqual(["chunk-3"]);
    expect(state.availableChunkIds).toEqual(["chunk-2", "chunk-1"]);
    expect(state.hasMore).toBe(true);
    expect(state.loadedChunks).toBe(1);
  });

  test("should indicate no more when all chunks loaded", () => {
    const party = createMockParty(["chunk-1", "chunk-2"]);

    const state = createChunkPagination(party, [
      "chunk-1" as DocumentId,
      "chunk-2" as DocumentId,
    ]);

    expect(state.hasMore).toBe(false);
    expect(state.loadedChunks).toBe(2);
    expect(state.totalChunks).toBe(2);
  });

  test("should handle party with no chunks", () => {
    const party = createMockParty([]);

    const state = createChunkPagination(party);

    expect(state.hasMore).toBe(false);
    expect(state.totalChunks).toBe(0);
    expect(state.availableChunkIds).toEqual([]);
  });
});

describe("getNextChunkIds", () => {
  test("should return next chunk to load", () => {
    const party = createMockParty(["chunk-1", "chunk-2", "chunk-3"]);

    const nextIds = getNextChunkIds(party, []);

    // Should return newest first (chunk-3)
    expect(nextIds).toEqual(["chunk-3"]);
  });

  test("should return multiple chunks when requested", () => {
    const party = createMockParty(["chunk-1", "chunk-2", "chunk-3"]);

    const nextIds = getNextChunkIds(party, [], 2);

    expect(nextIds).toEqual(["chunk-3", "chunk-2"]);
  });

  test("should skip already loaded chunks", () => {
    const party = createMockParty(["chunk-1", "chunk-2", "chunk-3"]);

    const nextIds = getNextChunkIds(party, ["chunk-3" as DocumentId], 2);

    expect(nextIds).toEqual(["chunk-2", "chunk-1"]);
  });

  test("should return empty array when all loaded", () => {
    const party = createMockParty(["chunk-1"]);

    const nextIds = getNextChunkIds(party, ["chunk-1" as DocumentId]);

    expect(nextIds).toEqual([]);
  });
});

describe("collectExpensesFromChunks", () => {
  test("should collect expenses from multiple chunks", () => {
    const chunk1 = createMockChunk(
      "chunk-1",
      [{ name: "Expense A" }, { name: "Expense B" }],
      new Date(2024, 0, 1),
    );
    const chunk2 = createMockChunk(
      "chunk-2",
      [{ name: "Expense C" }],
      new Date(2024, 0, 2),
    );

    const expenses = collectExpensesFromChunks([chunk1, chunk2]);

    expect(expenses).toHaveLength(3);
    // Newer chunk (chunk-2) should come first
    expect(expenses[0].name).toBe("Expense C");
    expect(expenses[1].name).toBe("Expense A");
    expect(expenses[2].name).toBe("Expense B");
  });

  test("should handle empty chunks array", () => {
    const expenses = collectExpensesFromChunks([]);

    expect(expenses).toEqual([]);
  });

  test("should handle chunks with no expenses", () => {
    const chunk = createMockChunk("chunk-1", [], new Date());

    const expenses = collectExpensesFromChunks([chunk]);

    expect(expenses).toEqual([]);
  });
});

describe("updatePaginationAfterLoad", () => {
  test("should update state after loading new chunks", () => {
    const party = createMockParty(["chunk-1", "chunk-2", "chunk-3"]);
    const previousState = createChunkPagination(party, [
      "chunk-3" as DocumentId,
    ]);

    const newState = updatePaginationAfterLoad(party, previousState, [
      "chunk-2" as DocumentId,
    ]);

    expect(newState.loadedChunkIds).toEqual(["chunk-3", "chunk-2"]);
    expect(newState.availableChunkIds).toEqual(["chunk-1"]);
    expect(newState.loadedChunks).toBe(2);
  });
});

describe("needsInitialChunkLoad", () => {
  test("should return true when newest chunk not loaded", () => {
    const party = createMockParty(["chunk-1", "chunk-2"]);

    expect(needsInitialChunkLoad(party, [])).toBe(true);
    expect(needsInitialChunkLoad(party, ["chunk-1" as DocumentId])).toBe(true);
  });

  test("should return false when newest chunk is loaded", () => {
    const party = createMockParty(["chunk-1", "chunk-2"]);

    expect(needsInitialChunkLoad(party, ["chunk-2" as DocumentId])).toBe(false);
  });

  test("should return false for party with no chunks", () => {
    const party = createMockParty([]);

    expect(needsInitialChunkLoad(party, [])).toBe(false);
  });
});

describe("getInitialChunkId", () => {
  test("should return newest chunk ID", () => {
    const party = createMockParty(["chunk-1", "chunk-2", "chunk-3"]);

    expect(getInitialChunkId(party)).toBe("chunk-3");
  });

  test("should return undefined for party with no chunks", () => {
    const party = createMockParty([]);

    expect(getInitialChunkId(party)).toBeUndefined();
  });
});

describe("createPaginatedExpenses", () => {
  test("should create paginated result from chunks", () => {
    const party = createMockParty(["chunk-1", "chunk-2"]);
    const chunks = [
      createMockChunk("chunk-2", [{ name: "Expense A" }], new Date(2024, 0, 2)),
    ];

    const result = createPaginatedExpenses(party, chunks);

    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0].name).toBe("Expense A");
    expect(result.pagination.loadedChunks).toBe(1);
    expect(result.pagination.hasMore).toBe(true);
  });
});
