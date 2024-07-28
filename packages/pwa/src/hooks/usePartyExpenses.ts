import {
  documentCache,
  handleCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import type { Party, PartyExpenseChunk } from "#src/models/party.js";
import type { DocumentId } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { startTransition, useCallback, useEffect, useState } from "react";

export function usePartyExpenses(partyId: DocumentId) {
  const repo = useRepo();

  const [party] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });

  const groupExpenses = useCallback(() => {
    return party.chunkIds
      .flatMap((chunkId) => {
        documentCache.prefetch(repo, chunkId);

        const chunkHandle = repo.find<PartyExpenseChunk>(chunkId);

        if (!chunkHandle.isReady()) {
          return [];
        }

        return chunkHandle.docSync()?.expenses ?? [];
      })
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  }, [party.chunkIds, repo]);

  const [expenses, setExpenses] = useState(() => groupExpenses());

  useEffect(() => {
    const scheduleRender = () => {
      const expenses = groupExpenses();

      startTransition(() => {
        setExpenses(expenses);
      });
    };

    const unsub = party.chunkIds.map((chunkId) => {
      const handle = handleCache.getValueIfCached(repo, chunkId);

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
  }, [party.chunkIds, repo, groupExpenses]);

  return expenses;
}
