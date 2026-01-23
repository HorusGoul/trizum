import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import { patchMutate } from "#src/lib/patchMutate.ts";
import {
  createExpenseId,
  calculateExpenseHash,
  type Expense,
  calculateBalancesByParticipant,
  decodeExpenseId,
  applyExpenseDiff,
} from "#src/models/expense.js";
import type {
  Party,
  PartyExpenseChunk,
  PartyExpenseChunkBalances,
  PartyExpenseChunkRef,
  PartyParticipant,
} from "#src/models/party.js";
import { diff } from "@opentf/obj-diff";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import {
  isValidDocumentId,
  insertAt,
  deleteAt,
  type DocumentId,
  type DocumentHandle,
  type Repo,
  type AutomergeAnyDocumentId,
} from "@trizum/sdk";
import { clone } from "@opentf/std";
import { useParams } from "@tanstack/react-router";

export function useParty(partyId: string) {
  if (!isValidDocumentId(partyId)) throw new Error("Malformed Party ID");
  const [party, handle] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });
  const repo = useRepo();

  const helpers = getPartyHelpers(repo, handle);

  async function __dev_createTestExpenses() {
    const promptAnswer = window.prompt("How many test expenses to create?");

    if (!promptAnswer) {
      console.log("No prompt answer");
      return;
    }

    const amount = parseInt(promptAnswer ?? "0");

    console.log("Creating", amount, "test expenses");

    const participants = Object.keys(party.participants);

    for (let i = 0; i < amount; i++) {
      console.log("Creating test expense", i + 1);
      await helpers.addExpenseToParty({
        name: `Test Expense ${i + 1}`,
        paidAt: new Date(),
        shares: {
          [participants.at(0)!]: {
            type: "divide",
            value: 1,
          },
          [participants.at(1)!]: {
            type: "divide",
            value: 1,
          },
        },
        photos: [],
        paidBy: {
          [participants.at(0)!]: 100,
        },
      });
    }
  }

  return {
    party,
    partyId,
    isLoading: handle.inState(["loading"]),
    ...helpers,
    dev: {
      createTestExpenses: __dev_createTestExpenses,
    },
  };
}

export function useCurrentParty() {
  const partyId = useParams({
    strict: false,
    select: (params) => params.partyId,
  });

  if (!partyId) {
    throw new Error("No Party ID found in URL");
  }

  return useParty(partyId);
}

export function getPartyHelpers(repo: Repo, handle: DocumentHandle<Party>) {
  function updateSettings(
    values: Pick<Party, "name" | "description" | "participants" | "hue">,
  ) {
    handle.change((doc) => {
      doc.name = values.name;
      doc.description = values.description;
      doc.participants = values.participants;
      doc.hue = values.hue;
    });
  }

  function setParticipantDetails(
    participantId: PartyParticipant["id"],
    details: Partial<
      Pick<
        PartyParticipant,
        "phone" | "personalMode" | "avatarId" | "balancesSortedBy"
      >
    >,
  ) {
    handle.change((doc) => {
      const participant = doc.participants[participantId];

      if (!participant) {
        return;
      }

      for (const key in details) {
        const value = details[key as keyof typeof details];

        if (value === undefined) {
          delete participant[key as keyof typeof participant];
        } else {
          // @ts-expect-error -- idk tbh
          participant[key] = value;
        }
      }
    });
  }

  function createChunk() {
    const party = handle.doc();
    const chunkHandle = repo.create<PartyExpenseChunk>({
      id: "" as DocumentId,
      type: "expenseChunk",
      createdAt: new Date(),
      expenses: [],
      maxSize: 500,
      partyId: party!.id,
    });

    chunkHandle.change(
      (doc) => (doc.id = chunkHandle.documentId as unknown as DocumentId),
    );

    const balancesHandle = repo.create<PartyExpenseChunkBalances>({
      id: "" as DocumentId,
      type: "expenseChunkBalances",
      balances: {},
      partyId: party!.id,
    });
    balancesHandle.change(
      (doc) => (doc.id = balancesHandle.documentId as unknown as DocumentId),
    );

    const chunkRef: PartyExpenseChunkRef = {
      chunkId: chunkHandle.documentId as unknown as DocumentId,
      createdAt: new Date(),
      balancesId: balancesHandle.documentId as unknown as DocumentId,
    };

    return [chunkRef, chunkHandle] as const;
  }

  async function addExpenseToParty(
    expense: Omit<Expense, "id" | "__hash">,
  ): Promise<Expense> {
    const party = handle.doc();

    if (!party) {
      throw new Error("Party not found, this should not happen");
    }

    // Last chunk is the most recent one, so should be indexed at 0
    let lastChunkRef = party.chunkRefs.at(0);

    if (!lastChunkRef) {
      // Create a new chunk if there is none
      const [chunkRef] = createChunk();
      lastChunkRef = chunkRef;
    }

    let lastChunkHandle = await repo.find<PartyExpenseChunk>(
      lastChunkRef.chunkId as unknown as AutomergeAnyDocumentId,
    );
    let lastChunk = lastChunkHandle.doc();

    if (!lastChunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    if (lastChunk.expenses.length >= lastChunk.maxSize) {
      // Create a new chunk if the last one is full
      const [chunkRef, handle] = createChunk();
      lastChunkRef = chunkRef;
      lastChunkHandle = handle;
      lastChunk = lastChunkHandle.doc();

      if (!lastChunk) {
        throw new Error("Chunk not found, this should not happen");
      }
    }

    const expenseWithId = {
      ...expense,
      id: createExpenseId(lastChunkRef.chunkId),
    };
    const expenseWithHash = {
      ...expenseWithId,
      __hash: calculateExpenseHash({
        ...expenseWithId,
        __hash: "",
      }),
    };

    lastChunkHandle.change((doc) => {
      insertAt(doc.expenses, 0, expenseWithHash);
    });
    lastChunk = lastChunkHandle.doc();

    if (!lastChunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    handle.change((party) => {
      let existingLastChunkRef = party.chunkRefs.find(
        (chunkRef) => chunkRef.chunkId === lastChunk.id,
      );

      if (!existingLastChunkRef) {
        existingLastChunkRef = lastChunkRef;
        insertAt(party.chunkRefs, 0, existingLastChunkRef);
      }
    });

    const lastChunkBalancesHandle = await repo.find<PartyExpenseChunkBalances>(
      lastChunkRef.balancesId as unknown as AutomergeAnyDocumentId,
    );
    const lastChunkBalances = lastChunkBalancesHandle.doc();

    if (!lastChunkBalances) {
      throw new Error("Chunk balances not found, this should not happen");
    }

    const balancesByParticipant = calculateBalancesByParticipant(
      lastChunk.expenses,
      party.participants,
    );

    lastChunkBalancesHandle.change((doc) => {
      patchMutate(
        doc.balances,
        diff(clone(doc.balances), clone(balancesByParticipant)),
      );
    });

    return expenseWithHash;
  }

  async function updateExpense(expense: Expense) {
    const party = handle.doc();

    if (!party) {
      throw new Error("Party not found, this should not happen");
    }

    const { chunkId } = decodeExpenseId(expense.id);

    const chunkRef = party.chunkRefs.find((chunk) => chunk.chunkId === chunkId);

    if (!chunkRef) {
      throw new Error("Chunk not found, this should not happen");
    }

    const chunkHandle = await repo.find<PartyExpenseChunk>(
      chunkRef.chunkId as unknown as AutomergeAnyDocumentId,
    );
    let chunk = chunkHandle.doc();

    if (!chunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    chunkHandle.change((doc) => {
      const expenseEntry = doc.expenses.find((e) => e.id === expense.id);

      if (!expenseEntry) {
        throw new Error("Expense not found, this should not happen");
      }

      applyExpenseDiff(expenseEntry, expense);

      delete expenseEntry.__editCopy;
      delete expenseEntry.__editCopyLastUpdatedAt;
    });

    chunk = chunkHandle.doc();

    if (!chunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    const lastChunkBalancesHandle = await repo.find<PartyExpenseChunkBalances>(
      chunkRef.balancesId as unknown as AutomergeAnyDocumentId,
    );
    const lastChunkBalances = lastChunkBalancesHandle.doc();

    if (!lastChunkBalances) {
      throw new Error("Chunk balances not found, this should not happen");
    }

    const balancesByParticipant = calculateBalancesByParticipant(
      chunk.expenses,
      party.participants,
    );

    lastChunkBalancesHandle.change((doc) => {
      patchMutate(
        doc.balances,
        diff(clone(doc.balances), clone(balancesByParticipant)),
      );
    });
  }

  async function removeExpense(expenseId: Expense["id"]) {
    const party = handle.doc();

    if (!party) {
      throw new Error("Party not found, this should not happen");
    }

    const { chunkId } = decodeExpenseId(expenseId);

    const chunkRef = party.chunkRefs.find((chunk) => chunk.chunkId === chunkId);

    if (!chunkRef) {
      throw new Error("Chunk not found, this should not happen");
    }

    const chunkHandle = await repo.find<PartyExpenseChunk>(
      chunkRef.chunkId as unknown as AutomergeAnyDocumentId,
    );
    let chunk = chunkHandle.doc();

    if (!chunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    chunkHandle.change((doc) => {
      const expenseIndex = doc.expenses.findIndex((e) => e.id === expenseId);

      if (expenseIndex === -1) {
        throw new Error("Expense not found, this should not happen");
      }

      deleteAt(doc.expenses, expenseIndex);
    });

    chunk = chunkHandle.doc();

    if (!chunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    const lastChunkBalancesHandle = await repo.find<PartyExpenseChunkBalances>(
      chunkRef.balancesId as unknown as AutomergeAnyDocumentId,
    );
    const lastChunkBalances = lastChunkBalancesHandle.doc();

    if (!lastChunkBalances) {
      throw new Error("Chunk balances not found, this should not happen");
    }

    const balancesByParticipant = calculateBalancesByParticipant(
      chunk.expenses,
      party.participants,
    );

    lastChunkBalancesHandle.change((doc) => {
      patchMutate(
        doc.balances,
        diff(clone(doc.balances), clone(balancesByParticipant)),
      );
    });
    lastChunkBalancesHandle.doc();

    return true;
  }

  async function recalculateBalances() {
    const party = handle.doc();

    if (!party) {
      throw new Error("Party not found, this should not happen");
    }

    const chunkRefs = party.chunkRefs;

    for (const chunkRef of chunkRefs) {
      const chunkHandle = await repo.find<PartyExpenseChunk>(
        chunkRef.chunkId as unknown as AutomergeAnyDocumentId,
      );
      const chunk = chunkHandle.doc();

      if (!chunk) {
        throw new Error("Chunk not found, this should not happen");
      }

      const balancesByParticipant = calculateBalancesByParticipant(
        chunk.expenses,
        party.participants,
      );

      const chunkBalancesHandle = await repo.find<PartyExpenseChunkBalances>(
        chunkRef.balancesId as unknown as AutomergeAnyDocumentId,
      );
      const chunkBalances = chunkBalancesHandle.doc();

      if (!chunkBalances) {
        throw new Error("Chunk balances not found, this should not happen");
      }

      chunkBalancesHandle.change((doc) => {
        patchMutate(
          doc.balances,
          diff(clone(doc.balances), clone(balancesByParticipant)),
        );
      });
      chunkBalancesHandle.doc();
    }

    return true;
  }

  return {
    updateSettings,
    setParticipantDetails,
    addExpenseToParty,
    updateExpense,
    removeExpense,
    recalculateBalances,
  };
}
