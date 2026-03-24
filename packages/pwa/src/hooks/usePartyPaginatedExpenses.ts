import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import {
  getPartyPaginatedExpensesSnapshot,
  getVisiblePartyExpenseChunkIdsToLoad,
  loadVisiblePartyExpenseChunks,
  loadNextPartyExpenseChunks,
  type PartyPaginatedExpensesSnapshot,
  subscribeToPartyPaginatedExpenses,
} from "#src/lib/partyPaginatedExpenses.ts";
import type { Party } from "#src/models/party.js";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { useEffect, useRef, useSyncExternalStore } from "react";

export function usePartyPaginatedExpenses(partyId: Party["id"]) {
  const repo = useRepo();
  const [party] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });
  const chunkIds = party.chunkRefs.map((chunkRef) => chunkRef.chunkId);
  const visibleChunkIdsToLoad = getVisiblePartyExpenseChunkIdsToLoad(
    repo,
    chunkIds,
  );
  const snapshotRef = useRef<PartyPaginatedExpensesSnapshot | undefined>(
    undefined,
  );
  const snapshotKeyRef = useRef<string>("");
  const snapshotKey = `${String(partyId)}:${chunkIds.join(",")}`;
  const requestedVisibleChunkIdsKeyRef = useRef("");
  const visibleChunkIdsToLoadKey = visibleChunkIdsToLoad.join(",");

  useEffect(() => {
    if (visibleChunkIdsToLoad.length === 0) {
      requestedVisibleChunkIdsKeyRef.current = "";
      return;
    }

    if (requestedVisibleChunkIdsKeyRef.current === visibleChunkIdsToLoadKey) {
      return;
    }

    requestedVisibleChunkIdsKeyRef.current = visibleChunkIdsToLoadKey;
    void loadVisiblePartyExpenseChunks(repo, chunkIds);
  }, [chunkIds, repo, visibleChunkIdsToLoad, visibleChunkIdsToLoadKey]);

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
