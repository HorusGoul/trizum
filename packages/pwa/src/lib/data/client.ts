import type {
  PartyEntity,
  ProfileEntity,
  ExpenseEntity,
  ExpenseChunkEntity,
  BalanceEntity,
  MediaEntity,
} from "./entities.ts";
import type { Entity, View, Selection } from "@nkzw/fate";
import {
  entityTypes,
  projectDocument,
  projectExpense,
  chunkFields,
  expenseFields,
  type SourceDocument,
} from "./projection.ts";
import { createReadScope } from "./readScope.ts";
import { loadRecord } from "./loadRecord.ts";
import { createFateState } from "./fateState.ts";
import type { MutationResult } from "@nkzw/fate";
import type { ExpensePresenceMessage } from "./presence.ts";
import type { DiffResult } from "@opentf/obj-diff";
import { decodeExpenseId, calculateExpenseHash, type Expense } from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import { patchMutate } from "../patchMutate.ts";
import { getOrCreateExpenseEditCopy } from "#src/lib/data/expenseDraft.ts";
import { createClient, clientRoot, valueMutation, view, toEntityId } from "@nkzw/fate";
import { isValidDocumentId, type DocHandle, type Repo } from "@automerge/automerge-repo/slim";
import { getPartyHelpers } from "./partyCommands.ts";
import { getProfileHelpers } from "./profileCommands.ts";
import { getMediaFileHelpers } from "./mediaCommands.ts";
import { getPartyListId, subscribeToPartyListId, type PartyList } from "#src/models/partyList.ts";
import type { Party } from "#src/models/party.ts";
import { createPartyFromMigrationData } from "#src/models/migration.ts";
import { bindAnalytics } from "../analytics.ts";

const RetainedPartyView = view<PartyEntity>()({ id: true });

const RetainedProfileView = view<ProfileEntity>()({ id: true });

const RetainedExpenseChunkView = view<ExpenseChunkEntity>()({ id: true, expenses: { id: true } });

const RetainedBalanceView = view<BalanceEntity>()({ id: true });

const RetainedMediaView = view<MediaEntity>()({ id: true });

interface RecordSnapshot {
  __typename: "RecordSnapshot";
  id: string;
  value: object | null;
}

export const RecordView = view<RecordSnapshot>()({ id: true, value: true });
const selection = new Set(["id", "value", "__typename"]);

// The command closure is private, local-only, and never persisted or sent over a network.
interface LocalCommand {
  run(): Promise<void>;
}

type CommandResult = object | void | string | boolean;

type Commands = Record<string, (...args: never[]) => CommandResult | Promise<CommandResult>>;

type Actions<T extends Commands> = {
  [Name in keyof T]: T[Name] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : never;
};

/** One Fate cache per repository; Automerge objects never become mutation inputs. */
export function createAppData(repo: Repo) {
  const handles = new Map<string, DocHandle<object>>();
  const listeners = new Map<string, () => void>();
  const pending = new Set<string>();
  const retained = new Map<string, { dispose(): void }>();
  const lifetime = new AbortController();
  const previousExpenses = new Map<string, Set<string>>();
  const sourceKinds = new Map<string, SourceDocument["type"]>();

  const presenceChannels = new Map<
    string,
    {
      broadcast(message: ExpensePresenceMessage): void;
      subscribe(listener: (payload: { message: unknown }) => void): () => void;
    }
  >();

  const activeProfile = createFateState(getPartyListId(repo));
  const stopProfile = subscribeToPartyListId(activeProfile.set);
  let disposed = false;

  function snapshot(id: string): RecordSnapshot {
    const handle = handles.get(id);

    return { __typename: "RecordSnapshot", id, value: handle?.isReady() ? handle.doc() : null };
  }

  const roots = {
    record: clientRoot<RecordSnapshot, "RecordSnapshot", { id: string }>("RecordSnapshot"),
    party: clientRoot<PartyEntity, "Party">("Party"),
    profile: clientRoot<ProfileEntity, "Profile">("Profile"),
    expense: clientRoot<ExpenseEntity, "Expense">("Expense"),
    expenseChunk: clientRoot<ExpenseChunkEntity, "ExpenseChunk">("ExpenseChunk"),
    balance: clientRoot<BalanceEntity, "Balance">("Balance"),
    media: clientRoot<MediaEntity, "Media">("Media"),
  };

  const mutations = { "local.run": valueMutation<LocalCommand, { done: true }>() };

  const fate = createClient<[typeof roots, typeof mutations]>({
    roots,
    mutations,
    types: [
      { type: "RecordSnapshot", fields: { value: "scalar" } },
      { type: "LoadState" },
      ...entityTypes,
    ],
    transport: {
      async fetchById(type, ids, _select, _args, context) {
        return Promise.all(
          ids.map(async (value) => {
            const entityId = String(value);
            const id = type === "Expense" ? decodeExpenseId(entityId).chunkId : entityId;

            if (!isValidDocumentId(id)) throw new Error("Malformed record ID");

            if (handles.get(id)?.isReady()) return projection(type, entityId, document(id));

            pending.add(id);
            fate.write("LoadState", { id, pending: true }, new Set(["pending"]));
            let handle: DocHandle<object> | undefined;
            const scope = createReadScope([lifetime.signal, context?.signal]);

            try {
              handle = await loadRecord(repo, id, scope.signal);
            } finally {
              scope.dispose();
              pending.delete(id);
              fate.write("LoadState", { id, pending: false }, new Set(["pending"]));
            }

            if (disposed) throw new Error("Data client disposed");

            if (!handle) return projection(type, entityId, document(id));

            handles.set(id, handle);

            if (!listeners.has(id)) {
              retained.set(id, fate.retain({ record: { id, view: RecordView } }));
              const publish = () => publishDocument(id);
              handle.on("change", publish);

              const onDelete = () => publishDocument(id, true);
              handle.on("delete", onDelete);
              listeners.set(id, () => {
                handle.off("change", publish);
                handle.off("delete", onDelete);
              });
            }

            publishDocument(id);

            return projection(type, entityId, document(id));
          }),
        );
      },
      async mutate<Name extends keyof typeof mutations>(
        _name: Name,
        command: LocalCommand,
      ): Promise<MutationResult<(typeof mutations)[Name]>> {
        await command.run();

        // SAFETY: The single registered transport command always returns this completion marker.
        return { done: true } as MutationResult<(typeof mutations)[Name]>;
      },
    },
  });

  function document(id: string): SourceDocument | undefined {
    const handle = handles.get(id);

    // SAFETY: These IDs are the application's persisted domain documents. Projection dispatch checks their discriminant.
    return handle?.isReady() ? (handle.doc() as SourceDocument) : undefined;
  }

  function projection(type: string, id: string, source: SourceDocument | undefined) {
    return type === "RecordSnapshot" ? snapshot(id) : projectDocument(type, id, source);
  }

  function publishDocument(id: string, deleted = false) {
    const source = deleted ? undefined : document(id);

    if (source) sourceKinds.set(id, source.type);
    const kind = sourceKinds.get(id);

    const type =
      kind === "party"
        ? "Party"
        : kind === "partyList"
          ? "Profile"
          : kind === "expenseChunk"
            ? "ExpenseChunk"
            : kind === "expenseChunkBalances"
              ? "Balance"
              : kind === "mediaFile"
                ? "Media"
                : undefined;

    fate.store.transaction(() => {
      fate.write(
        "RecordSnapshot",
        { __typename: "RecordSnapshot", id, value: source ?? null },
        selection,
      );

      if (!type) return;
      const record = projection(type, id, source);
      fate.write(
        type,
        { ...record },
        new Set(type === "ExpenseChunk" ? chunkFields : Object.keys(record)),
      );

      if (type === "ExpenseChunk") {
        const expenses = source?.type === "expenseChunk" ? source.expenses : [];
        const current = new Set(expenses.map((expense) => expense.id));

        for (const previousId of previousExpenses.get(id) ?? []) {
          if (!current.has(previousId))
            fate.write("Expense", projectExpense(previousId), new Set(expenseFields));
        }

        previousExpenses.set(id, current);
      }
    });

    const key = `${type}:${id}`;

    if (type && !retained.has(key)) {
      switch (type) {
        case "Party":
          retained.set(key, fate.retain({ party: { id, view: RetainedPartyView } }));
          break;
        case "Profile":
          retained.set(key, fate.retain({ profile: { id, view: RetainedProfileView } }));
          break;
        case "ExpenseChunk":
          retained.set(key, fate.retain({ expenseChunk: { id, view: RetainedExpenseChunkView } }));
          break;
        case "Balance":
          retained.set(key, fate.retain({ balance: { id, view: RetainedBalanceView } }));
          break;
        case "Media":
          retained.set(key, fate.retain({ media: { id, view: RetainedMediaView } }));
          break;
      }
    }
  }

  function entityRef<Model extends Entity>(
    type: Model["__typename"],
    id: string,
    selected: View<Model, Selection<Model>>,
  ) {
    return fate.ref<Model>(type, id, selected);
  }

  function ref(id: string) {
    return fate.ref<RecordSnapshot>("RecordSnapshot", id, RecordView);
  }

  async function read<T>(id: string): Promise<T | undefined> {
    if (disposed) throw new Error("Data client disposed");
    const result = await fate.readView(RecordView, ref(id));

    // SAFETY: Domain callers own the opaque ID and its model; Fate stores immutable source snapshots.
    return (result.data.value ?? undefined) as T | undefined;
  }

  function peek<T>(id: string): T | undefined {
    // SAFETY: Domain callers select the model matching this opaque record ID.
    return (fate.peekView(RecordView, ref(id))?.data.value ?? undefined) as T | undefined;
  }

  function subscribe(id: string, listener: () => void) {
    const stopRecord = fate.store.subscribe(toEntityId("RecordSnapshot", id), selection, listener);
    const stopLoading = fate.store.subscribe(toEntityId("LoadState", id), listener);

    return () => {
      stopRecord();
      stopLoading();
    };
  }

  async function execute<Result>(operation: () => Result | Promise<Result>): Promise<Result> {
    if (disposed) throw new Error("Data client disposed");

    let value!: Result;

    const response = await fate.mutations.local.run({
      input: {
        run: async () => {
          value = await operation();
          await repo.flush();
        },
      },
    });

    if (response.error) throw response.error;

    return value;
  }

  function actions<T extends Commands>(helpers: T): Actions<T> {
    // SAFETY: Each wrapper preserves its helper's key, argument tuple, and awaited result.
    return Object.fromEntries(
      Object.entries(helpers).map(([name, command]) => [
        name,
        (...args: never[]) => execute(() => command(...args)),
      ]),
    ) as Actions<T>;
  }

  function readyPartyActions(id: string) {
    // SAFETY: React reads the required Party snapshot before requesting its commands.
    const handle = handles.get(id) as DocHandle<Party> | undefined;

    if (!handle) throw new Error("Party has not loaded");

    return actions(getPartyHelpers(repo, handle));
  }

  function profileActions(id: string) {
    // SAFETY: React reads the required profile snapshot before requesting its commands.
    const handle = handles.get(id) as DocHandle<PartyList> | undefined;

    if (!handle) throw new Error("Profile has not loaded");

    return actions(getProfileHelpers(repo, handle));
  }

  return {
    fate,
    entityRef,
    ref,
    read,
    peek,
    subscribe,
    readyPartyActions,
    profileActions,
    status: (id: string) =>
      pending.has(id) ? "pending" : handles.has(id) ? "resolved" : "not-found",
    activeProfileId: activeProfile.getSnapshot,
    subscribeToProfile: activeProfile.subscribe,
    createTestExpenses: async (id: string, count: number) => {
      const source = await read<Party>(id);

      if (!source) throw new Error("Party unavailable");
      const participants = Object.keys(source.participants);
      const helpers = readyPartyActions(id);
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          helpers.addExpenseToParty({
            name: `Test Expense ${index + 1}`,
            paidAt: new Date(),
            photos: [],
            paidBy: { [participants[0]]: 100 },
            shares: {
              [participants[0]]: { type: "divide", value: 1 },
              [participants[1]]: { type: "divide", value: 1 },
            },
          }),
        ),
      );
    },
    media: {
      createMediaFile: (
        ...args: Parameters<ReturnType<typeof getMediaFileHelpers>["createMediaFile"]>
      ) =>
        execute(async () => {
          const [id] = await getMediaFileHelpers(repo).createMediaFile(...args);
          await repo.flush([id]);

          return [id] as const;
        }),
    },
    editExpenseDraft: (expenseId: Expense["id"], patches: DiffResult[]) =>
      execute(async () => {
        const { chunkId } = decodeExpenseId(expenseId);
        const handle = await repo.find<PartyExpenseChunk>(chunkId);
        handle.change((chunk) => {
          const entry = chunk.expenses.find((expense) => expense.id === expenseId);

          if (!entry) return;
          const editCopy = getOrCreateExpenseEditCopy(entry);
          patchMutate(editCopy, patches);
          editCopy.__hash = calculateExpenseHash(editCopy);
          entry.__editCopyLastUpdatedAt = new Date();
        });
      }),
    presence: (expenseId: Expense["id"]) => {
      const existing = presenceChannels.get(expenseId);

      if (existing) return existing;

      const { chunkId } = decodeExpenseId(expenseId);
      const handle = handles.get(chunkId);

      if (!handle) throw new Error("Expense has not loaded");

      const channel = {
        broadcast: (message: ExpensePresenceMessage) => {
          void execute(() => handle.broadcast(message));
        },
        subscribe: (listener: (payload: { message: unknown }) => void) => {
          handle.on("ephemeral-message", listener);

          return () => {
            handle.off("ephemeral-message", listener);
          };
        },
      };

      presenceChannels.set(expenseId, channel);

      return channel;
    },
    createParty: (values: Omit<Party, "id" | "type" | "chunkRefs">) =>
      execute(async () => {
        // SAFETY: The allocated document ID replaces this placeholder before publication.
        const handle = repo.create<Party>({
          ...values,
          id: "" as Party["id"],
          type: "party",
          chunkRefs: [],
        });

        handle.change((doc) => {
          doc.id = handle.documentId;
        });
        await repo.flush([handle.documentId]);

        return handle.documentId;
      }),
    importParty: (options: Omit<Parameters<typeof createPartyFromMigrationData>[0], "repo">) =>
      execute(async () => {
        const id = await createPartyFromMigrationData({ ...options, repo });
        await repo.flush();

        return id;
      }),
    bindAnalytics: (id: PartyList["id"], pathname: () => string) => {
      // SAFETY: The active profile was loaded before the analytics binding is installed.
      const handle = handles.get(id) as DocHandle<PartyList>;

      return bindAnalytics(handle, pathname);
    },
    dispose() {
      disposed = true;
      stopProfile();
      lifetime.abort(new Error("Data client disposed"));

      for (const request of retained.values()) request.dispose();
      retained.clear();

      for (const cleanup of listeners.values()) cleanup();
      listeners.clear();
      handles.clear();
      sourceKinds.clear();
      previousExpenses.clear();
      presenceChannels.clear();
    },
  };
}

export type AppData = ReturnType<typeof createAppData>;

let clients = new WeakMap<Repo, AppData>();
const activeClients = new Set<AppData>();

export function getAppData(repo: Repo): AppData {
  let data = clients.get(repo);

  if (!data) {
    data = createAppData(repo);
    clients.set(repo, data);
    activeClients.add(data);
  }

  return data;
}

export function clearAppData() {
  for (const client of activeClients) client.dispose();
  activeClients.clear();
  clients = new WeakMap();
}
