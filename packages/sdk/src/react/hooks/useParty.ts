/**
 * SDK React hook for party management.
 *
 * Provides party document access and bound operations.
 */

import { useTrizumClient } from "../TrizumProvider.js";
import { useSuspenseDocument } from "../suspense-hooks.js";
import type { DocumentId } from "../../types.js";
import type { Party } from "../../models/party.js";
import type { Expense } from "../../models/expense.js";
import type {
  UpdatePartyInput,
  UpdateParticipantInput,
  CreateExpenseInput,
} from "../../operations/index.js";

/**
 * Result of useParty hook.
 */
export interface UsePartyResult {
  /** The party document */
  party: Party;
  /** The party ID */
  partyId: DocumentId;
  /** Whether the party is loading */
  isLoading: boolean;
  /** Update party settings */
  updateSettings: (input: UpdatePartyInput) => Promise<void>;
  /** Update a participant's details */
  setParticipantDetails: (
    participantId: string,
    details: UpdateParticipantInput,
  ) => Promise<void>;
  /** Add a new expense to the party */
  addExpense: (input: CreateExpenseInput) => Promise<Expense>;
  /** Update an existing expense */
  updateExpense: (expense: Expense) => Promise<void>;
  /** Remove an expense */
  removeExpense: (expenseId: string) => Promise<void>;
  /** Recalculate all balances */
  recalculateBalances: () => Promise<void>;
}

/**
 * Hook for managing a party.
 *
 * Provides access to the party document and operations for managing
 * the party, participants, and expenses.
 *
 * @example
 * ```tsx
 * function PartyView({ partyId }: { partyId: DocumentId }) {
 *   const {
 *     party,
 *     addExpense,
 *     updateSettings,
 *   } = useParty(partyId);
 *
 *   const handleAddExpense = async () => {
 *     await addExpense({
 *       name: "Dinner",
 *       paidAt: new Date(),
 *       paidBy: { "user1": 5000 },
 *       shares: { "user1": { type: "divide", value: 1 } },
 *       photos: [],
 *     });
 *   };
 *
 *   return <div>{party.name}</div>;
 * }
 * ```
 */
export function useParty(partyId: DocumentId): UsePartyResult {
  const client = useTrizumClient();
  const [party, handle] = useSuspenseDocument<Party>(partyId, { required: true });

  return {
    party,
    partyId,
    isLoading: handle?.inState(["loading"]) ?? false,

    updateSettings: (input) => client.party.update(partyId, input),

    setParticipantDetails: (participantId, details) =>
      client.party.updateParticipant(partyId, participantId, details),

    addExpense: (input) => client.party.expense.create(partyId, input),

    updateExpense: (expense) =>
      client.party.expense.update(partyId, expense.id, expense),

    removeExpense: (expenseId) => client.party.expense.delete(partyId, expenseId),

    recalculateBalances: () => client.party.recalculateBalances(partyId),
  };
}
