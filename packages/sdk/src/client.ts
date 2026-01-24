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
} from "./internal/crdt.js";
import { INTERNAL_REPO_SYMBOL } from "./internal/symbols.js";
import type { DocumentId, DocumentHandle } from "./types.js";
import type {
  DocumentModel,
  DocumentModelDefinition,
  ModelHelpers,
} from "./models/types.js";
import type { Expense } from "./models/expense.js";

// Import operations
import {
  createParty,
  updateParty,
  updateParticipant,
  addParticipant,
  createExpense,
  updateExpense,
  deleteExpense,
  recalculateAllBalances,
  type CreatePartyInput,
  type CreatePartyResult,
  type UpdatePartyInput,
  type UpdateParticipantInput,
  type CreateExpenseInput,
} from "./operations/party/index.js";
import {
  addPartyToList,
  removePartyFromList,
  setLastOpenedParty,
  updatePartyListSettings,
  getOrCreatePartyList,
} from "./operations/party-list/index.js";
import type { UpdatePartyListInput } from "./models/party-list.js";

export interface TrizumClientOptions {
  /** Name for the IndexedDB database. Default: "trizum" */
  storageName?: string;
  /** WebSocket URL for synchronization. Set to null to disable networking. */
  syncUrl?: string | null;
  /** Whether to enable offline-only mode (no network sync). Default: false */
  offlineOnly?: boolean;
}

/**
 * Common interface for Trizum clients.
 *
 * Both TrizumClient and TrizumWorkerClient implement this interface,
 * allowing them to be used interchangeably in application code.
 */
export interface ITrizumClient {
  /** Check if a string is a valid document ID */
  isValidDocumentId(id: string): id is DocumentId;

  /** Define a document model and get type-safe helpers for CRUD operations */
  defineModel<T extends DocumentModel, CreateInput = Omit<T, "id">>(
    definition: DocumentModelDefinition<T, CreateInput>,
  ): ModelHelpers<T>;

  /** Get or create a root document (singleton pattern) */
  getOrCreateRootDocument<T extends DocumentModel>(
    localStorageKey: string,
    createInitialState: () => Omit<T, "id">,
  ): DocumentId;

  /** Find a document handle by ID */
  findHandle<T>(id: DocumentId): Promise<DocumentHandle<T>>;

  /** Create a new document with the given initial state */
  create<T extends DocumentModel>(
    initialState: Omit<T, "id">,
  ): { id: DocumentId; handle: DocumentHandle<T> };

  /** Load multiple documents by their IDs */
  loadMany<T>(ids: DocumentId[]): Promise<(T | undefined)[]>;

  /** Party operations namespace */
  party: PartyOperations;

  /** PartyList operations namespace */
  partyList: PartyListOperations;
}

/**
 * Expense operations interface.
 */
export interface ExpenseOperations {
  /** Create a new expense in a party */
  create(partyId: DocumentId, input: CreateExpenseInput): Promise<Expense>;
  /** Update an existing expense */
  update(
    partyId: DocumentId,
    expenseId: string,
    expense: Expense,
  ): Promise<void>;
  /** Delete an expense */
  delete(partyId: DocumentId, expenseId: string): Promise<void>;
}

/**
 * Party operations interface.
 */
export interface PartyOperations {
  /** Create a new party */
  create(input: CreatePartyInput): Promise<CreatePartyResult>;
  /** Update party settings */
  update(partyId: DocumentId, input: UpdatePartyInput): Promise<void>;
  /** Update a participant's details */
  updateParticipant(
    partyId: DocumentId,
    participantId: string,
    input: UpdateParticipantInput,
  ): Promise<void>;
  /** Add a new participant to a party */
  addParticipant(
    partyId: DocumentId,
    participantId: string,
    participant: Parameters<typeof addParticipant>[3],
  ): Promise<void>;
  /** Recalculate all balances for a party */
  recalculateBalances(partyId: DocumentId): Promise<void>;
  /** Expense operations */
  expense: ExpenseOperations;
}

/**
 * PartyList operations interface.
 */
export interface PartyListOperations {
  /** Get or create the root PartyList document */
  getOrCreate(): DocumentId;
  /** Add a party to the user's list */
  addParty(partyId: DocumentId, participantId: string): Promise<void>;
  /** Remove a party from the user's list */
  removeParty(partyId: DocumentId): Promise<void>;
  /** Set the last opened party */
  setLastOpened(partyId: DocumentId | null): Promise<void>;
  /** Update settings and optionally sync to all parties */
  updateSettings(
    input: UpdatePartyListInput,
    syncToParties?: boolean,
  ): Promise<void>;
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
export class TrizumClient implements ITrizumClient {
  /** @internal - Internal repository, access via INTERNAL_REPO_SYMBOL */
  private [INTERNAL_REPO_SYMBOL]: Repo;
  private options: Required<
    Pick<TrizumClientOptions, "storageName" | "offlineOnly">
  > &
    TrizumClientOptions;
  private partyListId: DocumentId | null = null;

  /**
   * Party operations namespace.
   *
   * Provides methods for managing parties and their expenses.
   *
   * @example
   * ```ts
   * // Create a new party
   * const { partyId } = await client.party.create({
   *   name: "Trip to Paris",
   *   currency: "EUR",
   *   participants: { "user1": { name: "Alice" } },
   * });
   *
   * // Add an expense
   * const expense = await client.party.expense.create(partyId, {
   *   name: "Dinner",
   *   paidAt: new Date(),
   *   paidBy: { "user1": 5000 },
   *   shares: { "user1": { type: "divide", value: 1 } },
   *   photos: [],
   * });
   * ```
   */
  party: PartyOperations;

  /**
   * PartyList operations namespace.
   *
   * Manages the user's list of parties they belong to.
   *
   * @example
   * ```ts
   * // Get or create the user's party list
   * const partyListId = client.partyList.getOrCreate();
   *
   * // Add a party to the list
   * await client.partyList.addParty(partyId, "user1");
   * ```
   */
  partyList: PartyListOperations;

  constructor(options: TrizumClientOptions = {}) {
    const {
      storageName = "trizum",
      syncUrl = "wss://dev-sync.trizum.app",
      offlineOnly = false,
    } = options;

    this.options = { storageName, syncUrl, offlineOnly };

    this[INTERNAL_REPO_SYMBOL] = createRepo({
      storageName,
      syncUrl,
      offlineOnly,
    });

    // Initialize party namespace
    this.party = {
      create: (input) => createParty(this, input),
      update: (partyId, input) => updateParty(this, partyId, input),
      updateParticipant: (partyId, participantId, input) =>
        updateParticipant(this, partyId, participantId, input),
      addParticipant: (partyId, participantId, participant) =>
        addParticipant(this, partyId, participantId, participant),
      recalculateBalances: (partyId) => recalculateAllBalances(this, partyId),
      expense: {
        create: (partyId, input) => createExpense(this, partyId, input),
        update: (partyId, _expenseId, expense) =>
          updateExpense(this, partyId, expense),
        delete: (partyId, expenseId) => deleteExpense(this, partyId, expenseId),
      },
    };

    // Initialize partyList namespace
    this.partyList = {
      getOrCreate: () => {
        if (!this.partyListId) {
          this.partyListId = getOrCreatePartyList(this);
        }
        return this.partyListId;
      },
      addParty: (partyId, participantId) => {
        const partyListId = this.partyList.getOrCreate();
        return addPartyToList(this, partyListId, partyId, participantId);
      },
      removeParty: (partyId) => {
        const partyListId = this.partyList.getOrCreate();
        return removePartyFromList(this, partyListId, partyId);
      },
      setLastOpened: (partyId) => {
        const partyListId = this.partyList.getOrCreate();
        return setLastOpenedParty(this, partyListId, partyId);
      },
      updateSettings: (input, syncToParties) => {
        const partyListId = this.partyList.getOrCreate();
        return updatePartyListSettings(this, partyListId, input, syncToParties);
      },
    };
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
    const repo = this[INTERNAL_REPO_SYMBOL];

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
    const handle = this[INTERNAL_REPO_SYMBOL].create<T>({
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
    const handle = await this[INTERNAL_REPO_SYMBOL].find<T>(
      toAMDocumentId(id),
      {
        allowableStates: ["ready"],
      },
    );
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
    const handle = this[INTERNAL_REPO_SYMBOL].create<T>({
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
          const handle = await this[INTERNAL_REPO_SYMBOL].find<T>(
            toAMDocumentId(id),
          );
          return handle.doc() as T | undefined;
        } catch {
          return undefined;
        }
      }),
    );
  }
}
