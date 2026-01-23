/**
 * TrizumClient - The main client for interacting with documents.
 *
 * This client abstracts the underlying storage and sync layer, providing a
 * clean API for CRUD operations, real-time updates, and document subscriptions.
 */

import {
  createRepo,
  isValidDocumentId,
  toAMDocumentId,
  fromAMDocumentId,
  wrapHandle,
  type Repo,
} from "./internal/automerge.js";
import type { DocumentId, DocumentHandle } from "./types.js";
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
 * The main client for interacting with Trizum documents.
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
 * // Use the client to work with documents
 * const partyId = client.getOrCreateRootDocument("partyListId", () => ({
 *   type: "partyList",
 *   username: "",
 *   phone: "",
 *   parties: {},
 *   participantInParties: {},
 * }));
 * ```
 */
export class TrizumClient {
  /** @internal */
  private _repo: Repo;
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

    this._repo = createRepo({
      storageName,
      syncUrl,
      offlineOnly,
    });
  }

  /**
   * @internal
   * Get the underlying repository instance.
   * This is for internal SDK use only and should not be used by consumers.
   */
  get _internalRepo(): Repo {
    return this._repo;
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
   */
  defineModel<T extends DocumentModel, CreateInput = Omit<T, "id">>(
    definition: DocumentModelDefinition<T, CreateInput>,
  ): ModelHelpers<T> {
    const { createInitialState } = definition;
    const repo = this._repo;

    return {
      create: (input) => {
        const initialState = createInitialState(input as CreateInput);

        // Create with a placeholder ID that will be set after creation
        const handle = repo.create<T>({
          ...initialState,
          id: "" as unknown as DocumentId,
        } as unknown as T);

        // Set the self-referential ID using SDK's DocumentId type
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
   *
   * This is useful for documents that should only exist once per user,
   * like a user profile or settings document. The document ID is stored
   * in localStorage for persistence across sessions.
   *
   * @param localStorageKey - Key to store the document ID in localStorage
   * @param createInitialState - Factory function to create initial state if document doesn't exist
   * @returns The document ID
   */
  getOrCreateRootDocument<T extends DocumentModel>(
    localStorageKey: string,
    createInitialState: () => Omit<T, "id">,
  ): DocumentId {
    const existingId = localStorage.getItem(localStorageKey);

    if (existingId && this.isValidDocumentId(existingId)) {
      return existingId;
    }

    // Create with a placeholder ID that will be set after creation
    const handle = this._repo.create<T>({
      ...createInitialState(),
      id: "" as unknown as DocumentId,
    } as unknown as T);

    // Set the self-referential ID using SDK's DocumentId type
    const docId = fromAMDocumentId(handle.documentId);
    handle.change((doc) => {
      (doc as unknown as { id: DocumentId }).id = docId;
    });

    localStorage.setItem(localStorageKey, docId);

    return docId;
  }

  /**
   * Find a document handle by ID.
   *
   * @param id - The document ID
   * @returns The document handle wrapped in SDK types
   */
  async findHandle<T>(id: DocumentId): Promise<DocumentHandle<T>> {
    const handle = await this._repo.find<T>(toAMDocumentId(id), {
      allowableStates: ["ready"],
    });
    return wrapHandle(handle);
  }

  /**
   * Create a new document with the given initial state.
   *
   * @param initialState - The initial document state
   * @returns The document ID and handle
   */
  create<T extends DocumentModel>(
    initialState: Omit<T, "id">,
  ): { id: DocumentId; handle: DocumentHandle<T> } {
    // Create with a placeholder ID that will be set after creation
    const handle = this._repo.create<T>({
      ...initialState,
      id: "" as unknown as DocumentId,
    } as unknown as T);

    // Set the self-referential ID using SDK's DocumentId type
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
   *
   * @param ids - Array of document IDs to load
   * @returns Array of documents (undefined for documents that don't exist)
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
