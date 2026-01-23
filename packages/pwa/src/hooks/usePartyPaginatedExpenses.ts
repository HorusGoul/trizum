import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import type { Party, PartyExpenseChunk } from "#src/models/party.js";
import type { DocumentId } from "@trizum/sdk";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import {
  startTransition,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

export function usePartyPaginatedExpenses(partyId: DocumentId) {
  const repo = useRepo();
  const [party, handle] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });
  const chunkIds = party.chunkRefs.map((chunkRef) => chunkRef.chunkId);
  const [key, rerender] = useReducer((state) => state + 1, 1);

  function getLoadedChunkExpenses() {
    return getLoadedChunkIds().flatMap((chunkId) => {
      const doc = documentCache.getValueIfCached(repo, chunkId);

      if (!doc) {
        return [];
      }

      return doc.expenses;
    });
  }

  function getLoadedChunkIds() {
    const party = handle.doc();

    if (!party) {
      return [];
    }

    const ids = [];
    const chunkIds = party.chunkRefs.map((chunkRef) => chunkRef.chunkId);

    for (const chunkId of chunkIds) {
      const doc = documentCache.getValueIfCached(repo, chunkId);

      if (!doc) {
        // If a chunk is not loaded, we can't load any more
        break;
      }

      ids.push(chunkId);
    }

    return ids;
  }

  const [isLoadingNext, setIsLoadingNext] = useState(false);

  useEffect(() => {
    const toLoadIds: DocumentId[] = [];
    const loadedChunkIds = getLoadedChunkIds();

    if (loadedChunkIds.length === 0 && chunkIds.length > 0) {
      toLoadIds.push(chunkIds[0]);
    } else {
      for (let i = 0; i < chunkIds.length; i++) {
        const loadedChunkId =
          loadedChunkIds.length > i ? loadedChunkIds[i] : null;
        const chunkId = chunkIds[i];
        const isNewerChunk = loadedChunkId ? chunkId !== loadedChunkId : false;

        if (isNewerChunk) {
          toLoadIds.push(chunkId);
        }

        if (loadedChunkId === null) {
          break;
        }
      }
    }

    let unmounted = false;

    if (toLoadIds.length > 0) {
      void loadChunks();
    }

    async function loadChunks() {
      await Promise.all(
        toLoadIds.map((chunkId) => {
          return Promise.resolve(documentCache.readAsync(repo, chunkId));
        }),
      );

      if (unmounted) {
        return;
      }

      startTransition(() => {
        rerender();
      });
    }

    return () => {
      unmounted = true;
    };
  }, [chunkIds, key, getLoadedChunkIds, repo]);

  // Subscribe to loaded chunk changes
  useEffect(() => {
    const disposeBag = new Set<() => void>();
    let unmounted = false;

    async function subscribeToChunkChanges() {
      for (const chunkId of getLoadedChunkIds()) {
        const handle = await repo.find<PartyExpenseChunk>(
          chunkId as unknown as Parameters<typeof repo.find>[0],
        );

        if (unmounted) {
          return;
        }

        handle.on("change", onChange);

        function onChange() {
          startTransition(() => {
            rerender();
          });
        }

        disposeBag.add(() => {
          handle.off("change", onChange);
        });
      }
    }

    void subscribeToChunkChanges();

    return () => {
      disposeBag.forEach((dispose) => dispose());
      unmounted = true;
    };
  }, [key]);

  const nextChunkRefId = chunkIds.find(
    (chunkId) => !getLoadedChunkIds().includes(chunkId),
  );
  const hasNext = !!nextChunkRefId;

  function loadNext() {
    setIsLoadingNext(true);
    void load().finally(() => {
      setIsLoadingNext(false);
    });

    async function load() {
      if (!nextChunkRefId) {
        return;
      }

      await documentCache.readAsync(repo, nextChunkRefId);
      startTransition(() => {
        rerender();
      });
    }
  }

  const expenses = useMemo(
    () => getLoadedChunkExpenses(),
    [key, getLoadedChunkExpenses],
  );

  return {
    expenses,
    loadNext,
    isLoadingNext,
    hasNext,
  };
}
