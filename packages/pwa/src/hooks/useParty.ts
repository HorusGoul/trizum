import { useParams } from "@tanstack/react-router";
import { createDebtTransferExpenses } from "#src/lib/debtTransfer.ts";
import {
  cacheParty,
  createExpenseInFate,
  deleteExpenseInFate,
  fatePartyCache,
  readParty,
  refreshParty,
  refreshPartyExpenses,
  upsertExpenseInFate,
  upsertParticipant,
  upsertParty,
  useFateCache,
} from "#src/lib/data/fateAppData.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import { getLogger } from "#src/lib/log.ts";
import type { Expense } from "#src/models/expense.js";
import type { Party, PartyParticipant } from "#src/models/party.js";

const logger = getLogger("hooks", "useParty");

export function useParty(partyId: string) {
  if (!partyId) {
    throw new Error("Malformed Party ID");
  }

  const { client, userId } = useTrizumData();
  const party = useFateCache(fatePartyCache, client, partyId);

  if (!party) {
    throw new Error("Party not found");
  }

  const currentParty = party;
  const helpers = getPartyHelpers({ client, party: currentParty, partyId, userId });

  async function __dev_createTestExpenses() {
    const promptAnswer = window.prompt("How many test expenses to create?");

    if (!promptAnswer) {
      logger.debug("No prompt answer");
      return;
    }

    const amount = parseInt(promptAnswer ?? "0");

    logger.debug("Creating test expenses", { amount });

    const participants = Object.keys(currentParty.participants);

    for (let i = 0; i < amount; i++) {
      logger.debug("Creating test expense {index}", { index: i + 1 });
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
    party: currentParty,
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

export function getPartyHelpers({
  client,
  party,
  partyId,
  userId,
}: {
  client: ReturnType<typeof useTrizumData>["client"];
  party: Party;
  partyId: string;
  userId: string;
}) {
  async function updateSettings(
    values: Pick<Party, "description" | "name" | "participants" | "symbol">,
  ) {
    const nextParty: Party = {
      ...party,
      description: values.description,
      name: values.name,
      participants: values.participants,
      symbol: values.symbol,
    };

    await upsertParty(client, userId, nextParty);
    await Promise.all(
      Object.values(nextParty.participants).map((participant) =>
        upsertParticipant(client, nextParty.id, participant),
      ),
    );

    cacheParty(client, nextParty);
    await refreshParty(client, nextParty.id);
  }

  async function setParticipantDetails(
    participantId: PartyParticipant["id"],
    details: Partial<
      Pick<PartyParticipant, "avatarId" | "balancesSortedBy" | "personalMode" | "phone">
    >,
  ) {
    const participant = party.participants[participantId];

    if (!participant) {
      return;
    }

    const nextParticipant: PartyParticipant = {
      ...participant,
      ...details,
    };
    const nextParty: Party = {
      ...party,
      participants: {
        ...party.participants,
        [participantId]: nextParticipant,
      },
    };

    await upsertParticipant(client, party.id, nextParticipant);
    cacheParty(client, nextParty);
  }

  async function addExpenseToParty(expense: Omit<Expense, "__hash" | "id">): Promise<Expense> {
    const created = await createExpenseInFate(client, partyId, expense);
    await refreshPartyExpenses(client, partyId);

    return created;
  }

  async function updateExpense(expense: Expense) {
    await upsertExpenseInFate(client, partyId, expense);
    await refreshPartyExpenses(client, partyId);
  }

  async function removeExpense(expenseId: Expense["id"]) {
    await deleteExpenseInFate(client, partyId, expenseId);
    await refreshPartyExpenses(client, partyId);

    return true;
  }

  async function transferDebtToParty({
    destinationPartyId,
    originDebtorId,
    originCreditorId,
    destinationDebtorId,
    destinationCreditorId,
    amount,
    paidAt,
    originExpenseName,
    destinationExpenseName,
  }: {
    amount: number;
    destinationCreditorId: PartyParticipant["id"];
    destinationDebtorId: PartyParticipant["id"];
    destinationPartyId: Party["id"];
    originCreditorId: PartyParticipant["id"];
    originDebtorId: PartyParticipant["id"];
    originExpenseName: string;
    paidAt: Date;
    destinationExpenseName: string;
  }) {
    const originParty = party;

    if (destinationPartyId === originParty.id) {
      throw new Error("Cannot transfer debt to the same party");
    }

    if (!originParty.participants[originDebtorId]) {
      throw new Error("Origin debtor not found");
    }

    if (!originParty.participants[originCreditorId]) {
      throw new Error("Origin creditor not found");
    }

    const destinationParty = await readParty(client, destinationPartyId);

    if (!destinationParty) {
      throw new Error("Destination party not found");
    }

    if (destinationParty.currency !== originParty.currency) {
      throw new Error("Cannot transfer debt between parties with different currencies");
    }

    if (!destinationParty.participants[destinationDebtorId]) {
      throw new Error("Destination debtor not found");
    }

    if (!destinationParty.participants[destinationCreditorId]) {
      throw new Error("Destination creditor not found");
    }

    const { originExpense, destinationExpense } = createDebtTransferExpenses({
      amount,
      originDebtorId,
      originCreditorId,
      destinationDebtorId,
      destinationCreditorId,
      paidAt,
      originExpenseName,
      destinationExpenseName,
    });
    const createdDestinationExpense = await createExpenseInFate(
      client,
      destinationPartyId,
      destinationExpense,
    );

    try {
      const createdOriginExpense = await createExpenseInFate(client, originParty.id, originExpense);
      await Promise.all([
        refreshPartyExpenses(client, originParty.id),
        refreshPartyExpenses(client, destinationPartyId),
      ]);

      return {
        originExpense: createdOriginExpense,
        destinationExpense: createdDestinationExpense,
      };
    } catch (error) {
      try {
        await deleteExpenseInFate(client, destinationPartyId, createdDestinationExpense.id);
      } catch (rollbackError) {
        logger.error("Failed to rollback destination debt transfer expense", {
          rollbackError,
          destinationExpenseId: createdDestinationExpense.id,
          destinationPartyId,
        });
      }

      throw error;
    }
  }

  async function recalculateBalances() {
    return true;
  }

  return {
    updateSettings,
    setParticipantDetails,
    addExpenseToParty,
    transferDebtToParty,
    updateExpense,
    removeExpense,
    recalculateBalances,
  };
}
