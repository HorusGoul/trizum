import { useDataRecord } from "#src/lib/data/hooks.ts";
import {
  getPartyPaginatedExpensesSnapshot,
  getVisiblePartyExpenseChunkIdsToLoad,
  loadVisiblePartyExpenseChunks,
  loadNextPartyExpenseChunks,
  type PartyPaginatedExpensesSnapshot,
  subscribeToPartyPaginatedExpenses,
} from "#src/lib/partyPaginatedExpenses.ts";
import type { Party } from "#src/models/party.js";
import { useAppData } from "#src/lib/data/useAppData.ts";
import { useEffect, useRef, useSyncExternalStore } from "react";

export function usePartyPaginatedExpenses(partyId: Party["id"]) {
  const data = useAppData();

  const [party] = useDataRecord<Party>(partyId, {
    required: true,
  });

  const chunkIds = party.chunkRefs.map((chunkRef) => chunkRef.chunkId);
  const visibleChunkIdsToLoad = getVisiblePartyExpenseChunkIdsToLoad(data, chunkIds);
  const snapshotRef = useRef<PartyPaginatedExpensesSnapshot | undefined>(undefined);
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
    void loadVisiblePartyExpenseChunks(data, chunkIds);
  }, [chunkIds, data, visibleChunkIdsToLoad, visibleChunkIdsToLoadKey]);

  const snapshot = useSyncExternalStore(
    (onStoreChange) => subscribeToPartyPaginatedExpenses(onStoreChange, data, chunkIds),
    () => {
      if (snapshotKeyRef.current !== snapshotKey) {
        snapshotKeyRef.current = snapshotKey;
        snapshotRef.current = undefined;
      }

      const nextSnapshot = getPartyPaginatedExpensesSnapshot(data, chunkIds);

      if (snapshotRef.current && areSnapshotsEqual(snapshotRef.current, nextSnapshot)) {
        return snapshotRef.current;
      }

      snapshotRef.current = nextSnapshot;

      return nextSnapshot;
    },
  );

  function loadNext() {
    void loadNextPartyExpenseChunks(data, chunkIds);
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
  if (previous.hasNext !== next.hasNext || previous.isLoadingNext !== next.isLoadingNext) {
    return false;
  }

  if (previous.expenses.length !== next.expenses.length) {
    return false;
  }

  for (let index = 0; index < previous.expenses.length; index++) {
    if (previous.expenses[index] !== next.expenses[index]) {
      return false;
    }
  }

  return true;
}
