// @vitest-environment jsdom

import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { view } from "@nkzw/fate";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "#src/models/party.ts";
import { createExpenseId, calculateExpenseHash } from "#src/models/expense.ts";
import { setPartyListId, getPartyListHandle } from "#src/models/partyList.ts";
import type {
  ExpenseHistoryEntity,
  ExpensePresenceEntity,
  ExpenseEntity,
  SessionEntity,
  ImportProgressEntity,
} from "./entities.ts";
import { createAppData, type AppData } from "./client.ts";
import { mutationResult } from "./mutationResult.ts";
import type { ExpensePresenceMessage } from "./presence.ts";

const HistoryView = view<ExpenseHistoryEntity>()({
  expenseIds: true,
  hasNext: true,
  isLoadingNext: true,
});

const PresenceView = view<ExpensePresenceEntity>()({ participants: true });
const ExpenseView = view<ExpenseEntity>()({ available: true, name: true, __editCopy: true });
const SessionView = view<SessionEntity>()({ profileId: true });
const ProgressView = view<ImportProgressEntity>()({ name: true, progress: true });

let repo: Repo;
let data: AppData;

beforeEach(() => {
  localStorage.clear();
  repo = new Repo({ network: [] });
  data = createAppData(repo);
});

afterEach(async () => {
  data.dispose();
  await repo.shutdown();
  vi.useRealTimers();
});

function party() {
  const handle = repo.create<Party>({
    // SAFETY: The allocated ID replaces the placeholder before any view reads the document.
    id: "" as Party["id"],
    type: "party",
    name: "Trip",
    description: "",
    currency: "EUR",
    participants: { alice: { id: "alice", name: "Alice" } },
    chunkRefs: [],
  });

  handle.change((doc) => {
    doc.id = handle.documentId;
  });

  return handle;
}

function chunk(owner: DocHandle<Party>, day: number) {
  const handle = repo.create<PartyExpenseChunk>({
    // SAFETY: The allocated ID replaces the placeholder before any view reads the document.
    id: "" as PartyExpenseChunk["id"],
    type: "expenseChunk",
    partyId: owner.documentId,
    createdAt: new Date(2026, 0, day),
    maxSize: 500,
    expenses: [],
  });

  const expense = {
    id: createExpenseId(handle.documentId),
    name: `Day ${day}`,
    paidAt: new Date(2026, 0, day),
    paidBy: { alice: 100 },
    shares: { alice: { type: "divide" as const, value: 1 } },
    photos: [],
    __hash: "",
  };

  expense.__hash = calculateExpenseHash(expense);
  handle.change((doc) => {
    doc.id = handle.documentId;
    doc.expenses.push(expense);
  });

  const balances = repo.create<PartyExpenseChunkBalances>({
    // SAFETY: The allocated ID replaces the placeholder before use.
    id: "" as PartyExpenseChunkBalances["id"],
    type: "expenseChunkBalances",
    partyId: owner.documentId,
    balances: {},
  });

  balances.change((doc) => {
    doc.id = balances.documentId;
  });

  const ref = {
    chunkId: handle.documentId,
    balancesId: balances.documentId,
    createdAt: new Date(2026, 0, day),
  };

  return { handle, expense, ref };
}

test("native Fate history acquires one page, isolates drafts, and updates membership live", async () => {
  const owner = party();
  const newest = chunk(owner, 2);
  const older = chunk(owner, 1);
  owner.change((doc) => {
    doc.chunkRefs.push(newest.ref, older.ref);
  });
  const ref = data.fate.ref<ExpenseHistoryEntity>("ExpenseHistory", owner.documentId, HistoryView);
  const initial = data.fate.peekView(HistoryView, ref)!.data;
  expect(initial).toMatchObject({
    expenseIds: [newest.expense.id],
    hasNext: true,
    isLoadingNext: false,
  });
  expect(data.peek(older.handle.documentId)).toBeUndefined();

  await mutationResult(
    data.fate.mutations.expense.editDraft({
      input: { expenseId: newest.expense.id, patches: [{ t: 2, p: ["name"], v: "Draft" }] },
    }),
  );
  expect(data.fate.peekView(HistoryView, ref)!.data).toBe(initial);
  await mutationResult(
    data.fate.mutations.expenseHistory.loadNext({ input: { partyId: owner.documentId } }),
  );
  expect(data.fate.peekView(HistoryView, ref)!.data).toMatchObject({
    expenseIds: [newest.expense.id, older.expense.id],
    hasNext: false,
  });

  const added = chunk(owner, 3);
  owner.change((doc) => {
    doc.chunkRefs.unshift(added.ref);
  });
  expect(data.fate.peekView(HistoryView, ref)!.data.expenseIds).toEqual([
    added.expense.id,
    newest.expense.id,
    older.expense.id,
  ]);
  const expenseRef = data.fate.ref<ExpenseEntity>("Expense", newest.expense.id, ExpenseView);
  newest.handle.change((doc) => {
    doc.expenses.splice(0, 1);
  });
  expect(data.fate.peekView(HistoryView, ref)!.data.expenseIds).toEqual([
    added.expense.id,
    older.expense.id,
  ]);
  expect(data.fate.peekView(ExpenseView, expenseRef)!.data.available).toBe(false);
});

test("the active profile is native Fate state and changes without a React adapter context", async () => {
  const ref = data.fate.ref<SessionEntity>("Session", "current", SessionView);
  const destination = repo.clone(await getPartyListHandle(repo));
  destination.change((doc) => {
    doc.id = destination.documentId;
  });
  setPartyListId(destination.documentId);
  expect(data.fate.peekView(SessionView, ref)!.data.profileId).toBe(destination.documentId);
});

test("presence is validated, expires, and releases its source subscription", async () => {
  vi.useFakeTimers();
  const owner = party();
  const entry = chunk(owner, 1);

  const ref = data.fate.ref<ExpensePresenceEntity>(
    "ExpensePresence",
    entry.expense.id,
    PresenceView,
  );

  expect(data.fate.peekView(PresenceView, ref)!.data.participants).toEqual([]);

  const emit = (message: ExpensePresenceMessage) =>
    entry.handle.emit("ephemeral-message", {
      handle: entry.handle,
      senderId: repo.peerId,
      message,
    });

  emit({
    type: "expense-presence-update",
    data: {
      expenseId: entry.expense.id,
      participantId: "bob",
      elementId: "name",
      dateTime: new Date(),
    },
  });
  expect(data.fate.peekView(PresenceView, ref)!.data.participants).toHaveLength(1);
  entry.handle.emit("ephemeral-message", {
    handle: entry.handle,
    senderId: repo.peerId,
    message: { type: "expense-presence-update", data: { expenseId: entry.expense.id } },
  });
  expect(data.fate.peekView(PresenceView, ref)!.data.participants).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(15_001);
  expect(data.fate.peekView(PresenceView, ref)!.data.participants).toEqual([]);
  const off = vi.spyOn(entry.handle, "off");
  data.dispose();
  expect(off).toHaveBeenCalledWith("ephemeral-message", expect.any(Function));
});

test("a typed import mutation publishes progress through Fate and saves real documents", async () => {
  const operationId = "import-test";

  const progressRef = data.fate.ref<ImportProgressEntity>(
    "ImportProgress",
    operationId,
    ProgressView,
  );

  const partyId = await mutationResult(
    data.fate.mutations.party.import({
      input: {
        operationId,
        importAttachments: false,
        data: {
          party: {
            type: "party",
            name: "Imported trip",
            description: "Offline",
            currency: "EUR",
            participants: { alice: { id: "alice", name: "Alice" } },
          },
          expenses: [
            {
              name: "Lunch",
              paidAt: "2026-01-02T12:00:00.000Z",
              paidBy: { alice: 1200 },
              shares: { alice: { type: "divide", value: 1 } },
              photos: [],
            },
          ],
          photos: [],
        },
      },
    }),
  );

  expect(data.fate.peekView(ProgressView, progressRef)!.data).toMatchObject({
    name: "Imported Lunch (1 of 1)",
    progress: 1,
  });
  const saved = (await repo.find<Party>(partyId)).doc();
  expect(saved.name).toBe("Imported trip");
  const chunk = (await repo.find<PartyExpenseChunk>(saved.chunkRefs[0].chunkId)).doc();
  expect(chunk.expenses[0]).toMatchObject({
    name: "Lunch",
    paidAt: new Date("2026-01-02T12:00:00.000Z"),
    paidBy: { alice: 1200 },
    shares: { alice: { type: "divide", value: 1 } },
  });
});

test("native mutations reject a document of another domain type before writing", async () => {
  const profile = await getPartyListHandle(repo);
  await expect(
    mutationResult(
      data.fate.mutations.party.updateDetails({
        input: {
          partyId: profile.documentId,
          parameters: [{ name: "Wrong type", symbol: "x", description: "" }],
        },
      }),
    ),
  ).rejects.toThrow("Party has not loaded");
  expect(profile.doc()).not.toHaveProperty("name");
  expect(profile.doc().username).toBe("");
});
