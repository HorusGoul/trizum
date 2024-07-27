import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import type { Party, PartyExpenseChunk } from "#src/models/party.js";
import type { DocumentId } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { useMemo } from "react";

export function usePartyExpenses(partyId: DocumentId) {
  const repo = useRepo();

  const [party] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });

  return useMemo(
    () =>
      party.chunkIds
        .flatMap((chunkId) => {
          documentCache.prefetch(repo, chunkId);

          const chunkHandle = repo.find<PartyExpenseChunk>(chunkId);

          if (!chunkHandle.isReady()) {
            return [];
          }

          return chunkHandle.docSync()?.expenses ?? [];
        })
        .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()),
    [party.chunkIds, repo],
  );
}
