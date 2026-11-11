import { useDataRecord } from "#src/lib/data/hooks.ts";
import { useAppData } from "#src/lib/data/useAppData.ts";
import { useParams } from "@tanstack/react-router";
import type { Party } from "#src/models/party.ts";

export function useParty(partyId: string) {
  const [party] = useDataRecord<Party>(partyId, {
    required: true,
  });

  const data = useAppData();
  const helpers = data.readyPartyActions(party.id);

  async function __dev_createTestExpenses() {
    const promptAnswer = window.prompt("How many test expenses to create?");

    if (!promptAnswer) {
      return;
    }

    const amount = parseInt(promptAnswer ?? "0");

    const participants = Object.keys(party.participants);

    await Promise.all(
      Array.from({ length: amount }, (_, index) => {
        const expenseNumber = index + 1;

        return helpers.addExpenseToParty({
          name: `Test Expense ${expenseNumber}`,
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
      }),
    );
  }

  return {
    party,
    partyId,
    isLoading: false,
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
