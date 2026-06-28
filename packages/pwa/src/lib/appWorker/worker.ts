import type { DocHandle, NetworkAdapterInterface, Repo } from "@automerge/automerge-repo/slim";
import { Repo as AutomergeRepo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { recalculatePartyBalances } from "#src/lib/automerge/recalculatePartyBalances.ts";
import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "#src/models/party.ts";
import { WorkerAdapter, type WorkerEndpoint } from "./WorkerAdapter.ts";
import {
  defineAppWorkerProvider,
  type AppWorkerApi,
  type AppWorkerInitializeOptions,
} from "./proxy.ts";

const SYNC_QUIET_MS = 500;
const PARTY_SYNC_TIMEOUT_MS = 2_000;
const CHUNK_SYNC_TIMEOUT_MS = 5_000;
const SERVER_PEER_TIMEOUT_MS = 2_000;

class AppWorkerService implements AppWorkerApi {
  private repo: Repo | null = null;
  private shouldWaitForServerPeer = false;

  async initialize(options: AppWorkerInitializeOptions) {
    if (this.repo) {
      return;
    }

    const network: NetworkAdapterInterface[] = [new MessageChannelNetworkAdapter(options.repoPort)];

    if (!options.isOfflineOnly) {
      network.push(new BrowserWebSocketClientAdapter(options.wssUrl));
      this.shouldWaitForServerPeer = true;
    }

    this.repo = new AutomergeRepo({
      storage: new IndexedDBStorageAdapter("trizum"),
      network,
    });

    await this.repo.networkSubsystem.whenReady();
  }

  async recalculateBalances(partyId: Party["id"]) {
    const repo = this.requireRepo();

    await repo.networkSubsystem.whenReady();

    if (this.shouldWaitForServerPeer) {
      await waitForServerPeer(repo, SERVER_PEER_TIMEOUT_MS);
    }

    const result = await waitForPartyDocumentsToSettle(repo, partyId).then(() =>
      recalculatePartyBalances(repo, partyId),
    );
    await repo.flush();

    return result;
  }

  private requireRepo() {
    if (!this.repo) {
      throw new Error("App worker has not been initialized");
    }

    return this.repo;
  }
}

const provideAppWorker = defineAppWorkerProvider(() => new AppWorkerService());

provideAppWorker(new WorkerAdapter(self as unknown as WorkerEndpoint, "app-worker"));

async function waitForPartyDocumentsToSettle(repo: Repo, partyId: Party["id"]) {
  const partyHandle = await repo.find<Party>(partyId);
  await waitForHandlesToSettle([partyHandle], {
    quietMs: SYNC_QUIET_MS,
    timeoutMs: PARTY_SYNC_TIMEOUT_MS,
  });

  let party = partyHandle.doc();
  let chunkRefsKey = getChunkRefsKey(party);
  let handles = await findChunkHandles(repo, party);

  await waitForHandlesToSettle([partyHandle, ...handles], {
    quietMs: SYNC_QUIET_MS,
    timeoutMs: CHUNK_SYNC_TIMEOUT_MS,
  });

  party = partyHandle.doc();

  if (getChunkRefsKey(party) !== chunkRefsKey) {
    chunkRefsKey = getChunkRefsKey(party);
    handles = await findChunkHandles(repo, party);

    await waitForHandlesToSettle([partyHandle, ...handles], {
      quietMs: SYNC_QUIET_MS,
      timeoutMs: CHUNK_SYNC_TIMEOUT_MS,
    });
  }

  if (getChunkRefsKey(partyHandle.doc()) !== chunkRefsKey) {
    throw new Error("Party chunk refs changed while balance recalculation sync was settling");
  }
}

async function findChunkHandles(repo: Repo, party: Party) {
  const handles = await Promise.all(
    party.chunkRefs.map(async (chunkRef) => {
      const [chunkHandle, chunkBalancesHandle] = await Promise.all([
        repo.find<PartyExpenseChunk>(chunkRef.chunkId),
        repo.find<PartyExpenseChunkBalances>(chunkRef.balancesId),
      ]);

      return [chunkHandle, chunkBalancesHandle];
    }),
  );

  return handles.flat();
}

function waitForHandlesToSettle(
  handles: DocHandle<unknown>[],
  {
    quietMs,
    timeoutMs,
  }: {
    quietMs: number;
    timeoutMs: number;
  },
) {
  if (handles.length === 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let isDone = false;
    let quietTimeoutId: ReturnType<typeof setTimeout>;

    const cleanupCallbacks: Array<() => void> = [];
    const cleanup = () => {
      if (isDone) {
        return false;
      }

      isDone = true;
      clearTimeout(quietTimeoutId);
      clearTimeout(timeoutId);
      cleanupCallbacks.forEach((cleanup) => cleanup());
      return true;
    };

    const finish = () => {
      if (!cleanup()) {
        return;
      }

      resolve();
    };

    const restartQuietTimer = () => {
      clearTimeout(quietTimeoutId);
      quietTimeoutId = setTimeout(finish, quietMs);
    };

    const timeoutId = setTimeout(() => {
      if (!cleanup()) {
        return;
      }

      reject(new Error("Timed out waiting for Automerge documents to sync before recalculation"));
    }, timeoutMs);

    for (const handle of handles) {
      handle.on("change", restartQuietTimer);
      handle.on("heads-changed", restartQuietTimer);
      handle.on("remote-heads", restartQuietTimer);

      cleanupCallbacks.push(() => {
        handle.off("change", restartQuietTimer);
        handle.off("heads-changed", restartQuietTimer);
        handle.off("remote-heads", restartQuietTimer);
      });
    }

    restartQuietTimer();
  });
}

function waitForServerPeer(repo: Repo, timeoutMs: number) {
  if (hasServerPeer(repo)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      repo.networkSubsystem.off("peer", onPeer);
      reject(new Error("Timed out waiting for Automerge server peer before recalculation"));
    }, timeoutMs);

    function onPeer() {
      if (!hasServerPeer(repo)) {
        return;
      }

      clearTimeout(timeoutId);
      repo.networkSubsystem.off("peer", onPeer);
      resolve();
    }

    repo.networkSubsystem.on("peer", onPeer);
  });
}

function hasServerPeer(repo: Repo) {
  return repo.peers.some((peerId) => String(peerId).startsWith("server:"));
}

function getChunkRefsKey(party: Party) {
  return party.chunkRefs.map((chunkRef) => `${chunkRef.chunkId}:${chunkRef.balancesId}`).join("|");
}
