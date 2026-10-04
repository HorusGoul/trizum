import { getHeads, hasHeads, type Heads } from "@automerge/automerge/slim";
import type { DocHandle, DocumentId, Repo } from "@automerge/automerge-repo/slim";
import type { Party } from "#src/models/party.ts";

export interface BalanceCalculationDependency {
  documentId: DocumentId;
  heads: Heads;
}

export async function getBalanceCalculationDependencies(repo: Repo, partyId: Party["id"]) {
  const partyHandle = await repo.find<Party>(partyId);
  const party = partyHandle.doc();
  const dependencies: BalanceCalculationDependency[] = [
    { documentId: partyId, heads: getHeads(party) },
  ];
  const chunkDocumentIds = party.chunkRefs.flatMap(({ chunkId, balancesId }) => [
    chunkId,
    balancesId,
  ]);
  const chunkDependencies = await Promise.all(
    chunkDocumentIds.map(async (documentId) => {
      const handle = await repo.find(documentId);
      return { documentId, heads: getHeads(handle.doc()) };
    }),
  );

  return [...dependencies, ...chunkDependencies];
}

export async function waitForBalanceCalculationDependencies(
  repo: Repo,
  dependencies: BalanceCalculationDependency[],
  signal: AbortSignal,
) {
  await Promise.all(
    dependencies.map(async ({ documentId, heads }) => {
      const handle = await repo.find(documentId, { signal });
      await waitForHeads(handle, heads, signal);
    }),
  );
}

function waitForHeads(handle: DocHandle<unknown>, heads: Heads, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      handle.off("change", onChange);
      signal.removeEventListener("abort", onAbort);
    };
    const onChange = () => {
      if (hasHeads(handle.doc(), heads)) {
        cleanup();
        resolve();
      }
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };

    handle.on("change", onChange);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    } else {
      onChange();
    }
  });
}
