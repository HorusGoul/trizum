import { getHeads, hasHeads, type Heads } from "@automerge/automerge/slim";
import type { DocHandle, DocumentId, Repo } from "@automerge/automerge-repo/slim";
import type { Party, PartyExpenseChunk } from "#src/models/party.ts";
import { recalculatePartyBalances } from "#src/lib/recalculatePartyBalances.ts";

export interface DocumentHeads {
  documentId: DocumentId;
  heads: Heads;
}

export interface RecalculateBalancesRequest {
  partyId: Party["id"];
  documents: DocumentHeads[];
}

export const balanceSyncTimeout = 10_000;

function snapshotHeads(handle: DocHandle<unknown>): DocumentHeads {
  return { documentId: handle.documentId, heads: getHeads(handle.doc()) };
}

export async function createRecalculateBalancesRequest(
  repo: Repo,
  partyId: Party["id"],
  signal = AbortSignal.timeout(balanceSyncTimeout),
): Promise<RecalculateBalancesRequest> {
  const partyHandle = await repo.find<Party>(partyId, { signal });
  const party = partyHandle.doc();
  const partyHeads = snapshotHeads(partyHandle);
  const chunks = await Promise.all(
    party.chunkRefs.map((ref) => repo.find<PartyExpenseChunk>(ref.chunkId, { signal })),
  );

  return { partyId, documents: [partyHeads, ...chunks.map(snapshotHeads)] };
}

/** Adapter readiness does not imply that a peer has received the caller's edits. */
export async function waitForDocumentHeads(
  repo: Repo,
  documents: DocumentHeads[],
  signal: AbortSignal,
): Promise<void> {
  const controller = new AbortController();
  const waitingSignal = controller.signal;
  const onParentAbort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", onParentAbort, { once: true });
  if (signal.aborted) onParentAbort();
  try {
    await Promise.all(
      documents.map(async ({ documentId, heads }) => {
        const handle = await repo.find(documentId, { signal: waitingSignal });
        waitingSignal.throwIfAborted();
        if (hasHeads(handle.doc(), heads)) return;

        await new Promise<void>((resolve, reject) => {
          function cleanup() {
            handle.off("heads-changed", check);
            handle.off("delete", onDelete);
            waitingSignal.removeEventListener("abort", onAbort);
          }
          function check() {
            if (hasHeads(handle.doc(), heads)) {
              cleanup();
              resolve();
            }
          }
          function onAbort() {
            cleanup();
            reject(waitingSignal.reason);
          }
          function onDelete() {
            cleanup();
            reject(new Error("Balance input was deleted during synchronization"));
          }

          // History can synchronize without producing visible patches.
          handle.on("heads-changed", check);
          handle.on("delete", onDelete);
          waitingSignal.addEventListener("abort", onAbort, { once: true });
          if (waitingSignal.aborted) onAbort();
          else check();
        });
      }),
    );
  } finally {
    signal.removeEventListener("abort", onParentAbort);
    controller.abort();
  }
}

export async function recalculateSynchronizedBalances(
  repo: Repo,
  request: RecalculateBalancesRequest,
  signal = AbortSignal.timeout(balanceSyncTimeout),
): Promise<DocumentHeads[]> {
  await waitForDocumentHeads(repo, request.documents, signal);
  await recalculatePartyBalances(repo, request.partyId, signal);
  const party = (await repo.find<Party>(request.partyId, { signal })).doc();
  const balances = await Promise.all(
    party.chunkRefs.map((ref) => repo.find(ref.balancesId, { signal })),
  );
  return balances.map(snapshotHeads);
}
