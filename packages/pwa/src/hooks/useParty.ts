import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import {
  createExpenseId,
  calculateExpenseHash,
  type Expense,
} from "#src/models/expense.js";
import type {
  Party,
  PartyExpenseChunk,
  PartyParticipant,
} from "#src/models/party.js";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import {
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
    details: Partial<Pick<PartyParticipant, "phone">>,
  ) {
    handle.change((doc) => {
      const participant = doc.participants[participantId];

      if (!participant) {
        return;
      }

      doc.participants[participantId].phone = details.phone;
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

    return [handle.documentId, handle] as const;
  }

  async function addExpenseToParty(
    expense: Omit<Expense, "id" | "__hash">,
  ): Promise<Expense> {
    if (!party) {
      throw new Error("Party not found, this should not happen");
    }

    // Last chunk is the most recent one, so should be indexed at 0
    let lastChunkId = party.chunkIds.at(0);

    if (!lastChunkId) {
      // Create a new chunk if there is none
      const [chunkId] = createChunk();
      lastChunkId = chunkId;
    }

    let lastChunkHandle = repo.find<PartyExpenseChunk>(lastChunkId);
    let lastChunk = await lastChunkHandle.doc();

    if (!lastChunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    if (lastChunk.expenses.length >= lastChunk.maxSize) {
      // Create a new chunk if the last one is full
      const [chunkId, handle] = createChunk();
      lastChunkId = chunkId;
      lastChunkHandle = handle;
      lastChunk = await lastChunkHandle.doc();

      if (!lastChunk) {
        throw new Error("Chunk not found, this should not happen");
      }
    }

    const expenseWithId = {
      ...expense,
      id: createExpenseId(lastChunkId),
    };
    const expenseWithHash = {
      ...expenseWithId,
      __hash: calculateExpenseHash({
        ...expenseWithId,
        __hash: "",
      }),
    };

    lastChunkHandle.change((doc) => {
      doc.expenses.unshift(expenseWithHash);
    });

    if (party.chunkIds.includes(lastChunkId)) {
      return expenseWithHash;
    }

    handle.change((party) => {
      party.chunkIds.unshift(lastChunkId);
    });

    return expenseWithHash;
  }

  return {
    party,
    partyId,
    isLoading: handle.inState(["loading"]),
    updateSettings,
    setParticipantDetails,
    addExpenseToParty,
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
