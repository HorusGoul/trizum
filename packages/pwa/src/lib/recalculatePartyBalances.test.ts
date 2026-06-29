import { describe, expect, test, vi } from "vite-plus/test";
import type { DocHandle, DocumentId, Repo } from "@automerge/automerge-repo/slim";
import { calculateBalancesByParticipant, type Expense } from "#src/models/expense.ts";
import type {
  Party,
  PartyExpenseChunk,
  PartyExpenseChunkBalances,
  PartyExpenseChunkRef,
  PartyParticipant,
} from "#src/models/party.ts";
import { recalculatePartyBalances } from "./recalculatePartyBalances.ts";

describe("recalculatePartyBalances", () => {
  test("checks every chunk and writes only changed chunk balance documents", async () => {
    const { repo, handles, find, flush } = createRepoMock();
    const party = createParty([
      createChunkRef("chunk-1", "balances-1"),
      createChunkRef("chunk-2", "balances-2"),
    ]);
    const chunk1 = createChunk("chunk-1", [
      createExpense("expense-1", {
        paidBy: "alice",
        amount: 1000,
      }),
    ]);
    const chunk2 = createChunk("chunk-2", [
      createExpense("expense-2", {
        paidBy: "bob",
        amount: 2000,
      }),
    ]);
    const chunk1Balances = createChunkBalances("balances-1");
    const chunk2Balances = createChunkBalances(
      "balances-2",
      structuredClone(calculateBalancesByParticipant(chunk2.expenses, party.participants)),
    );

    handles.set(party.id, createHandle(party.id, party));
    handles.set(chunk1.id, createHandle(chunk1.id, chunk1));
    handles.set(chunk2.id, createHandle(chunk2.id, chunk2));
    const chunk1BalancesHandle = createHandle(chunk1Balances.id, chunk1Balances);
    const chunk2BalancesHandle = createHandle(chunk2Balances.id, chunk2Balances);
    handles.set(chunk1Balances.id, chunk1BalancesHandle);
    handles.set(chunk2Balances.id, chunk2BalancesHandle);

    await recalculatePartyBalances(repo, party.id);

    expect(find).toHaveBeenCalledWith(party.id);
    expect(find).toHaveBeenCalledWith(chunk1.id);
    expect(find).toHaveBeenCalledWith(chunk1Balances.id);
    expect(find).toHaveBeenCalledWith(chunk2.id);
    expect(find).toHaveBeenCalledWith(chunk2Balances.id);
    expect(chunk1BalancesHandle.change).toHaveBeenCalledOnce();
    expect(chunk2BalancesHandle.change).not.toHaveBeenCalled();
    expect(chunk1Balances.balances).toEqual(
      calculateBalancesByParticipant(chunk1.expenses, party.participants),
    );
    expect(chunk2Balances.balances).toEqual(
      calculateBalancesByParticipant(chunk2.expenses, party.participants),
    );
    expect(flush).toHaveBeenCalledWith([chunk1Balances.id]);
  });

  test("does not write unchanged chunk balance documents", async () => {
    const { repo, handles, flush } = createRepoMock();
    const chunkRef = createChunkRef("chunk-1", "balances-1");
    const party = createParty([chunkRef]);
    const chunk = createChunk("chunk-1", [
      createExpense("expense-1", {
        paidBy: "alice",
        amount: 1000,
      }),
    ]);
    const existingBalances = calculateBalancesByParticipant(chunk.expenses, party.participants);
    const chunkBalances = createChunkBalances("balances-1", structuredClone(existingBalances));

    handles.set(party.id, createHandle(party.id, party));
    handles.set(chunk.id, createHandle(chunk.id, chunk));
    const chunkBalancesHandle = createHandle(chunkBalances.id, chunkBalances);
    handles.set(chunkBalances.id, chunkBalancesHandle);

    await recalculatePartyBalances(repo, party.id);

    expect(chunkBalancesHandle.change).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });
});

function createRepoMock() {
  const handles = new Map<DocumentId, TestDocHandle<unknown>>();
  const find = vi.fn<(documentId: DocumentId) => Promise<TestDocHandle<unknown>>>(
    async (documentId) => {
      const handle = handles.get(documentId);

      if (!handle) {
        throw new Error(`Missing test handle: ${documentId}`);
      }

      return handle;
    },
  );
  const flush = vi.fn<(_documentIds: DocumentId[]) => Promise<void>>(async () => {});

  return {
    handles,
    find,
    flush,
    repo: {
      find,
      flush,
    } as unknown as Repo,
  };
}

interface TestDocHandle<T> extends Pick<DocHandle<T>, "change" | "doc" | "documentId"> {}

function createHandle<T>(documentId: DocumentId, document: T): TestDocHandle<T> {
  return {
    documentId,
    doc: vi.fn<() => T>(() => document),
    change: vi.fn<(changeFn: (doc: T) => void) => void>((changeFn) => changeFn(document)),
  };
}

function createParty(chunkRefs: PartyExpenseChunkRef[]): Party {
  return {
    id: "party-id" as DocumentId,
    type: "party",
    name: "Test party",
    description: "",
    currency: "EUR",
    participants: {
      alice: createParticipant("alice", "Alice"),
      bob: createParticipant("bob", "Bob"),
    },
    chunkRefs,
  };
}

function createParticipant(id: PartyParticipant["id"], name: PartyParticipant["name"]) {
  return {
    id,
    name,
  };
}

function createChunkRef(chunkId: string, balancesId: string): PartyExpenseChunkRef {
  return {
    chunkId: chunkId as DocumentId,
    balancesId: balancesId as DocumentId,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
  };
}

function createChunk(id: string, expenses: Expense[]): PartyExpenseChunk {
  return {
    id: id as DocumentId,
    type: "expenseChunk",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    expenses,
    maxSize: 500,
    partyId: "party-id" as DocumentId,
  };
}

function createChunkBalances(
  id: string,
  balances: PartyExpenseChunkBalances["balances"] = {},
): PartyExpenseChunkBalances {
  return {
    id: id as DocumentId,
    type: "expenseChunkBalances",
    balances,
    partyId: "party-id" as DocumentId,
  };
}

function createExpense(
  id: string,
  {
    paidBy,
    amount,
  }: {
    paidBy: PartyParticipant["id"];
    amount: number;
  },
): Expense {
  return {
    id,
    name: "Expense",
    paidAt: new Date("2024-01-01T12:00:00.000Z"),
    paidBy: {
      [paidBy]: amount,
    },
    shares: {
      alice: {
        type: "divide",
        value: 1,
      },
      bob: {
        type: "divide",
        value: 1,
      },
    },
    photos: [],
    __hash: "",
  };
}
