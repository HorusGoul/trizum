import type { DocHandle, Repo, UrlHeads } from "@automerge/automerge-repo/slim";
import type { Party, PartyExpenseChunkBalances } from "#src/models/party.ts";

export type PartyBalanceHeadsById = Record<PartyExpenseChunkBalances["id"], UrlHeads>;

export interface PartyBalanceHeadsResult {
  balanceHeadsById: PartyBalanceHeadsById;
}

const defaultWaitTimeoutMs = 5_000;

export async function readPartyBalanceHeads(
  repo: Repo,
  partyId: Party["id"],
): Promise<PartyBalanceHeadsResult> {
  const partyHandle = await repo.find<Party>(partyId);
  const party = partyHandle.doc();

  if (!party) {
    throw new Error("Party not found, this should not happen");
  }

  const balanceHeadEntries = await Promise.all(
    party.chunkRefs.map(async (chunkRef) => {
      const balanceHandle = await repo.find<PartyExpenseChunkBalances>(chunkRef.balancesId);

      return [chunkRef.balancesId, balanceHandle.heads()] as const;
    }),
  );

  return {
    balanceHeadsById: Object.fromEntries(balanceHeadEntries) as PartyBalanceHeadsById,
  };
}

export async function waitForPartyBalanceHeads(
  repo: Repo,
  targetHeadsById: PartyBalanceHeadsById,
  { timeoutMs = defaultWaitTimeoutMs }: { timeoutMs?: number } = {},
) {
  await Promise.all(
    Object.entries(targetHeadsById).map(async ([balancesId, targetHeads]) => {
      const balanceHandle = await repo.find<PartyExpenseChunkBalances>(
        balancesId as PartyExpenseChunkBalances["id"],
      );

      await waitForHandleHeads(balanceHandle, targetHeads, timeoutMs);
    }),
  );
}

function waitForHandleHeads<T>(handle: DocHandle<T>, targetHeads: UrlHeads, timeoutMs: number) {
  if (headsAreEqual(handle.heads(), targetHeads)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for balance document ${handle.documentId} to sync`));
    }, timeoutMs);

    function onHeadsChanged() {
      if (!headsAreEqual(handle.heads(), targetHeads)) {
        return;
      }

      cleanup();
      resolve();
    }

    function cleanup() {
      window.clearTimeout(timeoutId);
      handle.off("heads-changed", onHeadsChanged);
      handle.off("change", onHeadsChanged);
    }

    handle.on("heads-changed", onHeadsChanged);
    handle.on("change", onHeadsChanged);
    onHeadsChanged();
  });
}

function headsAreEqual(left: UrlHeads, right: UrlHeads) {
  return serializeHeads(left) === serializeHeads(right);
}

function serializeHeads(heads: UrlHeads) {
  return heads.slice().sort().join("\0");
}
