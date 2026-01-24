/**
 * Create party operation.
 */

import type { ITrizumClient } from "../../client.js";
import type { DocumentId, CurrencyCode } from "../../types.js";
import type {
  Party,
  PartyParticipant,
  PartyExpenseChunk,
  PartyExpenseChunkBalances,
  PartyExpenseChunkRef,
} from "../../models/party.js";
import type { ExpenseUser } from "../../models/expense.js";

/**
 * Input for creating a new party.
 */
export interface CreatePartyInput {
  name: string;
  description?: string;
  currency: CurrencyCode;
  hue?: number;
  participants: Record<ExpenseUser, Omit<PartyParticipant, "id">>;
}

/**
 * Result of creating a party.
 */
export interface CreatePartyResult {
  partyId: DocumentId;
  party: Party;
}

/**
 * Create a new party with an initial expense chunk.
 *
 * @param client - The Trizum client
 * @param input - The party data
 * @returns The created party ID and document
 */
export async function createParty(
  client: ITrizumClient,
  input: CreatePartyInput,
): Promise<CreatePartyResult> {
  // Create the initial expense chunk
  const { id: chunkId } = client.create<PartyExpenseChunk>({
    type: "expenseChunk",
    createdAt: new Date(),
    expenses: [],
    maxSize: 500,
    partyId: "" as DocumentId, // Will be updated after party creation
  });

  const { id: balancesId } = client.create<PartyExpenseChunkBalances>({
    type: "expenseChunkBalances",
    balances: {},
    partyId: "" as DocumentId, // Will be updated after party creation
  });

  const chunkRef: PartyExpenseChunkRef = {
    chunkId,
    createdAt: new Date(),
    balancesId,
  };

  // Build participants with IDs
  const participants: Record<ExpenseUser, PartyParticipant> = {};
  for (const [id, participant] of Object.entries(input.participants)) {
    participants[id] = {
      id,
      ...participant,
    };
  }

  // Create the party
  const { id: partyId, handle: partyHandle } = client.create<Party>({
    type: "party",
    name: input.name,
    description: input.description ?? "",
    currency: input.currency,
    hue: input.hue,
    participants,
    chunkRefs: [chunkRef],
  });

  // Update chunk and balances with the party ID
  const chunkHandle = await client.findHandle<PartyExpenseChunk>(chunkId);
  chunkHandle.change((doc) => {
    doc.partyId = partyId;
  });

  const balancesHandle = await client.findHandle<PartyExpenseChunkBalances>(balancesId);
  balancesHandle.change((doc) => {
    doc.partyId = partyId;
  });

  const party = partyHandle.doc();
  if (!party) {
    throw new Error("Failed to create party");
  }

  return { partyId, party };
}
