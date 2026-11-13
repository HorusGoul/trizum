import { Repo } from "@automerge/automerge-repo";
import * as Automerge from "@automerge/automerge";
import { afterEach, expect, test, vi } from "vite-plus/test";

afterEach(() => vi.useRealTimers());

test("an incomplete incoming document does not reject background sync after the ready timeout", async () => {
  vi.useFakeTimers();
  const repo = new Repo({ sharePolicy: async () => false });
  const source = new Repo();
  const receipt = source.create({ encodedBlob: "receipt data" });
  const peerId = source.peerId;
  const [, data] = Automerge.generateSyncMessage(receipt.doc(), Automerge.initSyncState());

  if (!data) throw new Error("Expected initial sync message");

  try {
    // The first handshake advertises heads but has not transferred the document.
    await repo.synchronizer.receiveMessage({
      type: "sync",
      senderId: peerId,
      targetId: repo.peerId,
      documentId: receipt.documentId,
      data,
    });
    const synchronizer = repo.synchronizer.docSynchronizers[receipt.documentId]!;
    const result = synchronizer.beginSync([]);
    await vi.advanceTimersByTimeAsync(60_001);
    await expect(result).resolves.toBeUndefined();

    // A later transfer can still complete this document and start syncing again.
    repo.handles[receipt.documentId]!.update(() => Automerge.clone(receipt.doc()));
    await expect(synchronizer.beginSync([peerId])).resolves.toBeUndefined();
    expect(repo.handles[receipt.documentId]!.doc()).toEqual(receipt.doc());
    expect(repo.create({ healthy: true }).doc()).toEqual({ healthy: true });
  } finally {
    await repo.shutdown();
    await source.shutdown();
  }
});
