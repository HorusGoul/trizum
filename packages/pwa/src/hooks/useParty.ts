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
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import {
  deleteAt,
  DocHandle,
  insertAt,
  isValidDocumentId,
  Repo,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
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

export function getPartyHelpers(repo: Repo, handle: DocHandle<Party>) {
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
      Pick<PartyParticipant, "phone" | "personalMode" | "avatarId">
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
    const handle = repo.create<PartyExpenseChunk>({
      id: "" as DocumentId,
      createdAt: new Date(),
      expenses: [],
      maxSize: 500,
    });

    handle.change((doc) => (doc.id = handle.documentId));

    const balancesHandle = repo.create<PartyExpenseChunkBalances>({
      id: "" as DocumentId,
      balances: {},
    });
    balancesHandle.change((doc) => (doc.id = balancesHandle.documentId));

    const chunkRef: PartyExpenseChunkRef = {
      chunkId: handle.documentId,
      createdAt: new Date(),
      balancesId: balancesHandle.documentId,
    };

    return [chunkRef, handle] as const;
  }

  async function addExpenseToParty(
    expense: Omit<Expense, "id" | "__hash">,
  ): Promise<Expense> {
    const party = handle.docSync();

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

    let lastChunkHandle = repo.find<PartyExpenseChunk>(lastChunkRef.chunkId);
    let lastChunk = await lastChunkHandle.doc();

    if (!lastChunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    if (lastChunk.expenses.length >= lastChunk.maxSize) {
      // Create a new chunk if the last one is full
      const [chunkRef, handle] = createChunk();
      lastChunkRef = chunkRef;
      lastChunkHandle = handle;
      lastChunk = await lastChunkHandle.doc();

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
    lastChunk = lastChunkHandle.docSync();

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

    const lastChunkBalancesHandle = repo.find<PartyExpenseChunkBalances>(
      lastChunkRef.balancesId,
    );
    const lastChunkBalances = await lastChunkBalancesHandle.doc();

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
    const party = handle.docSync();

    if (!party) {
      throw new Error("Party not found, this should not happen");
    }

    const { chunkId } = decodeExpenseId(expense.id);

    const chunkRef = party.chunkRefs.find((chunk) => chunk.chunkId === chunkId);

    if (!chunkRef) {
      throw new Error("Chunk not found, this should not happen");
    }

    const chunkHandle = repo.find<PartyExpenseChunk>(chunkRef.chunkId);
    let chunk = await chunkHandle.doc();

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

    chunk = chunkHandle.docSync();

    if (!chunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    const lastChunkBalancesHandle = repo.find<PartyExpenseChunkBalances>(
      chunkRef.balancesId,
    );
    const lastChunkBalances = await lastChunkBalancesHandle.doc();

    if (!lastChunkBalances) {
      throw new Error("Chunk balances not found, this should not happen");
    }

    const balancesByParticipant = calculateBalancesByParticipant(
      chunk.expenses,
      party.participants,
    );

    console.log(
      JSON.parse(
        JSON.stringify(
          {
            expenses: chunk.expenses,
            participants: party.participants,
            balancesByParticipant,
          },
          null,
          2,
        ),
      ),
    );

    lastChunkBalancesHandle.change((doc) => {
      patchMutate(
        doc.balances,
        diff(clone(doc.balances), clone(balancesByParticipant)),
      );
    });
  }

  async function removeExpense(expenseId: Expense["id"]) {
    const party = handle.docSync();

    if (!party) {
      throw new Error("Party not found, this should not happen");
    }

    const { chunkId } = decodeExpenseId(expenseId);

    const chunkRef = party.chunkRefs.find((chunk) => chunk.chunkId === chunkId);

    if (!chunkRef) {
      throw new Error("Chunk not found, this should not happen");
    }

    const chunkHandle = repo.find<PartyExpenseChunk>(chunkRef.chunkId);
    let chunk = await chunkHandle.doc();

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

    chunk = chunkHandle.docSync();

    if (!chunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    const lastChunkBalancesHandle = repo.find<PartyExpenseChunkBalances>(
      chunkRef.balancesId,
    );
    const lastChunkBalances = await lastChunkBalancesHandle.doc();

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
    await lastChunkBalancesHandle.doc();

    return true;
  }

  return {
    updateSettings,
    setParticipantDetails,
    addExpenseToParty,
    updateExpense,
    removeExpense,
  };
}
