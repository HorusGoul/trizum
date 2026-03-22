import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import {
  getPartyPaginatedExpensesSnapshot,
  getVisiblePartyExpenseChunkIdsToLoad,
  loadNextPartyExpenseChunks,
  type PartyPaginatedExpensesSnapshot,
  subscribeToPartyPaginatedExpenses,
} from "#src/lib/partyPaginatedExpenses.ts";
import type { Party } from "#src/models/party.js";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { use, useRef, useSyncExternalStore } from "react";

export function usePartyPaginatedExpenses(partyId: Party["id"]) {
  const repo = useRepo();
  const [party] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });
  const chunkIds = party.chunkRefs.map((chunkRef) => chunkRef.chunkId);
  const snapshotRef = useRef<PartyPaginatedExpensesSnapshot | undefined>(
    undefined,
  );
  const snapshotKeyRef = useRef<string>("");
  const snapshotKey = `${String(partyId)}:${chunkIds.join(",")}`;

  for (const chunkId of getVisiblePartyExpenseChunkIdsToLoad(repo, chunkIds)) {
    const maybeChunk = documentCache.readAsync(repo, chunkId);

    if (isPromiseLike(maybeChunk)) {
      use(maybeChunk);
    }
  }

  const snapshot = useSyncExternalStore(
    (onStoreChange) =>
      subscribeToPartyPaginatedExpenses(onStoreChange, repo, chunkIds),
    () => {
      if (snapshotKeyRef.current !== snapshotKey) {
        snapshotKeyRef.current = snapshotKey;
        snapshotRef.current = undefined;
      }

      const nextSnapshot = getPartyPaginatedExpensesSnapshot(repo, chunkIds);

      if (
        snapshotRef.current &&
        areSnapshotsEqual(snapshotRef.current, nextSnapshot)
      ) {
        return snapshotRef.current;
      }

      snapshotRef.current = nextSnapshot;
      return nextSnapshot;
    },
  );

  function loadNext() {
    void loadNextPartyExpenseChunks(repo, chunkIds);
  }

  return {
    expenses: snapshot.expenses,
    loadNext,
    isLoadingNext: snapshot.isLoadingNext,
    hasNext: snapshot.hasNext,
  };
}

function isPromiseLike<T>(value: PromiseLike<T> | T): value is PromiseLike<T> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function areSnapshotsEqual(
  previous: PartyPaginatedExpensesSnapshot,
  next: PartyPaginatedExpensesSnapshot,
): boolean {
  if (
    previous.hasNext !== next.hasNext ||
    previous.isLoadingNext !== next.isLoadingNext ||
    previous.expenses.length !== next.expenses.length
  ) {
    return false;
  }

  return previous.expenses.every(
    (expense, index) => expense === next.expenses[index],
  );
}
