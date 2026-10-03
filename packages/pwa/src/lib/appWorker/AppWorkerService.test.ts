import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { merge } from "@automerge/automerge";
import { Repo, type DocumentId } from "@automerge/automerge-repo";
import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "#src/models/party.ts";
import { createDebtTransferExpenses } from "#src/lib/debtTransfer.ts";
import { recalculatePartyBalances } from "#src/lib/recalculatePartyBalances.ts";
import { AppWorkerService } from "./AppWorkerService.ts";
import { getBalanceCalculationDependencies } from "./balanceCalculationSync.ts";

const { createAppWorkerRepo } = vi.hoisted(() => ({ createAppWorkerRepo: vi.fn<() => Repo>() }));
vi.mock("./createAppWorkerRepo.ts", () => ({ createAppWorkerRepo }));

const repos: Repo[] = [];
afterEach(async () => {
  await Promise.all(repos.splice(0).map((repo) => repo.shutdown()));
});

describe("AppWorkerService balance recalculation", () => {
  test.each(["origin", "destination"] as const)(
    "recalculates the %s after delayed transfer changes arrive",
    async (side) => {
      const mainRepo = createRepo();
      const workerRepo = createRepo();
      const party = mainRepo.create<Party>({
        id: "" as DocumentId,
        type: "party",
        name: "Trip",
        description: "",
        currency: "EUR",
        participants: { alice: { id: "alice", name: "Alice" }, bob: { id: "bob", name: "Bob" } },
        chunkRefs: [],
      });
      party.change((doc) => {
        doc.id = party.documentId;
      });
      const { originExpense, destinationExpense } = createDebtTransferExpenses({
        amount: 500,
        originDebtorId: "bob",
        originCreditorId: "alice",
        destinationDebtorId: "bob",
        destinationCreditorId: "alice",
        paidAt: new Date("2026-04-18T10:20:30.000Z"),
        originExpenseName: "Transfer out",
        destinationExpenseName: "Transfer in",
      });
      const chunk = mainRepo.create<PartyExpenseChunk>({
        id: "" as DocumentId,
        type: "expenseChunk",
        partyId: party.documentId,
        createdAt: new Date(),
        maxSize: 500,
        expenses:
          side === "origin" ? [{ ...destinationExpense, id: "original-debt", __hash: "" }] : [],
      });
      const balances = mainRepo.create<PartyExpenseChunkBalances>({
        id: "" as DocumentId,
        type: "expenseChunkBalances",
        partyId: party.documentId,
        balances: {},
      });
      const chunkRef = {
        chunkId: chunk.documentId,
        balancesId: balances.documentId,
        createdAt: new Date(),
      };
      if (side === "origin")
        party.change((doc) => {
          doc.chunkRefs.push(chunkRef);
        });
      await recalculatePartyBalances(mainRepo, party.documentId);

      // The worker already knows the party, but has not received the transfer yet.
      for (const handle of [party, chunk, balances]) {
        workerRepo.import((await mainRepo.export(handle.documentId))!, {
          docId: handle.documentId,
        });
      }
      const workerParty = await workerRepo.find<Party>(party.documentId);
      const workerChunk = await workerRepo.find<PartyExpenseChunk>(chunk.documentId);
      const workerBalances = await workerRepo.find<PartyExpenseChunkBalances>(balances.documentId);
      const transferExpense = side === "origin" ? originExpense : destinationExpense;
      chunk.change((doc) => {
        doc.expenses.push({ ...transferExpense, id: "transfer", __hash: "" });
      });
      if (side === "destination")
        party.change((doc) => {
          doc.chunkRefs.push(chunkRef);
        });

      createAppWorkerRepo.mockReturnValue(workerRepo);
      const service = new AppWorkerService();
      await service.initialize({ repoPort: {} as MessagePort, wssUrl: "", isOfflineOnly: true });
      const dependencies = await getBalanceCalculationDependencies(mainRepo, party.documentId);
      const changeListeners = workerChunk.listenerCount("change");
      let completed = false;
      const calculation = service.recalculateBalances(party.documentId, dependencies).then(() => {
        completed = true;
      });

      // Deliver sync only after the request has either waited or incorrectly finished.
      await vi.waitFor(() => {
        expect(completed || workerChunk.listenerCount("change") > changeListeners).toBe(true);
      });
      workerParty.update((doc) => merge(doc, party.doc()));
      workerChunk.update((doc) => merge(doc, chunk.doc()));
      await calculation;

      expect(workerBalances.doc().balances.alice?.stats.balance).toBe(side === "origin" ? 0 : 500);
      expect(workerBalances.doc().balances.bob?.stats.balance).toBe(side === "origin" ? 0 : -500);
    },
  );
});

function createRepo() {
  const repo = new Repo({ network: [] });
  repos.push(repo);
  return repo;
}
