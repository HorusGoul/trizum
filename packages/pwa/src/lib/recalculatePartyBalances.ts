import type { Repo } from "@automerge/automerge-repo/slim";
import { clone } from "@opentf/std";
import { diff } from "@opentf/obj-diff";
import { patchMutate } from "#src/lib/patchMutate.ts";
import { calculateBalancesByParticipant } from "#src/models/expense.ts";
import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "#src/models/party.ts";

export async function recalculatePartyBalances(repo: Repo, partyId: Party["id"]) {
  const partyHandle = await repo.find<Party>(partyId);
  const party = partyHandle.doc();

  if (!party) {
    throw new Error("Party not found, this should not happen");
  }

  const chunkEntries = await Promise.all(
    party.chunkRefs.map(async (chunkRef) => {
      const [chunkHandle, chunkBalancesHandle] = await Promise.all([
        repo.find<PartyExpenseChunk>(chunkRef.chunkId),
        repo.find<PartyExpenseChunkBalances>(chunkRef.balancesId),
      ]);

      const chunk = chunkHandle.doc();

      if (!chunk) {
        throw new Error("Chunk not found, this should not happen");
      }

      const balancesByParticipant = calculateBalancesByParticipant(
        chunk.expenses,
        party.participants,
      );

      const chunkBalances = chunkBalancesHandle.doc();

      if (!chunkBalances) {
        throw new Error("Chunk balances not found, this should not happen");
      }

      const patches = diff(clone(chunkBalances.balances), clone(balancesByParticipant));

      return {
        balancesId: chunkRef.balancesId,
        patches,
        chunkBalancesHandle,
      };
    }),
  );

  const changedBalancesIds: PartyExpenseChunkBalances["id"][] = [];

  for (const { balancesId, patches, chunkBalancesHandle } of chunkEntries) {
    if (patches.length === 0) {
      continue;
    }

    chunkBalancesHandle.change((doc) => {
      patchMutate(doc.balances, patches);
    });
    chunkBalancesHandle.doc();
    changedBalancesIds.push(balancesId);
  }

  if (changedBalancesIds.length > 0) {
    await repo.flush(changedBalancesIds);
  }

  return true;
}
