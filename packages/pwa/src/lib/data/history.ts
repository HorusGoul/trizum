import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import type { Party } from "#src/models/party.ts";
import type { ExpenseHistoryEntity } from "./entities.ts";
import {
  getPartyPaginatedExpensesSnapshot,
  getVisiblePartyExpenseChunkIdsToLoad,
  loadVisiblePartyExpenseChunks,
  loadNextPartyExpenseChunks,
  type ExpenseHistorySource,
} from "../partyPaginatedExpenses.ts";

/** Pagination owns acquisition; React observes one normalized history entity. */
export function createExpenseHistory(
  source: ExpenseHistorySource,
  hydrateLocal: (id: string) => void,
  publish: (page: ExpenseHistoryEntity) => void,
) {
  const watches = new Map<string, { key: string; stop(): void }>();
  const snapshots = new Map<string, ExpenseHistoryEntity>();
  const updating = new Set<string>();
  const loading = new Map<string, Promise<void>>();
  let disposed = false;

  function prepare(id: string, force = false) {
    if (disposed || updating.has(id) || !isValidDocumentId(id)) return;
    updating.add(id);

    try {
      hydrateLocal(id);
      const party = source.peek<Party>(id);

      if (!party) return;
      const chunkIds = party.chunkRefs.map(({ chunkId }) => chunkId);
      const key = chunkIds.join(",");

      if (watches.get(id)?.key !== key) {
        watches.get(id)?.stop();

        const stops = [id, ...chunkIds].map((recordId) =>
          source.subscribe(recordId, () => prepare(id)),
        );

        watches.set(id, {
          key,
          stop: () => {
            for (const stop of stops) stop();
          },
        });
      }

      for (const chunkId of getVisiblePartyExpenseChunkIdsToLoad(source, chunkIds))
        hydrateLocal(chunkId);

      if (getVisiblePartyExpenseChunkIdsToLoad(source, chunkIds).length) {
        void load(id).catch(() => {
          /* A mounted history read reports acquisition failures through Fate. */
        });

        return;
      }

      const snapshot = getPartyPaginatedExpensesSnapshot(source, chunkIds);

      const next: ExpenseHistoryEntity = {
        __typename: "ExpenseHistory",
        id,
        expenseIds: snapshot.expenses.map(({ id }) => id),
        hasNext: snapshot.hasNext,
        isLoadingNext: snapshot.isLoadingNext,
      };

      const previous = snapshots.get(id);

      if (
        !force &&
        previous &&
        previous.hasNext === next.hasNext &&
        previous.isLoadingNext === next.isLoadingNext &&
        previous.expenseIds.length === next.expenseIds.length &&
        previous.expenseIds.every((expenseId, index) => expenseId === next.expenseIds[index])
      )
        return;
      snapshots.set(id, next);
      publish(next);
    } finally {
      updating.delete(id);
    }
  }

  function load(id: string): Promise<void> {
    const pending = loading.get(id);

    if (pending) return pending;

    const promise = (async () => {
      const party = await source.read<Party>(id);

      if (!party) throw new Error("Party unavailable");
      await loadVisiblePartyExpenseChunks(
        source,
        party.chunkRefs.map(({ chunkId }) => chunkId),
      );
      prepare(id, true);
    })();

    loading.set(id, promise);
    void promise.finally(() => loading.delete(id)).catch(() => {});

    return promise;
  }

  return {
    prepare,
    async load(id: string) {
      await load(id);

      return snapshots.get(id);
    },
    async loadNext(id: string) {
      await load(id);
      const party = source.peek<Party>(id);

      if (!party) throw new Error("Party unavailable");
      await loadNextPartyExpenseChunks(
        source,
        party.chunkRefs.map(({ chunkId }) => chunkId),
      );
      prepare(id, true);
    },
    dispose() {
      disposed = true;

      for (const watch of watches.values()) watch.stop();
      watches.clear();
      snapshots.clear();
    },
  };
}
