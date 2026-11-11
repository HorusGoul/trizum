import type {
  PartyEntity,
  ProfileEntity,
  ExpenseChunkEntity,
  BalanceEntity,
  MediaEntity,
} from "./entities.ts";
import type { MutationInput } from "@nkzw/fate";
import { LocalFateClient, type AppClient } from "./LocalFateClient.ts";
import { appRoots, appMutations, type RecordSnapshot } from "./schema.ts";
import { createMutationHandlers } from "./mutations.ts";
import { createExpenseHistory } from "./history.ts";
import { createPresenceStore } from "./presenceStore.ts";
import type { ImportProgressEntity } from "./entities.ts";
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
import type { MutationResult } from "@nkzw/fate";

import { decodeExpenseId } from "#src/models/expense.ts";
import { view, toEntityId } from "@nkzw/fate";
import { isValidDocumentId, type DocHandle, type Repo } from "@automerge/automerge-repo/slim";
import { getPartyHelpers } from "./partyCommands.ts";
import { getProfileHelpers } from "./profileCommands.ts";
import { getPartyListId, subscribeToPartyListId, type PartyList } from "#src/models/partyList.ts";
import type { Party } from "#src/models/party.ts";
import { bindAnalytics } from "../analytics.ts";

const RetainedPartyView = view<PartyEntity>()({ id: true });

const RetainedProfileView = view<ProfileEntity>()({ id: true });

const RetainedExpenseChunkView = view<ExpenseChunkEntity>()({ id: true, expenses: { id: true } });

const RetainedBalanceView = view<BalanceEntity>()({ id: true });

const RetainedMediaView = view<MediaEntity>()({ id: true });

export const RecordView = view<RecordSnapshot>()({ id: true, value: true });
const selection = new Set(["id", "value", "__typename"]);

/** One Fate cache per repository; Automerge objects never become mutation inputs. */
export function createAppData(repo: Repo) {
  const handles = new Map<string, DocHandle<object>>();
  const listeners = new Map<string, () => void>();
  const pending = new Set<string>();
  const retained = new Map<string, { dispose(): void }>();
  const lifetime = new AbortController();
  const previousExpenses = new Map<string, Set<string>>();
  const sourceKinds = new Map<string, SourceDocument["type"]>();

  let profileId = getPartyListId(repo);
  let analyticsPath: (() => string) | undefined;
  let stopAnalytics: (() => void) | undefined;
  let disposed = false;

  function snapshot(id: string): RecordSnapshot {
    const handle = handles.get(id);

    return { __typename: "RecordSnapshot", id, value: handle?.isReady() ? handle.doc() : null };
  }

  const fate: AppClient = new LocalFateClient(
    {
      roots: appRoots,
      mutations: appMutations,
      types: [
        { type: "RecordSnapshot", fields: { value: "scalar" } },
        { type: "LoadState" },
        { type: "Session" },
        { type: "ExpenseHistory", fields: { expenseIds: "scalar" } },
        { type: "ExpensePresence", fields: { participants: "scalar" } },
        { type: "ImportProgress" },
        ...entityTypes,
      ],
      transport: {
        async fetchById(type, ids, _select, _args, context) {
          return Promise.all(
            ids.map(async (value) => {
              const entityId = String(value);

              if (type === "ExpenseHistory") return history.load(entityId);

              if (type === "ExpensePresence") {
                await read(decodeExpenseId(entityId).chunkId);
                preparePresence(entityId, true);

                return presence.get(entityId);
              }

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

              attachHandle(handle);

              return projection(type, entityId, document(id));
            }),
          );
        },
        async mutate<Name extends keyof typeof appMutations>(
          name: Name,
          input: MutationInput<(typeof appMutations)[Name]>,
        ): Promise<MutationResult<(typeof appMutations)[Name]>> {
          if (disposed) throw new Error("Data client disposed");

          const handler = mutationHandlers[name];
          const result = await handler(input);

          if (name !== "presence.broadcast") await repo.flush();

          return result;
        },
      },
    },
    (type, id, missing) => {
      if (type === "RecordSnapshot") return;

      if (type === "Session") {
        if (missing) publishSession();

        return;
      }

      if (type === "ExpenseHistory") {
        history.prepare(id, missing);

        return;
      }

      if (type === "ExpensePresence") {
        preparePresence(id, missing);

        return;
      }

      if (type === "ImportProgress") {
        if (missing) publishProgress({ __typename: "ImportProgress", id, name: "", progress: 0 });

        return;
      }

      const sourceId = type === "Expense" ? decodeExpenseId(id).chunkId : id;

      if (!handles.has(sourceId) || missing) hydrateLocal(sourceId);
    },
  );

  const source = {
    read,
    peek,
    subscribe,
    status: (id: string) =>
      pending.has(id) ? "pending" : handles.has(id) ? "resolved" : "not-found",
  };

  const history = createExpenseHistory(source, hydrateLocal, (page) =>
    fate.write(
      "ExpenseHistory",
      { ...page },
      new Set(["id", "expenseIds", "hasNext", "isLoadingNext"]),
    ),
  );

  const presence = createPresenceStore((value) =>
    fate.write("ExpensePresence", { ...value }, new Set(["id", "participants"])),
  );

  const mutationHandlers = createMutationHandlers(repo, {
    party: async (id) => {
      await read(id);

      return readyPartyHelpers(id);
    },
    profile: async (id) => {
      await read(id);

      return readyProfileHelpers(id);
    },
    loadNext: (id) => history.loadNext(id),
    progress: publishProgress,
    broadcast: async (message) => {
      const id = decodeExpenseId(message.data.expenseId).chunkId;
      await read(id);
      const handle = handles.get(id);

      if (!handle) throw new Error("Expense has not loaded");
      handle.broadcast(message);
    },
  });

  function publishSession() {
    fate.write("Session", { id: "current", profileId }, new Set(["id", "profileId"]));
  }

  function publishProgress(value: ImportProgressEntity) {
    fate.write("ImportProgress", { ...value }, new Set(["id", "name", "progress"]));
  }

  function preparePresence(id: string, force: boolean) {
    const chunkId = decodeExpenseId(id).chunkId;
    hydrateLocal(chunkId);
    const handle = handles.get(chunkId);

    if (handle?.isReady()) presence.prepare(id, handle, force);
  }

  publishSession();

  const stopProfile = subscribeToPartyListId((id) => {
    profileId = id;
    publishSession();

    if (analyticsPath) void refreshAnalytics();
  });

  async function refreshAnalytics() {
    stopAnalytics?.();
    stopAnalytics = undefined;
    const id = profileId;
    const profile = await read<PartyList>(id).catch(() => undefined);

    if (!profile || disposed || id !== profileId || !analyticsPath) return;
    // SAFETY: The active profile was acquired through its canonical profile ID.
    const handle = handles.get(id) as DocHandle<PartyList>;
    stopAnalytics = bindAnalytics(handle, analyticsPath);
  }

  function attachHandle(handle: DocHandle<object>) {
    const id = handle.documentId;
    handles.set(id, handle);

    if (!listeners.has(id)) {
      retained.set(id, fate.retain({ record: { id, view: RecordView } }));
      const publish = () => publishDocument(id);
      const onDelete = () => publishDocument(id, true);
      handle.on("change", publish);
      handle.on("delete", onDelete);
      listeners.set(id, () => {
        handle.off("change", publish);
        handle.off("delete", onDelete);
      });
    }

    publishDocument(id);
  }

  function hydrateLocal(id: string) {
    if (disposed) throw new Error("Data client disposed");

    if (!isValidDocumentId(id)) return;
    const handle = handles.get(id) ?? repo.handles[id];

    if (handle?.isReady()) attachHandle(handle);
  }

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

  function ref(id: string) {
    const result = fate.ref<RecordSnapshot>("RecordSnapshot", id, RecordView);

    if (!handles.has(id) || !fate.peekView(RecordView, result)) hydrateLocal(id);

    return result;
  }

  async function read<T>(id: string): Promise<T | undefined> {
    if (disposed) throw new Error("Data client disposed");

    if (!handles.has(id) || !fate.peekView(RecordView, ref(id))) hydrateLocal(id);
    const result = await fate.readView(RecordView, ref(id));

    // SAFETY: Domain callers own the opaque ID and its model; Fate stores immutable source snapshots.
    return (result.data.value ?? undefined) as T | undefined;
  }

  // Observe acquired records without loading another expense page.
  function peek<T>(id: string): T | undefined {
    // SAFETY: Domain callers select the model matching this opaque record ID.
    return (fate.peekView(RecordView, fate.ref<RecordSnapshot>("RecordSnapshot", id, RecordView))
      ?.data.value ?? undefined) as T | undefined;
  }

  function subscribe(id: string, listener: () => void) {
    const stopRecord = fate.store.subscribe(toEntityId("RecordSnapshot", id), selection, listener);
    const stopLoading = fate.store.subscribe(toEntityId("LoadState", id), listener);

    return () => {
      stopRecord();
      stopLoading();
    };
  }

  function readyPartyHelpers(id: string) {
    // SAFETY: The dispatcher acquires the document; its discriminant is checked below.
    const handle = handles.get(id) as DocHandle<Party> | undefined;

    if (!handle || document(id)?.type !== "party") throw new Error("Party has not loaded");

    return getPartyHelpers(repo, handle);
  }

  function readyProfileHelpers(id: string) {
    // SAFETY: The dispatcher acquires the document; its discriminant is checked below.
    const handle = handles.get(id) as DocHandle<PartyList> | undefined;

    if (!handle || document(id)?.type !== "partyList") throw new Error("Profile has not loaded");

    return getProfileHelpers(repo, handle);
  }

  return {
    fate,
    ...source,
    bindAnalytics: (pathname: () => string) => {
      analyticsPath = pathname;
      void refreshAnalytics();
    },
    dispose() {
      disposed = true;
      stopProfile();
      stopAnalytics?.();
      history.dispose();
      presence.dispose();
      lifetime.abort(new Error("Data client disposed"));

      for (const request of retained.values()) request.dispose();
      retained.clear();

      for (const cleanup of listeners.values()) cleanup();
      listeners.clear();
      handles.clear();
      sourceKinds.clear();
      previousExpenses.clear();
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
