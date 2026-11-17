import type { ChangeFn } from "@automerge/automerge";
import { recalculatePartyBalances } from "../../src/lib/recalculatePartyBalances";
import type { Party, PartyExpenseChunkRef } from "../../src/models/party";
import type { AutomergeDocuments } from "../automergeDocuments";

/** Adapt acknowledged Worker writes to the PWA recalculator, scoped to one validated chunk. */
export async function recalculateChunkBalances(
  documents: Pick<AutomergeDocuments, "find">,
  party: Party,
  reference: PartyExpenseChunkRef,
) {
  const allowed = new Set([party.id, reference.chunkId, reference.balancesId]);
  const writes: Promise<unknown>[] = [];
  let changed = false;

  const repo: Parameters<typeof recalculatePartyBalances>[0] = {
    async find<Document>(id: Party["id"]) {
      if (!allowed.has(id))
        throw new Error("Balance recalculation exceeded the requested chunk scope.");
      const handle = await documents.find<Document>(id);

      return {
        doc: () => {
          const snapshot = handle.doc();

          // A transient input view selects the affected chunk without changing the party document.
          return id === party.id
            ? Object.assign({}, snapshot, { chunkRefs: [reference] })
            : snapshot;
        },
        change: (change: ChangeFn<Document>) => {
          if (id !== reference.balancesId)
            throw new Error("Balance recalculation may only write its projection.");
          changed = true;
          writes.push(handle.change(change));
        },
      };
    },
    async flush() {
      await Promise.all(writes);
    },
  };

  await recalculatePartyBalances(repo, party.id);

  return changed;
}
