import { beforeEach, describe, expect, test, vi } from "vitest";
import { createMockDocumentCacheCollection } from "#src/lib/testing/mockDocumentCache.ts";
import type { Expense } from "#src/models/expense.ts";
import { STATUS_PENDING } from "suspense";
import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";

type MockChunk = {
  id: DocumentId;
  expenses: Expense[];
};

const mockDocumentCacheCollection =
  createMockDocumentCacheCollection<MockChunk>();

const {
  availableDocuments: availableChunks,
  cachedDocuments: cachedChunks,
  documentStatuses: chunkStatuses,
  subscribers,
  documentCache,
  cacheDocument,
  notifySubscribers,
  reset,
} = mockDocumentCacheCollection;

vi.mock("#src/lib/automerge/suspense-hooks.ts", () => {
  return { documentCache: mockDocumentCacheCollection.documentCache };
});

const {
  getLoadedPartyExpenseChunkIds,
  getNextPartyExpenseChunkIds,
  getPartyPaginatedExpensesSnapshot,
  getVisiblePartyExpenseChunkIdsToLoad,
  loadAllPartyExpenseChunks,
  loadNextPartyExpenseChunks,
  loadVisiblePartyExpenseChunks,
  subscribeToPartyPaginatedExpenses,
} = await import("./partyPaginatedExpenses");

const repo = {} as Repo;
const chunk1 = toChunkId("chunk-1");
const chunk2 = toChunkId("chunk-2");
const chunk3 = toChunkId("chunk-3");
const allChunkIds = [chunk1, chunk2, chunk3];

describe("partyPaginatedExpenses", () => {
  beforeEach(() => {
    reset();
    vi.clearAllMocks();
  });

  test("returns the loaded contiguous chunk prefix", () => {
    registerChunk(chunk1);
    registerChunk(chunk2);
    registerChunk(chunk3);
    cacheChunk(chunk1);
    cacheChunk(chunk3);

    expect(getLoadedPartyExpenseChunkIds(repo, allChunkIds)).toEqual([chunk1]);
  });

  test("loads only the first page when nothing is cached yet", async () => {
    registerChunk(chunk1);
    registerChunk(chunk2);
    registerChunk(chunk3);

    expect(getVisiblePartyExpenseChunkIdsToLoad(repo, allChunkIds)).toEqual([
      chunk1,
    ]);

    await loadVisiblePartyExpenseChunks(repo, allChunkIds);

    expect(Array.from(cachedChunks.keys())).toEqual([chunk1]);
  });

  test("loads new leading chunks before already cached pages", async () => {
    registerChunk(chunk1);
    registerChunk(chunk2);
    registerChunk(chunk3);
    cacheChunk(chunk3);

    expect(getVisiblePartyExpenseChunkIdsToLoad(repo, allChunkIds)).toEqual([
      chunk1,
      chunk2,
    ]);

    await loadVisiblePartyExpenseChunks(repo, allChunkIds);

    expect(Array.from(cachedChunks.keys())).toEqual([chunk3, chunk1, chunk2]);
  });

  test("loads the next missing page after the contiguous prefix", async () => {
    registerChunk(chunk1);
    registerChunk(chunk2);
    registerChunk(chunk3);
    cacheChunk(chunk1);

    expect(getNextPartyExpenseChunkIds(repo, allChunkIds)).toEqual([chunk2]);

    await loadNextPartyExpenseChunks(repo, allChunkIds);

    expect(Array.from(cachedChunks.keys())).toEqual([chunk1, chunk2]);
  });

  test("loads the next older page after the visible loaded window", () => {
    registerChunk(chunk1);
    registerChunk(chunk2);
    registerChunk(chunk3);
    cacheChunk(chunk2);

    expect(getNextPartyExpenseChunkIds(repo, allChunkIds)).toEqual([chunk3]);
  });

  test("loads all missing chunks when requested", async () => {
    registerChunk(chunk1);
    registerChunk(chunk2);
    registerChunk(chunk3);
    cacheChunk(chunk1);

    await loadAllPartyExpenseChunks(repo, allChunkIds);

    expect(Array.from(cachedChunks.keys())).toEqual([chunk1, chunk2, chunk3]);
  });

  test("builds a snapshot with flattened expenses and next-page state", () => {
    registerChunk(chunk1, ["2024-01-01T00:00:00.000Z"]);
    registerChunk(chunk2, ["2023-01-01T00:00:00.000Z"]);
    registerChunk(chunk3, ["2022-01-01T00:00:00.000Z"]);
    cacheChunk(chunk1);
    chunkStatuses.set(chunk2, STATUS_PENDING);

    expect(getPartyPaginatedExpensesSnapshot(repo, allChunkIds)).toEqual({
      expenses: availableChunks.get(chunk1)?.expenses,
      hasNext: true,
      isLoadingNext: true,
    });
  });

  test("sorts loaded expenses from newest to oldest by paidAt", () => {
    registerChunk(chunk1, [
      "2024-01-01T00:00:00.000Z",
      "2021-01-01T00:00:00.000Z",
    ]);
    registerChunk(chunk2, [
      "2025-01-01T00:00:00.000Z",
      "2022-01-01T00:00:00.000Z",
    ]);
    cacheChunk(chunk1);
    cacheChunk(chunk2);

    expect(
      getPartyPaginatedExpensesSnapshot(repo, [chunk1, chunk2]).expenses.map(
        (expense) => expense.id,
      ),
    ).toEqual([
      `${chunk2}-expense-0`,
      `${chunk1}-expense-0`,
      `${chunk2}-expense-1`,
      `${chunk1}-expense-1`,
    ]);
  });

  test("keeps showing loaded expenses while new leading chunks load", () => {
    registerChunk(chunk1, ["2025-01-01T00:00:00.000Z"]);
    registerChunk(chunk2, ["2024-01-01T00:00:00.000Z"]);
    registerChunk(chunk3, ["2023-01-01T00:00:00.000Z"]);
    cacheChunk(chunk2);
    cacheChunk(chunk3);
    chunkStatuses.set(chunk1, STATUS_PENDING);

    expect(getPartyPaginatedExpensesSnapshot(repo, allChunkIds)).toEqual({
      expenses: [
        ...(availableChunks.get(chunk2)?.expenses ?? []),
        ...(availableChunks.get(chunk3)?.expenses ?? []),
      ],
      hasNext: false,
      isLoadingNext: false,
    });
  });

  test("subscribes to loaded chunks and the next page", () => {
    registerChunk(chunk1);
    registerChunk(chunk2);
    registerChunk(chunk3);
    cacheChunk(chunk1);
    cacheChunk(chunk2);

    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToPartyPaginatedExpenses(
      onStoreChange,
      repo,
      allChunkIds,
    );

    expect(documentCache.subscribe).toHaveBeenCalledTimes(3);
    expect(documentCache.subscribe).toHaveBeenNthCalledWith(
      1,
      onStoreChange,
      repo,
      chunk1,
    );
    expect(documentCache.subscribe).toHaveBeenNthCalledWith(
      2,
      onStoreChange,
      repo,
      chunk2,
    );
    expect(documentCache.subscribe).toHaveBeenNthCalledWith(
      3,
      onStoreChange,
      repo,
      chunk3,
    );

    unsubscribe();

    expect(subscribers.size).toBe(0);
  });

  test("notifies subscribers when a loaded chunk receives a new expense", () => {
    registerChunk(chunk1, ["2024-01-01T00:00:00.000Z"]);
    cacheChunk(chunk1);

    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToPartyPaginatedExpenses(onStoreChange, repo, [
      chunk1,
    ]);

    appendExpenseToCachedChunk(chunk1, "2025-01-01T00:00:00.000Z");

    expect(onStoreChange).toHaveBeenCalledTimes(1);
    expect(
      getPartyPaginatedExpensesSnapshot(repo, [chunk1]).expenses.map(
        (expense) => expense.id,
      ),
    ).toEqual([`${chunk1}-expense-1`, `${chunk1}-expense-0`]);

    unsubscribe();
  });
});

function registerChunk(
  chunkId: DocumentId,
  paidAtValues = ["2024-01-01T00:00:00.000Z"],
) {
  availableChunks.set(chunkId, {
    id: chunkId,
    expenses: paidAtValues.map((paidAt, index) =>
      createExpenseWithPaidAt(`${chunkId}-expense-${index}`, paidAt),
    ),
  });
}

function cacheChunk(chunkId: DocumentId) {
  cacheDocument(chunkId);
}

function createExpenseWithPaidAt(id: string, paidAt: string): Expense {
  return {
    id,
    paidAt: new Date(paidAt),
  } as Expense;
}

function appendExpenseToCachedChunk(chunkId: DocumentId, paidAt: string) {
  const chunk = cachedChunks.get(chunkId);

  if (!chunk) {
    throw new Error(`Chunk not cached: ${chunkId}`);
  }

  chunk.expenses.push(
    createExpenseWithPaidAt(
      `${chunkId}-expense-${chunk.expenses.length}`,
      paidAt,
    ),
  );
  notifySubscribers(chunkId);
}

function toChunkId(value: string): DocumentId {
  return value as DocumentId;
}
