/**
 * TrizumClient - The main client for interacting with Automerge documents.
 *
 * This client abstracts the Automerge repository and provides a clean API
 * for CRUD operations, real-time updates, and document subscriptions.
 */

import {
  Repo,
  isValidDocumentId,
  type NetworkAdapterInterface,
} from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import type {
  DocumentId,
  Doc,
  DocHandle,
} from "@automerge/automerge-repo/slim";
import type {
  DocumentModel,
  DocumentModelDefinition,
  ModelHelpers,
} from "./models/types.js";

export interface TrizumClientOptions {
  /** Name for the IndexedDB database. Default: "trizum" */
  storageName?: string;
  /** WebSocket URL for synchronization. Set to null to disable networking. */
  syncUrl?: string | null;
  /** Whether to enable offline-only mode (no network sync). Default: false */
  offlineOnly?: boolean;
}

/**
 * The main client for interacting with Automerge documents.
 *
 * TrizumClient provides a high-level API for:
 * - Creating, reading, updating, and deleting documents
 * - Real-time synchronization across devices
 * - Type-safe model definitions
 * - Offline-first data persistence
 *
 * @example
 * ```ts
 * const client = new TrizumClient({
 *   storageName: "my-app",
 *   syncUrl: "wss://sync.example.com",
 * });
 *
 * // Create type-safe model helpers
 * const PartyModel = client.defineModel({
 *   type: "party",
 *   createInitialState: (input) => ({
 *     type: "party",
 *     name: input.name,
 *     participants: {},
 *   }),
 * });
 *
 * // Use the model
 * const { id, doc } = await PartyModel.create({ name: "Beach Trip" });
 * ```
 */
export class TrizumClient {
  private repo: Repo;
  private options: Required<
    Pick<TrizumClientOptions, "storageName" | "offlineOnly">
  > &
    TrizumClientOptions;

  constructor(options: TrizumClientOptions = {}) {
    const {
      storageName = "trizum",
      syncUrl = "wss://dev-sync.trizum.app",
      offlineOnly = false,
    } = options;

    this.options = { storageName, syncUrl, offlineOnly };

    // Build network adapters
    const network: NetworkAdapterInterface[] = [];

    if (!offlineOnly && syncUrl) {
      network.push(new BrowserWebSocketClientAdapter(syncUrl));
    }

    // Initialize the Automerge repository
    this.repo = new Repo({
      storage: new IndexedDBStorageAdapter(storageName),
      network,
    });
  }

  /**
   * Get the underlying Automerge Repo instance.
   * Use this for advanced operations or when integrating with existing code.
   */
  getRepo(): Repo {
    return this.repo;
  }

  /**
   * Check if a string is a valid document ID.
   */
  isValidDocumentId(id: string): id is DocumentId {
    return isValidDocumentId(id);
  }

  /**
   * Define a document model and get type-safe helpers for CRUD operations.
   *
   * @param definition - The model definition including type and initial state factory
   * @returns Model helpers for create, find, update, delete, and subscribe operations
   *
   * @example
   * ```ts
   * interface Todo extends DocumentModel {
   *   type: "todo";
   *   title: string;
   *   completed: boolean;
   * }
   *
   * const TodoModel = client.defineModel<Todo>({
   *   type: "todo",
   *   createInitialState: (input) => ({
   *     type: "todo",
   *     title: input.title,
   *     completed: input.completed ?? false,
   *   }),
   * });
   * ```
   */
  defineModel<T extends DocumentModel, CreateInput = Omit<T, "id">>(
    definition: DocumentModelDefinition<T, CreateInput>,
  ): ModelHelpers<T> {
    const { createInitialState } = definition;
    const repo = this.repo;

    return {
      create: (input) => {
        const initialState = createInitialState(input as CreateInput);

        const handle = repo.create<T>({
          ...initialState,
          id: "" as DocumentId,
        } as T);

        // Set the self-referential ID
        handle.change((doc) => {
          doc.id = handle.documentId;
        });

        const doc = handle.doc();
        if (!doc) {
          return Promise.reject(new Error("Failed to create document"));
        }

        return Promise.resolve({
          id: handle.documentId,
          doc: doc as T,
        });
      },

      find: async (id) => {
        try {
          const handle = await repo.find<T>(id, {
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
        const handle = await repo.find<T>(id, {
          allowableStates: ["ready"],
        });

        if (handle.isDeleted()) {
          throw new Error(`Document not found: ${id}`);
        }

        handle.change(changeFn);
      },

      delete: async (id) => {
        const handle = await repo.find<T>(id, {
          allowableStates: ["ready"],
        });

        if (!handle.isDeleted()) {
          handle.delete();
        }
      },

      subscribe: (id, callback) => {
        let unsubChange: (() => void) | undefined;
        let unsubDelete: (() => void) | undefined;

        // Find the handle and set up subscriptions
        void repo
          .find<T>(id, { allowableStates: ["ready"] })
          .then((handle) => {
            if (handle.isDeleted()) {
              callback(undefined);
              return;
            }

            // Initial callback with current state
            callback(handle.doc() as T | undefined);

            // Subscribe to changes
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

        // Return unsubscribe function
        return () => {
          unsubChange?.();
          unsubDelete?.();
        };
      },
    };
  }

  /**
   * Get or create a root document (singleton pattern).
   *
   * This is useful for documents that should only exist once per user,
   * like a user profile or settings document. The document ID is stored
   * in localStorage for persistence across sessions.
   *
   * @param localStorageKey - Key to store the document ID in localStorage
   * @param createInitialState - Factory function to create initial state if document doesn't exist
   * @returns The document ID
   *
   * @example
   * ```ts
   * const settingsId = client.getOrCreateRootDocument(
   *   "userSettings",
   *   () => ({
   *     type: "settings",
   *     theme: "light",
   *     language: "en",
   *   })
   * );
   * ```
   */
  getOrCreateRootDocument<T extends DocumentModel>(
    localStorageKey: string,
    createInitialState: () => Omit<T, "id">,
  ): DocumentId {
    const existingId = localStorage.getItem(localStorageKey);

    if (existingId && this.isValidDocumentId(existingId)) {
      return existingId;
    }

    // Create new document
    const handle = this.repo.create<T>({
      ...createInitialState(),
      id: "" as DocumentId,
    } as T);

    // Set self-referential ID
    handle.change((doc) => {
      doc.id = handle.documentId;
    });

    // Persist the ID
    localStorage.setItem(localStorageKey, handle.documentId);

    return handle.documentId;
  }

  /**
   * Find a document handle by ID.
   *
   * This is a lower-level API for when you need direct access to the handle.
   * For most use cases, prefer using model helpers from defineModel().
   *
   * @param id - The document ID
   * @returns The document handle
   */
  async findHandle<T>(id: DocumentId): Promise<DocHandle<T>> {
    return this.repo.find<T>(id, {
      allowableStates: ["ready"],
    });
  }

  /**
   * Create a new document with the given initial state.
   *
   * This is a lower-level API. For type-safe operations, prefer defineModel().
   *
   * @param initialState - The initial document state
   * @returns A tuple of [documentId, handle]
   */
  create<T extends DocumentModel>(
    initialState: Omit<T, "id">,
  ): { id: DocumentId; handle: DocHandle<T> } {
    const handle = this.repo.create<T>({
      ...initialState,
      id: "" as DocumentId,
    } as T);

    handle.change((doc) => {
      doc.id = handle.documentId;
    });

    return {
      id: handle.documentId,
      handle,
    };
  }

  /**
   * Load multiple documents by their IDs.
   *
   * @param ids - Array of document IDs to load
   * @returns Array of documents (undefined for documents that don't exist)
   */
  async loadMany<T>(ids: DocumentId[]): Promise<(Doc<T> | undefined)[]> {
    return Promise.all(
      ids.map(async (id) => {
        try {
          const handle = await this.repo.find<T>(id);
          return handle.doc();
        } catch {
          return undefined;
        }
      }),
    );
  }
}
