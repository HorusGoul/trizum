import type { AppData } from "#src/lib/data/client.ts";
import type { Expense } from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import type { DocumentId } from "@automerge/automerge-repo/slim";

const STATUS_PENDING = "pending";

const DEFAULT_PAGE_SIZE = 1;

export interface PartyPaginatedExpensesSnapshot {
  expenses: Expense[];
  hasNext: boolean;
  isLoadingNext: boolean;
}

function getCachedPartyExpenseChunk(
  data: AppData,
  chunkId: DocumentId,
): PartyExpenseChunk | undefined {
  // SAFETY: chunkId comes from a PartyExpenseChunkRef; this cache slot therefore contains its expense chunk document.
  return data.peek(chunkId) as PartyExpenseChunk | undefined;
}

interface PartyExpenseCache {
  getCachedChunk(
    data: AppData,
    chunkId: DocumentId,
  ): Pick<PartyExpenseChunk, "expenses"> | undefined;
  readChunk(data: AppData, chunkId: DocumentId): PromiseLike<void>;
  getStatus(data: AppData, chunkId: DocumentId): string;
  subscribe: (listener: () => void, data: AppData, id: DocumentId) => () => void;
}

const defaultPartyExpenseCache: PartyExpenseCache = {
  getCachedChunk: getCachedPartyExpenseChunk,
  readChunk: (data, chunkId) => data.read(chunkId).then(() => undefined),
  getStatus: (data, id) => data.status(id),
  subscribe: (listener, data, id) => data.subscribe(id, listener),
};

export function createPartyExpensePagination(cache: PartyExpenseCache = defaultPartyExpenseCache) {
  function getLoadedPartyExpenseChunkIds(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): DocumentId[] {
    const loadedChunkIds: DocumentId[] = [];

    for (const chunkId of chunkIds) {
      if (!cache.getCachedChunk(data, chunkId)) {
        break;
      }

      loadedChunkIds.push(chunkId);
    }

    return loadedChunkIds;
  }

  function getVisiblePartyExpenseChunkIdsToLoad(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): DocumentId[] {
    if (chunkIds.length === 0) {
      return [];
    }

    const firstLoadedChunkIndex = chunkIds.findIndex((chunkId) =>
      Boolean(cache.getCachedChunk(data, chunkId)),
    );

    if (firstLoadedChunkIndex === -1) {
      return chunkIds.slice(0, DEFAULT_PAGE_SIZE);
    }

    return chunkIds.slice(0, firstLoadedChunkIndex);
  }

  function getNextPartyExpenseChunkIds(
    data: AppData,
    chunkIds: readonly DocumentId[],
    pageSize = DEFAULT_PAGE_SIZE,
  ): DocumentId[] {
    const firstLoadedChunkIndex = getFirstLoadedPartyExpenseChunkIndex(data, chunkIds);

    if (firstLoadedChunkIndex === -1) {
      return chunkIds.slice(0, pageSize);
    }

    const visibleLoadedChunkCount = getVisibleLoadedPartyExpenseChunkIds(data, chunkIds).length;

    return chunkIds.slice(
      firstLoadedChunkIndex + visibleLoadedChunkCount,
      firstLoadedChunkIndex + visibleLoadedChunkCount + pageSize,
    );
  }

  async function loadVisiblePartyExpenseChunks(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): Promise<void> {
    await loadPartyExpenseChunks(data, getVisiblePartyExpenseChunkIdsToLoad(data, chunkIds));
  }

  async function loadNextPartyExpenseChunks(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): Promise<void> {
    await loadPartyExpenseChunks(data, getNextPartyExpenseChunkIds(data, chunkIds));
  }

  async function loadAllPartyExpenseChunks(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): Promise<void> {
    const missingChunkIds = chunkIds.filter((chunkId) => !cache.getCachedChunk(data, chunkId));

    await loadPartyExpenseChunks(data, missingChunkIds);
  }

  function getPartyPaginatedExpensesSnapshot(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): PartyPaginatedExpensesSnapshot {
    const loadedChunkIds = getVisibleLoadedPartyExpenseChunkIds(data, chunkIds);
    const nextChunkId = getNextPartyExpenseChunkIds(data, chunkIds).at(0);

    const expenses = loadedChunkIds.flatMap((chunkId) => {
      const chunk = cache.getCachedChunk(data, chunkId);

      return chunk?.expenses ?? [];
    });

    expenses.sort((left: Expense, right: Expense) => {
      return getExpensePaidAtTimestamp(right) - getExpensePaidAtTimestamp(left);
    });

    return {
      expenses,
      hasNext: Boolean(nextChunkId),
      isLoadingNext: nextChunkId != null && cache.getStatus(data, nextChunkId) === STATUS_PENDING,
    };
  }

  function subscribeToPartyPaginatedExpenses(
    onStoreChange: () => void,
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): () => void {
    const loadedChunkIds = getVisibleLoadedPartyExpenseChunkIds(data, chunkIds);
    const visibleChunkIdsToLoad = getVisiblePartyExpenseChunkIdsToLoad(data, chunkIds);
    const nextChunkId = getNextPartyExpenseChunkIds(data, chunkIds).at(0);

    const chunkIdsToSubscribe = nextChunkId
      ? [...loadedChunkIds, ...visibleChunkIdsToLoad, nextChunkId]
      : [...loadedChunkIds, ...visibleChunkIdsToLoad];

    const uniqueChunkIds = new Set(chunkIdsToSubscribe);

    const unsubscribeCallbacks = Array.from(uniqueChunkIds, (chunkId) =>
      cache.subscribe(onStoreChange, data, chunkId),
    );

    return () => {
      for (const unsubscribe of unsubscribeCallbacks) {
        unsubscribe();
      }
    };
  }

  function getFirstLoadedPartyExpenseChunkIndex(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): number {
    return chunkIds.findIndex((chunkId) => Boolean(cache.getCachedChunk(data, chunkId)));
  }

  function getVisibleLoadedPartyExpenseChunkIds(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): DocumentId[] {
    const firstLoadedChunkIndex = getFirstLoadedPartyExpenseChunkIndex(data, chunkIds);

    if (firstLoadedChunkIndex === -1) {
      return [];
    }

    const visibleLoadedChunkIds: DocumentId[] = [];

    for (const chunkId of chunkIds.slice(firstLoadedChunkIndex)) {
      if (!cache.getCachedChunk(data, chunkId)) {
        break;
      }

      visibleLoadedChunkIds.push(chunkId);
    }

    return visibleLoadedChunkIds;
  }

  async function loadPartyExpenseChunks(
    data: AppData,
    chunkIds: readonly DocumentId[],
  ): Promise<void> {
    if (chunkIds.length === 0) {
      return;
    }

    await Promise.all(chunkIds.map((chunkId) => cache.readChunk(data, chunkId)));
  }

  function getExpensePaidAtTimestamp(expense: Expense): number {
    return expense.paidAt.getTime();
  }

  return {
    getLoadedPartyExpenseChunkIds,
    getVisiblePartyExpenseChunkIdsToLoad,
    getNextPartyExpenseChunkIds,
    loadVisiblePartyExpenseChunks,
    loadNextPartyExpenseChunks,
    loadAllPartyExpenseChunks,
    getPartyPaginatedExpensesSnapshot,
    subscribeToPartyPaginatedExpenses,
  };
}

export const {
  getLoadedPartyExpenseChunkIds,
  getVisiblePartyExpenseChunkIdsToLoad,
  getNextPartyExpenseChunkIds,
  loadVisiblePartyExpenseChunks,
  loadNextPartyExpenseChunks,
  loadAllPartyExpenseChunks,
  getPartyPaginatedExpensesSnapshot,
  subscribeToPartyPaginatedExpenses,
} = createPartyExpensePagination();
