import {
  useParty as useSdkParty,
  isValidDocumentId,
  type DocumentId,
  type Party,
} from "@trizum/sdk";
import { useParams } from "@tanstack/react-router";

/**
 * PWA hook for party management.
 *
 * Wraps the SDK's useParty hook and adds dev helpers.
 */
export function useParty(partyId: string) {
  if (!isValidDocumentId(partyId)) throw new Error("Malformed Party ID");

  const sdkResult = useSdkParty(partyId as DocumentId);

  async function __dev_createTestExpenses() {
    const promptAnswer = window.prompt("How many test expenses to create?");

    if (!promptAnswer) {
      console.log("No prompt answer");
      return;
    }

    const amount = parseInt(promptAnswer ?? "0");

    console.log("Creating", amount, "test expenses");

    const participants = Object.keys(sdkResult.party.participants);

    for (let i = 0; i < amount; i++) {
      console.log("Creating test expense", i + 1);
      await sdkResult.addExpense({
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
    party: sdkResult.party,
    partyId: sdkResult.partyId,
    isLoading: sdkResult.isLoading,
    // Renamed methods for backward compatibility
    updateSettings: sdkResult.updateSettings,
    setParticipantDetails: sdkResult.setParticipantDetails,
    addExpenseToParty: sdkResult.addExpense,
    updateExpense: sdkResult.updateExpense,
    removeExpense: sdkResult.removeExpense,
    recalculateBalances: sdkResult.recalculateBalances,
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

/**
 * @deprecated Use SDK operations directly via client.party.* instead.
 * This function is kept for backward compatibility during migration.
 */
export function getPartyHelpers(
  _client: unknown,
  _handle: unknown,
): {
  updateSettings: (
    values: Pick<Party, "name" | "description" | "participants" | "hue">,
  ) => void;
  setParticipantDetails: (
    participantId: string,
    details: Record<string, unknown>,
  ) => void;
  addExpenseToParty: (expense: unknown) => Promise<unknown>;
  updateExpense: (expense: unknown) => Promise<void>;
  removeExpense: (expenseId: string) => Promise<boolean>;
  recalculateBalances: () => Promise<boolean>;
} {
  throw new Error(
    "getPartyHelpers is deprecated. Use useParty hook or client.party.* operations instead.",
  );
}
