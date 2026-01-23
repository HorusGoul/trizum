/**
 * TrizumWorkerClient - A client that runs Automerge Repo in a Web Worker.
 *
 * This client offloads all heavy Automerge operations to a background thread,
 * keeping the main thread responsive for UI interactions.
 */

import { Repo, type NetworkAdapterInterface } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  WorkerConfig,
} from "./types.js";
import {
  wrapHandle,
  fromAMDocumentId,
  toAMDocumentId,
  isValidDocumentId,
} from "../internal/automerge.js";
import type { DocumentId, DocumentHandle } from "../types.js";
import type {
  DocumentModel,
  DocumentModelDefinition,
  ModelHelpers,
} from "../models/types.js";

export interface TrizumWorkerClientOptions {
  /** Name for the IndexedDB database. Default: "trizum" */
  storageName?: string;
  /** WebSocket URL for synchronization. Set to null to disable networking. */
  syncUrl?: string | null;
  /** Whether to enable offline-only mode (no network sync). Default: false */
  offlineOnly?: boolean;
  /**
   * URL to the Web Worker script.
   * This should be the URL to the compiled repo-worker.js file.
   */
  workerUrl: URL;
}

/**
 * A Trizum client that runs the Automerge Repo in a Web Worker.
 *
 * Benefits of using the worker client:
 * - Heavy document operations don't block the main thread
 * - Better performance for large documents or many concurrent changes
 * - Improved responsiveness during sync operations
 *
 * @example
 * ```ts
 * const client = await TrizumWorkerClient.create({
 *   storageName: "my-app",
 *   syncUrl: "wss://sync.example.com",
 *   workerUrl: new URL('./worker/repo-worker.js', import.meta.url),
 * });
 *
 * // Use client same as TrizumClient
 * ```
 */
export class TrizumWorkerClient {
  private _worker: Worker;
  private _repo: Repo;
  private _ready: Promise<void>;
  private options: Required<
    Pick<TrizumWorkerClientOptions, "storageName" | "offlineOnly">
  > &
    TrizumWorkerClientOptions;

  private constructor(options: TrizumWorkerClientOptions) {
    const {
      storageName = "trizum",
      syncUrl = "wss://dev-sync.trizum.app",
      offlineOnly = false,
      workerUrl,
    } = options;

    this.options = { storageName, syncUrl, offlineOnly, workerUrl };

    // Create the worker
    this._worker = new Worker(workerUrl, { type: "module" });

    // Create MessageChannel for bidirectional communication
    const { port1, port2 } = new MessageChannel();

    // Create a local repo that communicates with the worker via MessageChannel
    // This repo doesn't have storage (storage is in the worker)
    // It only has the MessageChannel adapter for syncing with the worker
    const network: NetworkAdapterInterface[] = [
      new MessageChannelNetworkAdapter(port1),
    ];

    this._repo = new Repo({
      network,
      // No storage here - storage is in the worker
    });

    // Initialize the worker
    const config: WorkerConfig = { storageName, syncUrl, offlineOnly };
    const initMessage: MainToWorkerMessage = { type: "init", config };
    this._worker.postMessage(initMessage);

    // Send the MessageChannel port to the worker
    const portMessage: MainToWorkerMessage = { type: "port", port: port2 };
    this._worker.postMessage(portMessage, [port2]);

    // Wait for worker to be ready
    this._ready = new Promise<void>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerToMainMessage>) => {
        const message = event.data;
        if (message.type === "ready") {
          this._worker.removeEventListener("message", handleMessage);
          resolve();
        } else if (message.type === "error") {
          this._worker.removeEventListener("message", handleMessage);
          reject(new Error(message.error));
        }
      };

      this._worker.addEventListener("message", handleMessage);

      // Timeout after 10 seconds
      setTimeout(() => {
        this._worker.removeEventListener("message", handleMessage);
        reject(new Error("Worker initialization timed out"));
      }, 10000);
    });
  }

  /**
   * Create a new TrizumWorkerClient.
   *
   * This is an async factory method because the worker needs time to initialize.
   */
  static async create(
    options: TrizumWorkerClientOptions,
  ): Promise<TrizumWorkerClient> {
    const client = new TrizumWorkerClient(options);
    await client._ready;
    return client;
  }

  /**
   * @internal
   * Get the underlying repository instance (main thread proxy).
   * This is for internal SDK use only and should not be used by consumers.
   */
  get _internalRepo(): Repo {
    return this._repo;
  }

  /**
   * @internal
   * Get the worker instance.
   */
  get _internalWorker(): Worker {
    return this._worker;
  }

  /**
   * Terminate the worker and clean up resources.
   */
  terminate(): void {
    this._worker.terminate();
  }

  /**
   * Check if a string is a valid document ID.
   */
  isValidDocumentId(id: string): id is DocumentId {
    return isValidDocumentId(id);
  }

  /**
   * Define a document model and get type-safe helpers for CRUD operations.
   */
  defineModel<T extends DocumentModel, CreateInput = Omit<T, "id">>(
    definition: DocumentModelDefinition<T, CreateInput>,
  ): ModelHelpers<T> {
    const { createInitialState } = definition;
    const repo = this._repo;

    return {
      create: (input) => {
        const initialState = createInitialState(input as CreateInput);

        const handle = repo.create<T>({
          ...initialState,
          id: "" as unknown as DocumentId,
        } as unknown as T);

        const docId = fromAMDocumentId(handle.documentId);
        handle.change((doc) => {
          (doc as unknown as { id: DocumentId }).id = docId;
        });

        const doc = handle.doc();
        if (!doc) {
          return Promise.reject(new Error("Failed to create document"));
        }

        return Promise.resolve({
          id: docId,
          doc: doc as T,
        });
      },

      find: async (id) => {
        try {
          const handle = await repo.find<T>(toAMDocumentId(id), {
            allowableStates: ["ready"],
          });

          if (handle.isDeleted()) {
            return undefined;
          }

          return handle.doc() as T | undefined;
        } catch {
          return undefined;
        }
      },

      update: async (id, changeFn) => {
        const handle = await repo.find<T>(toAMDocumentId(id), {
          allowableStates: ["ready"],
        });

        if (handle.isDeleted()) {
          throw new Error(`Document not found: ${id}`);
        }

        handle.change(changeFn);
      },

      delete: async (id) => {
        const handle = await repo.find<T>(toAMDocumentId(id), {
          allowableStates: ["ready"],
        });

        if (!handle.isDeleted()) {
          handle.delete();
        }
      },

      subscribe: (id, callback) => {
        let unsubChange: (() => void) | undefined;
        let unsubDelete: (() => void) | undefined;

        void repo
          .find<T>(toAMDocumentId(id), { allowableStates: ["ready"] })
          .then((handle) => {
            if (handle.isDeleted()) {
              callback(undefined);
              return;
            }

            callback(handle.doc() as T | undefined);

            const onChange = () => {
              callback(handle.doc() as T | undefined);
            };

            const onDelete = () => {
              callback(undefined);
            };

            handle.on("change", onChange);
            handle.on("delete", onDelete);

            unsubChange = () => handle.off("change", onChange);
            unsubDelete = () => handle.off("delete", onDelete);
          })
          .catch(() => {
            callback(undefined);
          });

        return () => {
          unsubChange?.();
          unsubDelete?.();
        };
      },
    };
  }

  /**
   * Get or create a root document (singleton pattern).
   */
  getOrCreateRootDocument<T extends DocumentModel>(
    localStorageKey: string,
    createInitialState: () => Omit<T, "id">,
  ): DocumentId {
    const existingId = localStorage.getItem(localStorageKey);

    if (existingId && this.isValidDocumentId(existingId)) {
      return existingId;
    }

    const handle = this._repo.create<T>({
      ...createInitialState(),
      id: "" as unknown as DocumentId,
    } as unknown as T);

    const docId = fromAMDocumentId(handle.documentId);
    handle.change((doc) => {
      (doc as unknown as { id: DocumentId }).id = docId;
    });

    localStorage.setItem(localStorageKey, docId);

    return docId;
  }

  /**
   * Find a document handle by ID.
   */
  async findHandle<T>(id: DocumentId): Promise<DocumentHandle<T>> {
    const handle = await this._repo.find<T>(toAMDocumentId(id), {
      allowableStates: ["ready"],
    });
    return wrapHandle(handle);
  }

  /**
   * Create a new document with the given initial state.
   */
  create<T extends DocumentModel>(
    initialState: Omit<T, "id">,
  ): { id: DocumentId; handle: DocumentHandle<T> } {
    const handle = this._repo.create<T>({
      ...initialState,
      id: "" as unknown as DocumentId,
    } as unknown as T);

    const docId = fromAMDocumentId(handle.documentId);
    handle.change((doc) => {
      (doc as unknown as { id: DocumentId }).id = docId;
    });

    return {
      id: docId,
      handle: wrapHandle(handle),
    };
  }

  /**
   * Load multiple documents by their IDs.
   */
  async loadMany<T>(ids: DocumentId[]): Promise<(T | undefined)[]> {
    return Promise.all(
      ids.map(async (id) => {
        try {
          const handle = await this._repo.find<T>(toAMDocumentId(id));
          return handle.doc() as T | undefined;
        } catch {
          return undefined;
        }
      }),
    );
  }
}
