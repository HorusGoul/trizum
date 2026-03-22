import { documentCache } from "#src/lib/automerge/suspense-hooks.ts";
import type { Expense } from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import { STATUS_PENDING } from "suspense";

const DEFAULT_PAGE_SIZE = 1;

export interface PartyPaginatedExpensesSnapshot {
  expenses: Expense[];
  hasNext: boolean;
  isLoadingNext: boolean;
}

export function getLoadedPartyExpenseChunkIds(
  repo: Repo,
  chunkIds: readonly DocumentId[],
): DocumentId[] {
  const loadedChunkIds: DocumentId[] = [];

  for (const chunkId of chunkIds) {
    if (!getCachedPartyExpenseChunk(repo, chunkId)) {
      break;
    }

    loadedChunkIds.push(chunkId);
  }

  return loadedChunkIds;
}

export function getVisiblePartyExpenseChunkIdsToLoad(
  repo: Repo,
  chunkIds: readonly DocumentId[],
): DocumentId[] {
  if (chunkIds.length === 0) {
    return [];
  }

  const firstLoadedChunkIndex = chunkIds.findIndex((chunkId) =>
    Boolean(getCachedPartyExpenseChunk(repo, chunkId)),
  );

  if (firstLoadedChunkIndex === -1) {
    return chunkIds.slice(0, DEFAULT_PAGE_SIZE);
  }

  return chunkIds.slice(0, firstLoadedChunkIndex);
}

export function getNextPartyExpenseChunkIds(
  repo: Repo,
  chunkIds: readonly DocumentId[],
  pageSize = DEFAULT_PAGE_SIZE,
): DocumentId[] {
  const loadedChunkCount = getLoadedPartyExpenseChunkIds(repo, chunkIds).length;

  return chunkIds.slice(loadedChunkCount, loadedChunkCount + pageSize);
}

export async function loadVisiblePartyExpenseChunks(
  repo: Repo,
  chunkIds: readonly DocumentId[],
): Promise<void> {
  await loadPartyExpenseChunks(
    repo,
    getVisiblePartyExpenseChunkIdsToLoad(repo, chunkIds),
  );
}

export async function loadNextPartyExpenseChunks(
  repo: Repo,
  chunkIds: readonly DocumentId[],
): Promise<void> {
  await loadPartyExpenseChunks(
    repo,
    getNextPartyExpenseChunkIds(repo, chunkIds),
  );
}

export async function loadAllPartyExpenseChunks(
  repo: Repo,
  chunkIds: readonly DocumentId[],
): Promise<void> {
  const missingChunkIds = chunkIds.filter(
    (chunkId) => !getCachedPartyExpenseChunk(repo, chunkId),
  );

  await loadPartyExpenseChunks(repo, missingChunkIds);
}

export function getPartyPaginatedExpensesSnapshot(
  repo: Repo,
  chunkIds: readonly DocumentId[],
): PartyPaginatedExpensesSnapshot {
  const loadedChunkIds = getLoadedPartyExpenseChunkIds(repo, chunkIds);
  const nextChunkId = getNextPartyExpenseChunkIds(repo, chunkIds).at(0);
  const expenses = loadedChunkIds.flatMap((chunkId) => {
    const chunk = getCachedPartyExpenseChunk(repo, chunkId);

    return chunk?.expenses ?? [];
  });

  expenses.sort((left: Expense, right: Expense) => {
    return getExpensePaidAtTimestamp(right) - getExpensePaidAtTimestamp(left);
  });

  return {
    expenses,
    hasNext: Boolean(nextChunkId),
    isLoadingNext:
      nextChunkId != null &&
      documentCache.getStatus(repo, nextChunkId) === STATUS_PENDING,
  };
}

export function subscribeToPartyPaginatedExpenses(
  onStoreChange: () => void,
  repo: Repo,
  chunkIds: readonly DocumentId[],
): () => void {
  const loadedChunkIds = getLoadedPartyExpenseChunkIds(repo, chunkIds);
  const nextChunkId = getNextPartyExpenseChunkIds(repo, chunkIds).at(0);
  const chunkIdsToSubscribe = nextChunkId
    ? [...loadedChunkIds, nextChunkId]
    : loadedChunkIds;
  const uniqueChunkIds = new Set(chunkIdsToSubscribe);
  const unsubscribeCallbacks = Array.from(uniqueChunkIds, (chunkId) =>
    documentCache.subscribe(onStoreChange, repo, chunkId),
  );

  return () => {
    for (const unsubscribe of unsubscribeCallbacks) {
      unsubscribe();
    }
  };
}

function getCachedPartyExpenseChunk(
  repo: Repo,
  chunkId: DocumentId,
): PartyExpenseChunk | undefined {
  return documentCache.getValueIfCached(repo, chunkId) as
    | PartyExpenseChunk
    | undefined;
}

async function loadPartyExpenseChunks(
  repo: Repo,
  chunkIds: readonly DocumentId[],
): Promise<void> {
  if (chunkIds.length === 0) {
    return;
  }

  await Promise.all(
    chunkIds.map((chunkId) =>
      Promise.resolve(documentCache.readAsync(repo, chunkId)),
    ),
  );
}

function getExpensePaidAtTimestamp(expense: Expense): number {
  return expense.paidAt.getTime();
}
