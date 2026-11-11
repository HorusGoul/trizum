// @vitest-environment jsdom

import { mutationResult } from "#src/lib/data/mutationResult.ts";

import { view, toEntityId } from "@nkzw/fate";
import type { PartyEntity, ExpenseEntity } from "./entities.ts";

import type { PartyExpenseChunk } from "#src/models/party.ts";
import {
  Repo,
  RawString,
  type Chunk,
  type StorageAdapterInterface,
} from "@automerge/automerge-repo";
import { afterEach, expect, test, vi } from "vite-plus/test";
import type { Party } from "#src/models/party.ts";
import type { MediaFile } from "#src/models/media.ts";
import { createAppData, type AppData } from "./client.ts";

const PartyDetailsView = view<PartyEntity>()({
  id: true,
  available: true,
  name: true,
  symbol: true,
  description: true,
});

const repos: Repo[] = [];
const clients: AppData[] = [];

function runtime(storage?: StorageAdapterInterface) {
  const repo = new Repo({ network: [], storage });
  const data = createAppData(repo);
  repos.push(repo);
  clients.push(data);

  return { repo, data };
}

function party(repo: Repo) {
  const handle = repo.create<Party>({
    // SAFETY: The allocated document ID replaces the placeholder before any read.
    id: "" as Party["id"],
    type: "party",
    name: "Trip",
    description: "Details",
    currency: "EUR",
    symbol: "🏝️",
    participants: {},
    chunkRefs: [],
  });

  handle.change((doc) => {
    doc.id = handle.documentId;
  });

  return handle;
}

afterEach(async () => {
  for (const data of clients.splice(0)) data.dispose();
  await Promise.all(repos.splice(0).map((repo) => repo.shutdown()));
});

test("Fate publishes local writes immediately and preserves source removals", async () => {
  const { repo, data } = runtime();
  const handle = party(repo);
  await data.read<Party>(handle.documentId);
  const changed = vi.fn<() => void>();
  const unsubscribe = data.subscribe(handle.documentId, changed);
  handle.change((doc) => {
    doc.name = "Updated";
    delete doc.symbol;
  });
  expect(data.peek<Party>(handle.documentId)).toMatchObject({ name: "Updated" });
  expect(data.peek<Party>(handle.documentId)?.symbol).toBeUndefined();
  expect(changed).toHaveBeenCalled();
  unsubscribe();
});

test("the same ID is isolated between repositories and incoming merges refresh Fate", async () => {
  const first = runtime();
  const handle = party(first.repo);
  const binary = await first.repo.export(handle.documentId);
  expect(binary).toBeDefined();
  const second = runtime();
  const remote = second.repo.import<Party>(binary!, { docId: handle.documentId });
  await Promise.all([first.data.read(handle.documentId), second.data.read(handle.documentId)]);
  remote.change((doc) => {
    doc.description = "Remote edit";
  });
  expect(first.data.peek<Party>(handle.documentId)?.description).toBe("Details");
  const updated = await second.repo.export(remote.documentId);
  first.repo.import(updated!, { docId: handle.documentId });
  expect(first.data.peek<Party>(handle.documentId)?.description).toBe("Remote edit");
});

test("media snapshots preserve RawString bytes and metadata without serialization", async () => {
  const { repo, data } = runtime();

  const media = repo.create<MediaFile>({
    // SAFETY: The allocated document ID is assigned before exposure.
    id: "" as MediaFile["id"],
    type: "mediaFile",
    encodedBlob: new RawString("AQID"),
    metadata: {},
  });

  media.change((doc) => {
    doc.id = media.documentId;
  });
  expect((await data.read<MediaFile>(media.documentId))?.encodedBlob.val).toBe("AQID");
});

test("Fate mutations acknowledge a durable local save and reopen while offline", async () => {
  const chunks = new Map<string, Chunk>();

  const storage: StorageAdapterInterface = {
    load: async (key) => chunks.get(JSON.stringify(key))?.data,
    save: async (key, data) => {
      chunks.set(JSON.stringify(key), { key, data });
    },
    remove: async (key) => {
      chunks.delete(JSON.stringify(key));
    },
    loadRange: async (prefix) =>
      [...chunks.values()].filter(({ key }) => prefix.every((part, index) => key[index] === part)),
    removeRange: async (prefix) => {
      for (const [id, { key }] of chunks)
        if (prefix.every((part, index) => key[index] === part)) chunks.delete(id);
    },
  };

  const first = runtime(storage);
  const handle = party(first.repo);
  await first.data.read<Party>(handle.documentId);
  await mutationResult(
    first.data.fate.mutations.party.updateDetails({
      input: {
        partyId: handle.documentId,
        parameters: [{ name: "Offline edit", symbol: "🌴", description: "Saved" }],
      },
    }),
  );
  const reopened = runtime(storage);
  expect(await reopened.data.read<Party>(handle.documentId)).toMatchObject({
    name: "Offline edit",
    description: "Saved",
    symbol: "🌴",
  });
  const ref = reopened.data.fate.ref<PartyEntity>("Party", handle.documentId, PartyDetailsView);
  expect((await reopened.data.fate.readView(PartyDetailsView, ref)).data).toMatchObject({
    available: true,
    name: "Offline edit",
    description: "Saved",
    symbol: "🌴",
  });
  const warmSource = runtime(storage);
  await warmSource.repo.find<Party>(handle.documentId);

  expect(warmSource.data.fate.store.read(toEntityId("Party", handle.documentId))).toBeUndefined();

  const localRef = warmSource.data.fate.ref<PartyEntity>(
    "Party",
    handle.documentId,
    PartyDetailsView,
  );

  expect(warmSource.data.fate.peekView(PartyDetailsView, localRef)?.data).toMatchObject({
    available: true,
    name: "Offline edit",
    description: "Saved",
    symbol: "🌴",
  });
});

test("deletion clears views and disposal removes source listeners", async () => {
  const { repo, data } = runtime();
  const handle = party(repo);
  await data.read(handle.documentId);
  const off = vi.spyOn(handle, "off");
  repo.delete(handle.documentId);
  expect(data.peek(handle.documentId)).toBeUndefined();
  data.dispose();
  expect(off).toHaveBeenCalledWith("change", expect.any(Function));
  expect(off).toHaveBeenCalledWith("delete", expect.any(Function));
});

test("local readers reuse ready handles and retained history survives Fate collection", async () => {
  const { repo, data } = runtime();
  const handle = party(repo);
  expect(data.peek(handle.documentId)).toBeUndefined();
  const find = vi.spyOn(repo, "find");
  await Promise.all([data.read(handle.documentId), data.read(handle.documentId)]);
  expect(find).not.toHaveBeenCalled();

  for (let index = 0; index < 12; index++) {
    await data.read(party(repo).documentId);
  }

  data.fate.gc();
  expect(data.peek<Party>(handle.documentId)?.name).toBe("Trip");
});

test("expense drafts preserve Dates and unchanged nested values through a Fate mutation", async () => {
  const { repo, data } = runtime();
  const { createExpenseId, calculateExpenseHash } = await import("#src/models/expense.ts");
  const owner = party(repo);

  const chunk = repo.create<PartyExpenseChunk>({
    // SAFETY: The allocated ID is assigned before the record is read.
    id: "" as Party["id"],
    type: "expenseChunk",
    partyId: owner.documentId,
    createdAt: new Date("2026-01-01"),
    maxSize: 500,
    expenses: [],
  });

  const expense = {
    id: createExpenseId(chunk.documentId),
    name: "Lunch",
    paidAt: new Date("2026-01-02"),
    paidBy: { alice: 1200 },
    shares: { alice: { type: "divide" as const, value: 1 } },
    photos: [],
    __hash: "",
  };

  expense.__hash = calculateExpenseHash(expense);
  chunk.change((doc) => {
    doc.id = chunk.documentId;
    doc.expenses.push(expense);
  });
  const expenseView = view<ExpenseEntity>()({ available: true, name: true, paidAt: true });
  expect(data.fate.store.read(toEntityId("Expense", expense.id))).toBeUndefined();
  const readyRef = data.fate.ref<ExpenseEntity>("Expense", expense.id, expenseView);
  expect(data.fate.peekView(expenseView, readyRef)?.data).toMatchObject({
    available: true,
    name: "Lunch",
    paidAt: new Date("2026-01-02"),
  });
  await data.read(chunk.documentId);
  await mutationResult(
    data.fate.mutations.expense.editDraft({
      input: { expenseId: expense.id, patches: [{ t: 2, p: ["name"], v: "Dinner" }] },
    }),
  );
  const saved = chunk.doc().expenses[0];
  expect(saved.__editCopy?.name).toBe("Dinner");
  expect(saved.__editCopy?.paidAt).toEqual(new Date("2026-01-02"));
  expect(saved.__editCopy?.shares).toEqual({ alice: { type: "divide", value: 1 } });
  expect(saved.name).toBe("Lunch");
});

test("a temporarily unavailable profile remains pending until its document arrives", async () => {
  vi.useFakeTimers();

  try {
    const first = runtime();
    const handle = party(first.repo);
    const binary = await first.repo.export(handle.documentId);
    const destination = runtime();
    let completed = false;

    const reading = destination.data.read<Party>(handle.documentId).then((value) => {
      completed = true;

      return value;
    });

    await vi.advanceTimersByTimeAsync(0);
    destination.repo.handles[handle.documentId].unavailable();
    await vi.advanceTimersByTimeAsync(0);
    expect(completed).toBe(false);
    destination.repo.import(binary!, { docId: handle.documentId });
    await vi.advanceTimersByTimeAsync(100);
    expect(await reading).toMatchObject({ name: "Trip" });
  } finally {
    vi.useRealTimers();
  }
});

test("an exhausted unavailable lookup resolves as missing after bounded retries", async () => {
  vi.useFakeTimers();

  try {
    const first = runtime();
    const handle = party(first.repo);
    const destination = runtime();
    const reading = destination.data.read(handle.documentId);
    await vi.advanceTimersByTimeAsync(0);
    destination.repo.handles[handle.documentId].unavailable();
    await vi.advanceTimersByTimeAsync(65_000);
    expect(await reading).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});

test("local reads do not require AbortSignal.any", async () => {
  const original = AbortSignal.any;
  Object.defineProperty(AbortSignal, "any", { configurable: true, value: undefined });

  try {
    const { repo, data } = runtime();
    const handle = party(repo);
    expect(await data.read<Party>(handle.documentId)).toMatchObject({ name: "Trip" });
  } finally {
    Object.defineProperty(AbortSignal, "any", { configurable: true, value: original });
  }
});
