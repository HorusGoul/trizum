import { once } from "node:events";
import { McpToolError } from "@trizum/mcp/index";
import { clone } from "@opentf/std";
import { createRequire } from "node:module";
import type { ChangeFn } from "@automerge/automerge";
import { Repo, generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import type * as WebSocketModule from "ws" with { "resolution-mode": "require" };
import type { WebSocketServer } from "ws" with { "resolution-mode": "require" };
import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test";
import { AutomergeDocuments } from "../automergeDocuments";
import { WorkerPartyService } from "./partyService";
import {
  calculateBalancesByParticipant,
  calculateExpenseHash,
  createExpenseId,
  type Expense,
} from "../../src/models/expense";
import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "../../src/models/party";

// SAFETY: Resolve the Node ws export used by the server adapter rather than the browser alias.
const WebSocket = createRequire(import.meta.url)("ws") as typeof WebSocketModule;
let sockets: WebSocketServer;
let server: Repo;
let syncUrl: string;
const opened: AutomergeDocuments[] = [];

beforeEach(async () => {
  sockets = new WebSocket.Server({ port: 0 });
  server = new Repo({
    network: [new NodeWSServerAdapter(sockets)],
    sharePolicy: async () => false,
  });
  await once(sockets, "listening");
  const address = sockets.address();

  if (!address || !(address instanceof Object)) throw new Error("Expected local TCP address");
  syncUrl = `ws://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await Promise.all(opened.splice(0).map((documents) => documents.close()));
  await server.shutdown();
  await new Promise<void>((resolve, reject) =>
    sockets.close((error) => (error ? reject(error) : resolve())),
  );
});

function documents() {
  const result = new AutomergeDocuments({
    env: { AUTOMERGE_WSS_URL: syncUrl },
    request: new Request("https://trizum.app"),
  });

  opened.push(result);

  return result;
}

function service(documentsInstance = documents()) {
  return new WorkerPartyService(documentsInstance, "https://trizum.app");
}

function balances(view: Awaited<ReturnType<WorkerPartyService["getParty"]>>) {
  return Object.fromEntries(view.participants.map((person) => [person.name, person.balance]));
}

/** Seed a normal multi-expense PWA chunk, not only the MCP's single-expense chunks. */
async function fixture(amounts = [1000, 2000]) {
  const docs = documents();
  const api = service(docs);

  const view = await api.createParty({
    name: "Weekend",
    description: "",
    symbol: "🏝️",
    currency: "EUR",
    participants: ["Alice", "Bob"],
  });

  const alice = view.participants.find((person) => person.name === "Alice")!.id;
  const bob = view.participants.find((person) => person.name === "Bob")!.id;
  // SAFETY: createParty returns the ID allocated by Repo.create.
  const partyId = view.partyId as Party["id"];
  const party = await docs.read<Party>(partyId);

  const chunk = await docs.create<PartyExpenseChunk>((id) => ({
    id,
    type: "expenseChunk",
    partyId,
    createdAt: new Date(),
    maxSize: 500,
    expenses: amounts.map((amount) => {
      const expense: Expense = {
        id: createExpenseId(id),
        name: "Dinner",
        paidAt: new Date("2026-11-06T20:00:00Z"),
        paidBy: { [alice]: amount },
        shares: { [alice]: { type: "divide", value: 1 }, [bob]: { type: "divide", value: 1 } },
        photos: [],
        __hash: "",
      };

      expense.__hash = calculateExpenseHash(expense);

      return expense;
    }),
  }));

  const summary = await docs.create<PartyExpenseChunkBalances>((id) => ({
    id,
    type: "expenseChunkBalances",
    partyId,
    balances: calculateBalancesByParticipant(chunk.expenses, party.participants),
  }));

  await docs.change<Party>(partyId, (doc) => {
    doc.chunkRefs.push({ chunkId: chunk.id, balancesId: summary.id, createdAt: chunk.createdAt });
  });

  return { api, docs, partyId, alice, bob, chunk, summary };
}

it("edits metadata without changing custom splits or attachments and rejects stale versions", async () => {
  const f = await fixture([1000]);
  const photo = parseAutomergeUrl(generateAutomergeUrl()).documentId;
  await f.docs.change<PartyExpenseChunk>(f.chunk.id, (doc) => {
    const expense = doc.expenses[0];
    expense.photos = [photo];
    expense.paidBy = { [f.alice]: 600, [f.bob]: 400 };
    expense.shares[f.alice] = { type: "exact", value: 200 };
    expense.__hash = calculateExpenseHash(expense);
    expense.__editCopy = clone(expense);
    expense.__editCopyLastUpdatedAt = new Date();
  });
  const input = { partyId: f.partyId, expenseId: f.chunk.expenses[0].id };
  const read = await f.api.getExpense(input);
  await f.api.updateExpense({
    ...input,
    version: read.version,
    name: "Lunch",
    paidAt: "2026-11-07T12:00:00Z",
  });
  const updated = await f.api.getExpense(input);
  expect(updated).toMatchObject({
    name: "Lunch",
    paidAt: "2026-11-07T12:00:00.000Z",
    amount: "10.00",
    paidBy: read.paidBy,
    shares: read.shares,
  });
  expect(updated.version).not.toBe(read.version);
  const persisted = await f.docs.read<PartyExpenseChunk>(f.chunk.id);
  expect(persisted.expenses[0].photos).toEqual([photo]);
  expect(persisted.expenses[0]).not.toHaveProperty("__editCopy");
  expect(persisted.expenses[0].__hash).toBe(updated.version);
  await expect(
    service().updateExpense({
      ...input,
      version: read.version,
      amount: "12.00",
    }),
  ).rejects.toThrow("changed since");
  await expect(service().deleteExpense({ ...input, version: read.version })).rejects.toThrow(
    "changed since",
  );
});

it("updates financial fields and deletes the final expense with correct shared balances", async () => {
  const f = await fixture();
  const input = { partyId: f.partyId, expenseId: f.chunk.expenses[0].id };
  let read = await f.api.getExpense(input);

  const updated = await f.api.updateExpense({
    ...input,
    version: read.version,
    amount: "12.00",
  });

  expect(balances(updated)).toEqual({ Alice: "16.00", Bob: "-16.00" });
  read = await f.api.getExpense(input);
  await f.api.deleteExpense({ ...input, version: read.version });
  expect(balances(await service().getParty(f.partyId))).toEqual({ Alice: "10.00", Bob: "-10.00" });
  const other = { partyId: f.partyId, expenseId: f.chunk.expenses[1].id };
  const last = await f.api.getExpense(other);

  const empty = await f.api.deleteExpense({
    ...other,
    version: last.version,
  });

  expect(empty.expenses).toHaveLength(0);
  expect(balances(empty)).toEqual({ Alice: "0.00", Bob: "0.00" });
  const persisted = (await server.find<PartyExpenseChunkBalances>(f.summary.id)).doc();
  expect(persisted.balances[f.alice].stats.balance).toBe(0);
});

it("requires explicit custom-split conversion, rejects transfers, and scopes expense IDs to a party", async () => {
  const f = await fixture([1000]);
  const input = { partyId: f.partyId, expenseId: f.chunk.expenses[0].id };
  await f.docs.change<PartyExpenseChunk>(f.chunk.id, (doc) => {
    doc.expenses[0].shares[f.alice] = { type: "exact", value: 200 };
  });
  const read = await f.api.getExpense(input);
  await expect(
    f.api.updateExpense({
      ...input,
      version: read.version,
      amount: "12.00",
    }),
  ).rejects.toThrow("custom split");

  const converted = await f.api.updateExpense({
    ...input,
    version: read.version,
    amount: "12.00",
    paidBy: f.bob,
    splitBetween: [f.alice, f.bob],
  });

  expect(balances(converted)).toEqual({ Alice: "-6.00", Bob: "6.00" });
  const currentVersion = (await f.api.getExpense(input)).version;
  await expect(
    f.api.updateExpense({
      ...input,
      version: currentVersion,
      paidBy: "constructor",
    }),
  ).rejects.toThrow("participant IDs");
  await expect(
    f.api.updateExpense({
      ...input,
      version: currentVersion,
      splitBetween: ["__proto__"],
    }),
  ).rejects.toThrow("participant IDs");
  const unrelated = await fixture([200]);
  await expect(
    f.api.getExpense({ ...input, expenseId: unrelated.chunk.expenses[0].id }),
  ).rejects.toThrow("does not belong");
  await expect(f.api.getExpense({ ...input, expenseId: `missing:${f.chunk.id}` })).rejects.toThrow(
    "not found",
  );
  await f.docs.change<PartyExpenseChunk>(f.chunk.id, (doc) => {
    doc.expenses[0].isTransfer = true;
  });
  const transfer = await f.api.getExpense(input);
  await expect(
    f.api.updateExpense({
      ...input,
      version: transfer.version,
      name: "Transfer",
    }),
  ).rejects.toThrow("transfers");
  await expect(f.api.deleteExpense({ ...input, version: transfer.version })).rejects.toThrow(
    "transfers",
  );
});

it("updates party details and archives/restores people while preserving IDs, history, and profile fields", async () => {
  const f = await fixture([1000]);
  await f.docs.change<Party>(f.partyId, (doc) => {
    doc.participants[f.bob].phone = "test-contact";
  });

  await expect(
    f.api.updateParticipant({
      partyId: f.partyId,
      participantId: "constructor",
      name: "Other",
    }),
  ).rejects.toThrow("participant ID");

  const updated = await f.api.updateParty({
    partyId: f.partyId,
    name: "Trip",
    description: "Shared trip",
    symbol: "",
  });

  expect(updated).toMatchObject({
    name: "Trip",
    description: "Shared trip",
    symbol: "",
    currency: "EUR",
  });

  const archived = await f.api.updateParticipant({
    partyId: f.partyId,
    participantId: f.bob,
    name: "Robert",
    archived: true,
  });

  expect(archived.participants.find((person) => person.id === f.bob)).toMatchObject({
    name: "Robert",
    archived: true,
    balance: "-5.00",
  });
  expect((await f.docs.read<Party>(f.partyId)).participants[f.bob].phone).toBe("test-contact");
  await expect(
    f.api.updateParticipant({
      partyId: f.partyId,
      participantId: f.alice,
      archived: true,
    }),
  ).rejects.toThrow("at least one");
  await expect(
    f.api.updateParticipant({
      partyId: f.partyId,
      participantId: f.bob,
      name: "alice",
    }),
  ).rejects.toThrow("already exists");
  await f.api.updateParticipant({
    partyId: f.partyId,
    participantId: f.bob,
    archived: false,
  });
  const fresh = await service().getParty(f.partyId);
  expect(fresh.participants.find((person) => person.id === f.bob)).toMatchObject({
    archived: false,
    balance: "-5.00",
  });
  expect(fresh.expenses).toHaveLength(1);
});

it.each(["update", "delete"] as const)(
  "reconciles a delayed %s projection after another writer edits the same chunk",
  async (operation) => {
    const f = await fixture();
    const firstDocs = documents();
    const secondDocs = documents();
    const firstApi = service(firstDocs);
    const secondApi = service(secondDocs);

    const first = await firstApi.getExpense({
      partyId: f.partyId,
      expenseId: f.chunk.expenses[0].id,
    });

    const second = await secondApi.getExpense({
      partyId: f.partyId,
      expenseId: f.chunk.expenses[1].id,
    });

    let release!: () => void;

    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });

    let reached!: () => void;

    const publishing = new Promise<void>((resolve) => {
      reached = resolve;
    });

    let intercepted = false;
    const fork = firstDocs.fork.bind(firstDocs);
    vi.spyOn(firstDocs, "fork").mockImplementation(() => {
      const fresh = fork();

      if (!intercepted) {
        intercepted = true;
        const find = fresh.find.bind(fresh);
        vi.spyOn(fresh, "find").mockImplementation(async <T>(id: Party["id"]) => {
          const handle = await find<T>(id);

          return {
            doc: handle.doc,
            change: async (fn: ChangeFn<T>) => {
              if (id === f.summary.id) {
                reached();
                await delayed;
              }

              return handle.change(fn);
            },
          };
        });
      }

      return fresh;
    });

    const firstInput = {
      partyId: f.partyId,
      expenseId: first.expenseId,
      version: first.version,
    };

    const writing =
      operation === "update"
        ? firstApi.updateExpense({ ...firstInput, amount: "12.00" })
        : firstApi.deleteExpense(firstInput);

    try {
      await publishing;
      await secondApi.updateExpense({
        partyId: f.partyId,
        expenseId: second.expenseId,
        version: second.version,
        amount: "24.00",
      });
    } finally {
      release();
      await writing;
    }

    const expected = operation === "update" ? "18.00" : "12.00";
    const fresh = await service().getParty(f.partyId);
    expect(fresh.participants.find((person) => person.id === f.alice)?.balance).toBe(expected);
    const persisted = (await server.find<PartyExpenseChunkBalances>(f.summary.id)).doc();
    expect(persisted.balances[f.alice].stats.balance).toBe(operation === "update" ? 1800 : 1200);
  },
);

it("merges overlapping edits to separate expense fields and reconciles their content hash", async () => {
  const f = await fixture([1000]);
  const first = service();
  const second = service();
  const input = { partyId: f.partyId, expenseId: f.chunk.expenses[0].id };
  const version = (await first.getExpense(input)).version;
  await second.getExpense(input);

  const results = await Promise.allSettled([
    first.updateExpense({ ...input, version, name: "Lunch" }),
    second.updateExpense({ ...input, version, amount: "12.00" }),
  ]);

  expect(results.some((result) => result.status === "fulfilled")).toBe(true);

  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);

  expect(
    failures.every((error) => error instanceof McpToolError && /changed since/.test(error.message)),
  ).toBe(true);
  const fresh = service();
  const expense = await fresh.getExpense(input);
  // A writer that observed the other's newer version may reject its stale edit.
  // Whichever changes are accepted must leave the shared projection and hash consistent.
  const persisted = (await server.find<PartyExpenseChunk>(f.chunk.id)).doc().expenses[0];
  expect(persisted.__hash).toBe(calculateExpenseHash(persisted));
  expect(expense.version).toBe(persisted.__hash);
  const summary = (await server.find<PartyExpenseChunkBalances>(f.summary.id)).doc();
  const party = (await server.find<Party>(f.partyId)).doc();
  expect(summary.balances).toEqual(calculateBalancesByParticipant([persisted], party.participants));
});

it("bounds reconciliation when another writer keeps replacing the balance projection", async () => {
  const f = await fixture([1000]);
  const doc = documents();
  const api = service(doc);
  const input = { partyId: f.partyId, expenseId: f.chunk.expenses[0].id };
  const version = (await api.getExpense(input)).version;
  const fork = doc.fork.bind(doc);
  const projectionWrites = vi.fn<() => void>();
  vi.spyOn(doc, "fork").mockImplementation(() => {
    const fresh = fork();
    const find = fresh.find.bind(fresh);
    vi.spyOn(fresh, "find").mockImplementation(async <T>(id: Party["id"]) => {
      const handle = await find<T>(id);

      return {
        doc: handle.doc,
        change: async (fn: ChangeFn<T>) => {
          const result = await handle.change(fn);

          if (id === f.summary.id) {
            projectionWrites();
            const stored = await server.find<PartyExpenseChunkBalances>(f.summary.id);
            stored.change((state) => {
              state.balances = {};
            });
          }

          return result;
        },
      };
    });

    return fresh;
  });
  await expect(api.updateExpense({ ...input, version, amount: "12.00" })).rejects.toThrow(
    "change reached trizum",
  );
  expect(projectionWrites).toHaveBeenCalledTimes(4);
  const expense = await service().getExpense(input);
  expect(expense.amount).toBe("12.00");
});

it("reads and updates an expense outside the recent twenty when its ID is known", async () => {
  const f = await fixture(Array.from({ length: 25 }, () => 100));
  const recent = await f.api.getParty(f.partyId);
  const shown = new Set(recent.expenses.map((expense) => expense.id));
  const older = f.chunk.expenses.find((expense) => !shown.has(expense.id))!;
  const input = { partyId: f.partyId, expenseId: older.id };
  const read = await f.api.getExpense(input);
  await f.api.updateExpense({
    ...input,
    version: read.version,
    name: "Older lunch",
  });
  expect(await service().getExpense(input)).toMatchObject({ name: "Older lunch", amount: "1.00" });
});

it("keeps exact cents at the MCP input limit using the shared money conversion", async () => {
  const f = await fixture([1000]);

  const result = await f.api.addExpense({
    partyId: f.partyId,
    name: "Large expense",
    amount: "9999999999.99",
    paidBy: f.alice,
    // Keep this conversion check independent of tied remainder allocation in shared splits.
    splitBetween: [f.bob],
    paidAt: "2026-11-06T20:00:00Z",
  });

  expect(result.expenses.find((expense) => expense.name === "Large expense")?.amount).toBe(
    "9999999999.99",
  );
  expect(balances(result)).toEqual({ Alice: "10000000004.99", Bob: "-10000000004.99" });
});
