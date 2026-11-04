import { documentCache } from "#src/lib/automerge/suspense-hooks.ts";
import type { Expense } from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import { STATUS_PENDING } from "@trizum/react-suspense-cache";

const DEFAULT_PAGE_SIZE = 1;

export interface PartyPaginatedExpensesSnapshot {
  expenses: Expense[];
  hasNext: boolean;
  isLoadingNext: boolean;
}

function getCachedPartyExpenseChunk(
  repo: Repo,
  chunkId: DocumentId,
): PartyExpenseChunk | undefined {
  // SAFETY: chunkId comes from a PartyExpenseChunkRef; this cache slot therefore contains its expense chunk document.
  return documentCache.getValueIfCached(repo, chunkId) as PartyExpenseChunk | undefined;
}

interface PartyExpenseCache {
  getCachedChunk(repo: Repo, chunkId: DocumentId): Pick<PartyExpenseChunk, "expenses"> | undefined;
  readChunk(repo: Repo, chunkId: DocumentId): PromiseLike<void>;
  getStatus(repo: Repo, chunkId: DocumentId): string;
  subscribe: typeof documentCache.subscribe;
}

const defaultPartyExpenseCache: PartyExpenseCache = {
  getCachedChunk: getCachedPartyExpenseChunk,
  readChunk: (repo, chunkId) => documentCache.readAsync(repo, chunkId).then(() => undefined),
  getStatus: (...args) => documentCache.getStatus(...args),
  subscribe: (...args) => documentCache.subscribe(...args),
};

export function createPartyExpensePagination(cache: PartyExpenseCache = defaultPartyExpenseCache) {
  function getLoadedPartyExpenseChunkIds(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): DocumentId[] {
    const loadedChunkIds: DocumentId[] = [];

    for (const chunkId of chunkIds) {
      if (!cache.getCachedChunk(repo, chunkId)) {
        break;
      }

      loadedChunkIds.push(chunkId);
    }

    return loadedChunkIds;
  }

  function getVisiblePartyExpenseChunkIdsToLoad(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): DocumentId[] {
    if (chunkIds.length === 0) {
      return [];
    }

    const firstLoadedChunkIndex = chunkIds.findIndex((chunkId) =>
      Boolean(cache.getCachedChunk(repo, chunkId)),
    );

    if (firstLoadedChunkIndex === -1) {
      return chunkIds.slice(0, DEFAULT_PAGE_SIZE);
    }

    return chunkIds.slice(0, firstLoadedChunkIndex);
  }

  function getNextPartyExpenseChunkIds(
    repo: Repo,
    chunkIds: readonly DocumentId[],
    pageSize = DEFAULT_PAGE_SIZE,
  ): DocumentId[] {
    const firstLoadedChunkIndex = getFirstLoadedPartyExpenseChunkIndex(repo, chunkIds);

    if (firstLoadedChunkIndex === -1) {
      return chunkIds.slice(0, pageSize);
    }

    const visibleLoadedChunkCount = getVisibleLoadedPartyExpenseChunkIds(repo, chunkIds).length;

    return chunkIds.slice(
      firstLoadedChunkIndex + visibleLoadedChunkCount,
      firstLoadedChunkIndex + visibleLoadedChunkCount + pageSize,
    );
  }

  async function loadVisiblePartyExpenseChunks(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): Promise<void> {
    await loadPartyExpenseChunks(repo, getVisiblePartyExpenseChunkIdsToLoad(repo, chunkIds));
  }

  async function loadNextPartyExpenseChunks(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): Promise<void> {
    await loadPartyExpenseChunks(repo, getNextPartyExpenseChunkIds(repo, chunkIds));
  }

  async function loadAllPartyExpenseChunks(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): Promise<void> {
    const missingChunkIds = chunkIds.filter((chunkId) => !cache.getCachedChunk(repo, chunkId));

    await loadPartyExpenseChunks(repo, missingChunkIds);
  }

  function getPartyPaginatedExpensesSnapshot(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): PartyPaginatedExpensesSnapshot {
    const loadedChunkIds = getVisibleLoadedPartyExpenseChunkIds(repo, chunkIds);
    const nextChunkId = getNextPartyExpenseChunkIds(repo, chunkIds).at(0);

    const expenses = loadedChunkIds.flatMap((chunkId) => {
      const chunk = cache.getCachedChunk(repo, chunkId);

      return chunk?.expenses ?? [];
    });

    expenses.sort((left: Expense, right: Expense) => {
      return getExpensePaidAtTimestamp(right) - getExpensePaidAtTimestamp(left);
    });

    return {
      expenses,
      hasNext: Boolean(nextChunkId),
      isLoadingNext: nextChunkId != null && cache.getStatus(repo, nextChunkId) === STATUS_PENDING,
    };
  }

  function subscribeToPartyPaginatedExpenses(
    onStoreChange: () => void,
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): () => void {
    const loadedChunkIds = getVisibleLoadedPartyExpenseChunkIds(repo, chunkIds);
    const visibleChunkIdsToLoad = getVisiblePartyExpenseChunkIdsToLoad(repo, chunkIds);
    const nextChunkId = getNextPartyExpenseChunkIds(repo, chunkIds).at(0);

    const chunkIdsToSubscribe = nextChunkId
      ? [...loadedChunkIds, ...visibleChunkIdsToLoad, nextChunkId]
      : [...loadedChunkIds, ...visibleChunkIdsToLoad];

    const uniqueChunkIds = new Set(chunkIdsToSubscribe);

    const unsubscribeCallbacks = Array.from(uniqueChunkIds, (chunkId) =>
      cache.subscribe(onStoreChange, repo, chunkId),
    );

    return () => {
      for (const unsubscribe of unsubscribeCallbacks) {
        unsubscribe();
      }
    };
  }

  function getFirstLoadedPartyExpenseChunkIndex(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): number {
    return chunkIds.findIndex((chunkId) => Boolean(cache.getCachedChunk(repo, chunkId)));
  }

  function getVisibleLoadedPartyExpenseChunkIds(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): DocumentId[] {
    const firstLoadedChunkIndex = getFirstLoadedPartyExpenseChunkIndex(repo, chunkIds);

    if (firstLoadedChunkIndex === -1) {
      return [];
    }

    const visibleLoadedChunkIds: DocumentId[] = [];

    for (const chunkId of chunkIds.slice(firstLoadedChunkIndex)) {
      if (!cache.getCachedChunk(repo, chunkId)) {
        break;
      }

      visibleLoadedChunkIds.push(chunkId);
    }

    return visibleLoadedChunkIds;
  }

  async function loadPartyExpenseChunks(
    repo: Repo,
    chunkIds: readonly DocumentId[],
  ): Promise<void> {
    if (chunkIds.length === 0) {
      return;
    }

    await Promise.all(chunkIds.map((chunkId) => cache.readChunk(repo, chunkId)));
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
