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
  };

  const mutations = { "local.run": valueMutation<LocalCommand, { done: true }>() };

  const fate = createClient<[typeof roots, typeof mutations]>({
    roots,
    mutations,
    types: [{ type: "RecordSnapshot", fields: { value: "scalar" } }, { type: "LoadState" }],
    transport: {
      async fetchById(_type, ids, _select, _args, context) {
        return Promise.all(
          ids.map(async (value) => {
            const id = String(value);

            if (!isValidDocumentId(id)) throw new Error("Malformed record ID");

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

            if (!handle) return { __typename: "RecordSnapshot", id, value: null };

            handles.set(id, handle);

            if (!listeners.has(id)) {
              retained.set(id, fate.retain({ record: { id, view: RecordView } }));
              const publish = () => fate.write("RecordSnapshot", { ...snapshot(id) }, selection);
              handle.on("change", publish);

              const onDelete = () =>
                fate.write(
                  "RecordSnapshot",
                  { __typename: "RecordSnapshot", id, value: null },
                  selection,
                );

              handle.on("delete", onDelete);
              listeners.set(id, () => {
                handle.off("change", publish);
                handle.off("delete", onDelete);
              });
            }

            return snapshot(id);
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

  function readyPartyActions(id: Party["id"]) {
    // SAFETY: React reads the required Party snapshot before requesting its commands.
    const handle = handles.get(id) as DocHandle<Party> | undefined;

    if (!handle) throw new Error("Party has not loaded");

    return actions(getPartyHelpers(repo, handle));
  }

  function profileActions(id: PartyList["id"]) {
    // SAFETY: React reads the required profile snapshot before requesting its commands.
    const handle = handles.get(id) as DocHandle<PartyList> | undefined;

    if (!handle) throw new Error("Profile has not loaded");

    return actions(getProfileHelpers(repo, handle));
  }

  return {
    fate,
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
