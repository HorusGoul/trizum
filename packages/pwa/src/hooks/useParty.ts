import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import {
  createExpenseId,
  calculateExpenseHash,
  type Expense,
  calculateBalancesByParticipant,
} from "#src/models/expense.js";
import type {
  Party,
  PartyExpenseChunk,
  PartyExpenseChunkRef,
  PartyParticipant,
} from "#src/models/party.js";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import {
  insertAt,
  isValidDocumentId,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
import { useParams } from "@tanstack/react-router";

export function useParty(partyId: string) {
  if (!isValidDocumentId(partyId)) throw new Error("Malformed Party ID");
  const [party, handle] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });

  function updateSettings(
    values: Pick<Party, "name" | "description" | "participants">,
  ) {
    handle.change((doc) => {
      doc.name = values.name;
      doc.description = values.description;
      doc.participants = values.participants;
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

  const repo = useRepo();

  function createChunk() {
    const handle = repo.create<PartyExpenseChunk>({
      id: "" as DocumentId,
      createdAt: new Date(),
      expenses: [],
      maxSize: 500,
    });

    handle.change((doc) => (doc.id = handle.documentId));

    const chunkRef: PartyExpenseChunkRef = {
      chunkId: handle.documentId,
      createdAt: new Date(),
      balancesByParticipant: {},
    };

    return [chunkRef, handle] as const;
  }

  async function addExpenseToParty(
    expense: Omit<Expense, "id" | "__hash">,
  ): Promise<Expense> {
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
      const [chunkId, handle] = createChunk();
      lastChunkRef = chunkId;
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
      const balancesByParticipant = calculateBalancesByParticipant(
        lastChunk.expenses,
        party.participants,
      );

      const lastChunkRef = party.chunkRefs.find(
        (chunkRef) => chunkRef.chunkId === lastChunk.id,
      );

      if (!lastChunkRef) {
        throw new Error("Chunk ref not found, this should not happen");
      }

      lastChunkRef.balancesByParticipant = balancesByParticipant;

      if (!party.chunkRefs.includes(lastChunkRef)) {
        insertAt(party.chunkRefs, 0, lastChunkRef);
      }
    });

    if (party.chunkRefs.includes(lastChunkRef)) {
      return expenseWithHash;
    }

    return expenseWithHash;
  }

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
      await addExpenseToParty({
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
    updateSettings,
    setParticipantDetails,
    addExpenseToParty,
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
