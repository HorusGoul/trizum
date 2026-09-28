import {
  getHeads,
  hasOurChanges,
  type ChangeFn,
  type Doc,
  type SyncState,
} from "@automerge/automerge";
import { isValidDocumentId, Repo, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { getLogger } from "../src/lib/log.js";
import type { ApiEnv } from "./env";

const logger = getLogger("api", "automergeDocuments");
const DEFAULT_TIMEOUT_MS = 10_000;

interface AutomergeDocumentsOptions {
  env: Pick<ApiEnv, "AUTOMERGE_WSS_URL">;
  request: Request;
  timeoutMs?: string;
}

/** One lazy repo per request. Only explicitly requested documents may sync. */
export class AutomergeDocuments {
  readonly #options: AutomergeDocumentsOptions;
  readonly #requestedIds = new Set<DocumentId>();
  readonly #controller = new AbortController();
  readonly #signal: AbortSignal;
  #repo?: Repo;
  #ready?: Promise<Repo>;
  #closing?: Promise<void>;
  #timeoutId?: ReturnType<typeof setTimeout>;
  #syncPeerId?: PeerId;

  constructor(options: AutomergeDocumentsOptions) {
    this.#options = options;
    this.#signal = AbortSignal.any([this.#controller.signal, options.request.signal]);
  }

  async read<T>(documentId: DocumentId): Promise<Doc<T>> {
    return (await this.#find<T>(documentId)).doc();
  }

  /** Wait for the connected sync peer to acknowledge the change before returning. */
  async change<T>(documentId: DocumentId, change: ChangeFn<T>): Promise<Doc<T>> {
    const handle = await this.#find<T>(documentId);
    const repo = this.#repo!;
    const previousHeads = getHeads(handle.doc()).join(",");
    await new Promise<void>((resolve, reject) => {
      let changed: Doc<T> | undefined;
      const cleanup = () => {
        repo.synchronizer.off("sync-state", onSync);
        this.#signal.removeEventListener("abort", onAbort);
      };
      const onSync = (event: { documentId: DocumentId; peerId: PeerId; syncState: SyncState }) => {
        if (
          event.documentId === documentId &&
          event.peerId === this.#syncPeerId &&
          changed &&
          hasOurChanges(changed, event.syncState)
        ) {
          cleanup();
          resolve();
        }
      };
      const onAbort = () => {
        cleanup();
        reject(this.#signal.reason);
      };
      repo.synchronizer.on("sync-state", onSync);
      this.#signal.addEventListener("abort", onAbort, { once: true });
      try {
        this.#signal.throwIfAborted();
        handle.change(change);
        changed = handle.doc();
        if (getHeads(changed).join(",") === previousHeads) {
          cleanup();
          resolve();
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
    return handle.doc();
  }

  async #find<T>(documentId: DocumentId) {
    this.#signal.throwIfAborted();
    if (!isValidDocumentId(documentId)) {
      throw new Error("Invalid document ID.");
    }
    this.#requestedIds.add(documentId);
    // Share the initialization promise as well as the repo across concurrent reads.
    const repo = await (this.#ready ??= this.#connect());
    this.#signal.throwIfAborted();
    return repo.find<T>(documentId, {
      allowableStates: ["ready"],
      signal: this.#signal,
    });
  }

  close(): Promise<void> {
    this.#controller.abort();
    clearTimeout(this.#timeoutId);
    this.#closing ??=
      this.#repo?.shutdown().catch((error) => {
        logger.warning("Could not shut down Worker document repo", { error });
      }) ?? Promise.resolve();
    return this.#closing;
  }

  async #connect(): Promise<Repo> {
    const { env, request, timeoutMs } = this.#options;
    const parsedTimeout = Number.parseInt(timeoutMs ?? "", 10);
    this.#timeoutId = setTimeout(
      () => this.#controller.abort(),
      Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS,
    );
    const network = new BrowserWebSocketClientAdapter(getAutomergeWssUrl(env, request));
    const repo = new Repo({
      isEphemeral: true,
      network: [network],
      peerId: `worker-documents:${crypto.randomUUID()}` as PeerId,
      shareConfig: {
        access: (_peerId, documentId) => Promise.resolve(this.#requestedIds.has(documentId)),
        announce: (_peerId, documentId) =>
          Promise.resolve(documentId !== undefined && this.#requestedIds.has(documentId)),
      },
    });
    this.#repo = repo;
    await waitForAutomergePeer(network, this.#signal);
    this.#syncPeerId = network.remotePeerId;
    return repo;
  }
}

export function getAutomergeWssUrl(env: Pick<ApiEnv, "AUTOMERGE_WSS_URL">, request: Request) {
  const configuredUrl = env.AUTOMERGE_WSS_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const { hostname } = new URL(request.url);
  return hostname === "localhost" || hostname === "127.0.0.1"
    ? "wss://dev-sync.trizum.app"
    : "wss://server.trizum.app/sync";
}

async function waitForAutomergePeer(network: BrowserWebSocketClientAdapter, signal: AbortSignal) {
  signal.throwIfAborted();
  if (network.remotePeerId) return;

  // The adapter reports ready after one second even without a peer. A lookup
  // at that point can mark an existing document unavailable before we connect.
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      network.off("peer-candidate", onPeer);
      signal.removeEventListener("abort", onAbort);
    };
    const onPeer = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    network.on("peer-candidate", onPeer);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
