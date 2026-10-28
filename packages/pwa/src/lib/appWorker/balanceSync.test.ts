import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { Repo } from "@automerge/automerge-repo";
import { getHeads } from "@automerge/automerge/slim";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "#src/models/party.ts";
import type { Expense } from "#src/models/expense.ts";
import {
  createRecalculateBalancesRequest,
  recalculateSynchronizedBalances,
  waitForDocumentHeads,
} from "./balanceSync.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe("balance synchronization", () => {
  test("waits for an already cached party to receive new chunk references, then syncs results back", async () => {
    const { main, worker, party, chunk, balances, release } = await createPeers();
    const cached = await worker.find<Party>(party.documentId);
    expect(cached.doc().chunkRefs).toHaveLength(0);
    party.change((doc) => {
      doc.chunkRefs.push({
        chunkId: chunk.documentId,
        balancesId: balances.documentId,
        createdAt: new Date(),
      });
    });
    const request = await createRecalculateBalancesRequest(main, party.documentId);
    const off = vi.spyOn(cached, "off");
    const on = vi.spyOn(cached, "on");
    let completed = false;
    const calculation = recalculateSynchronizedBalances(worker, request).then((result) => {
      completed = true;
      return result;
    });
    await expect.poll(() => on.mock.calls.some(([event]) => event === "heads-changed")).toBe(true);
    expect(completed).toBe(false);
    expect(balances.doc().balances).toEqual({});

    release();
    const result = await calculation;
    await waitForDocumentHeads(main, result, AbortSignal.timeout(1000));
    expect(balances.doc().balances.alice.stats.balance).toBe(3000);
    expect(balances.doc().balances.bob.stats.balance).toBe(-3000);
    expect(off).toHaveBeenCalledWith("heads-changed", expect.any(Function));
    expect(off).toHaveBeenCalledWith("delete", expect.any(Function));
  });

  test("waits for changes to an already cached expense chunk", async () => {
    const { main, worker, party, chunk, balances, release } = await createPeers(true);
    const cached = await worker.find<PartyExpenseChunk>(chunk.documentId);
    const on = vi.spyOn(cached, "on");
    chunk.change((doc) => {
      doc.expenses[0].paidBy.alice = 8000;
    });
    const request = await createRecalculateBalancesRequest(main, party.documentId);
    let completed = false;
    const calculation = recalculateSynchronizedBalances(worker, request).then((result) => {
      completed = true;
      return result;
    });
    await expect.poll(() => on.mock.calls.some(([event]) => event === "heads-changed")).toBe(true);
    expect(completed).toBe(false);
    release();
    await waitForDocumentHeads(main, await calculation, AbortSignal.timeout(1000));
    expect(balances.doc().balances.alice.stats.balance).toBe(4000);
    expect(balances.doc().balances.bob.stats.balance).toBe(-4000);
  });

  test("waits for calculated balance heads to synchronize back to the caller", async () => {
    const { main, worker, party, balances, release, holdReverse } = await createPeers(true);
    release();
    const releaseReverse = holdReverse();
    const request = await createRecalculateBalancesRequest(main, party.documentId);
    const result = await recalculateSynchronizedBalances(worker, request);
    expect(balances.doc().balances).toEqual({});
    const on = vi.spyOn(balances, "on");
    let completed = false;
    const pending = waitForDocumentHeads(main, result, AbortSignal.timeout(1000)).then(() => {
      completed = true;
    });
    await expect.poll(() => on.mock.calls.some(([event]) => event === "heads-changed")).toBe(true);
    expect(completed).toBe(false);
    releaseReverse();
    await pending;
    expect(balances.doc().balances.bob.stats.balance).toBe(-3000);
  });

  test("synchronizes history-only expense heads without visible changes", async () => {
    const { main, worker, party, chunk, balances, release } = await createPeers(true);
    const cached = await worker.find<PartyExpenseChunk>(chunk.documentId);
    const visibleChanges = vi.fn();
    const headsChanged = vi.fn();
    cached.on("change", visibleChanges);
    cached.on("heads-changed", headsChanged);
    const on = vi.spyOn(cached, "on");
    chunk.change((doc) => {
      doc.expenses.push({
        id: "synthetic-transient",
        name: "Transient expense",
        paidAt: new Date(),
        paidBy: { alice: 100 },
        shares: { alice: { type: "divide", value: 1 } },
        photos: [],
        __hash: "",
      });
      doc.expenses.pop();
    });
    const request = await createRecalculateBalancesRequest(main, party.documentId);
    const calculation = recalculateSynchronizedBalances(worker, request, AbortSignal.timeout(1000));
    await expect
      .poll(() => on.mock.calls.some(([event]) => event === "change" || event === "heads-changed"))
      .toBe(true);
    release();
    const result = await calculation;
    await waitForDocumentHeads(main, result, AbortSignal.timeout(1000));
    expect(headsChanged).toHaveBeenCalled();
    expect(visibleChanges).not.toHaveBeenCalled();
    expect(balances.doc().balances.alice.stats.balance).toBe(3000);
    expect(balances.doc().balances.bob.stats.balance).toBe(-3000);
  });

  test("rejects a held-sync deadline and removes its listeners", async () => {
    const { worker, party, release } = await createPeers();
    const cached = await worker.find<Party>(party.documentId);
    const on = vi.spyOn(cached, "on");
    const off = vi.spyOn(cached, "off");
    party.change((doc) => {
      doc.name = "Updated synthetic party";
    });
    const signal = AbortSignal.timeout(50);
    const pending = waitForDocumentHeads(
      worker,
      [{ documentId: party.documentId, heads: getHeads(party.doc()) }],
      signal,
    );
    const rejected = pending.catch((error: unknown) => error);
    await expect.poll(() => on.mock.calls.some(([event]) => event === "heads-changed")).toBe(true);
    expect(await rejected).toMatchObject({ name: "TimeoutError" });
    expect(off).toHaveBeenCalledWith("heads-changed", expect.any(Function));
    expect(off).toHaveBeenCalledWith("delete", expect.any(Function));
    release();
  });
});

async function createPeers(withExistingChunk = false) {
  const main = new Repo({ network: [] });
  const worker = new Repo({ network: [] });
  const party = main.create<Party>({
    id: "" as Party["id"],
    type: "party",
    name: "Synthetic party",
    description: "",
    currency: "EUR",
    participants: {
      alice: { id: "alice", name: "Synthetic A" },
      bob: { id: "bob", name: "Synthetic B" },
    },
    chunkRefs: [],
  });
  party.change((doc) => {
    doc.id = party.documentId;
  });
  const expense: Expense = {
    id: "synthetic-expense",
    name: "Synthetic groceries",
    paidAt: new Date(),
    paidBy: { alice: 6000 },
    shares: { alice: { type: "divide", value: 1 }, bob: { type: "divide", value: 1 } },
    photos: [],
    __hash: "",
  };
  const chunk = main.create<PartyExpenseChunk>({
    id: "" as PartyExpenseChunk["id"],
    type: "expenseChunk",
    partyId: party.documentId,
    expenses: [expense],
    maxSize: 500,
    createdAt: new Date(),
  });
  chunk.change((doc) => {
    doc.id = chunk.documentId;
  });
  const balances = main.create<PartyExpenseChunkBalances>({
    id: "" as PartyExpenseChunkBalances["id"],
    type: "expenseChunkBalances",
    partyId: party.documentId,
    balances: {},
  });
  balances.change((doc) => {
    doc.id = balances.documentId;
  });
  if (withExistingChunk)
    party.change((doc) => {
      doc.chunkRefs.push({
        chunkId: chunk.documentId,
        balancesId: balances.documentId,
        createdAt: new Date(),
      });
    });
  for (const handle of [party, chunk, balances]) {
    const binary = await main.export(handle.documentId);
    if (!binary) throw new Error("Expected synthetic document export");
    worker.import(binary, { docId: handle.documentId });
  }
  const channel = new MessageChannel();
  let held = true;
  const queued: (() => void)[] = [];
  const adapter = new MessageChannelNetworkAdapter(channel.port1);
  const send = adapter.send.bind(adapter);
  adapter.send = (message) => {
    if (held) queued.push(() => send(message));
    else send(message);
  };
  main.networkSubsystem.addNetworkAdapter(adapter);
  const reverseAdapter = new MessageChannelNetworkAdapter(channel.port2);
  const reverseSend = reverseAdapter.send.bind(reverseAdapter);
  const reverseQueue: (() => void)[] = [];
  let reverseHeld = false;
  reverseAdapter.send = (message) => {
    if (reverseHeld) reverseQueue.push(() => reverseSend(message));
    else reverseSend(message);
  };
  worker.networkSubsystem.addNetworkAdapter(reverseAdapter);
  function holdReverse() {
    reverseHeld = true;
    return () => {
      reverseHeld = false;
      reverseQueue.splice(0).forEach((deliver) => deliver());
    };
  }
  function release() {
    held = false;
    queued.splice(0).forEach((deliver) => deliver());
  }
  cleanups.push(async () => {
    release();
    await Promise.all([main.shutdown(), worker.shutdown()]);
    channel.port1.close();
    channel.port2.close();
  });
  return { main, worker, party, chunk, balances, release, holdReverse };
}
