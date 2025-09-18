import {
  documentCache,
  handleCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import type { Party, PartyExpenseChunk } from "#src/models/party.js";
import type { DocumentId } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { startTransition, useCallback, useEffect, useState } from "react";

export function usePartyPaginatedExpenses(partyId: DocumentId) {
  const repo = useRepo();

  const [party] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });

  const groupExpenses = useCallback(() => {
    return party.chunkRefs
      .flatMap((chunkRef) => {
        documentCache.prefetch(repo, chunkRef.chunkId);

        const chunkHandle = repo.find<PartyExpenseChunk>(chunkRef.chunkId);

        if (!chunkHandle.isReady()) {
          return [];
        }

        return chunkHandle.docSync()?.expenses ?? [];
      })
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  }, [party.chunkRefs, repo]);

  const [expenses, setExpenses] = useState(() => groupExpenses());

  useEffect(() => {
    const scheduleRender = () => {
      const expenses = groupExpenses();

      startTransition(() => {
        setExpenses(expenses);
      });
    };

    const unsub = party.chunkRefs.map((chunkRef) => {
      const handle = handleCache.getValueIfCached(repo, chunkRef.chunkId);

      if (!handle) {
        return () => null;
      }

      handle.on("change", scheduleRender);

      return () => {
        handle.off("change", scheduleRender);
      };
    });

    return () => {
      unsub.forEach((fn) => fn());
    };
  }, [party.chunkRefs, repo, groupExpenses]);

  return expenses;
}
