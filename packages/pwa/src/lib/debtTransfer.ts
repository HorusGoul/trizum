import type { Expense } from "#src/models/expense.ts";
import type { PartyParticipant } from "#src/models/party.ts";

interface CreateDebtTransferExpensesOptions {
  amount: number;
  originDebtorId: string;
  originCreditorId: string;
  destinationDebtorId: string;
  destinationCreditorId: string;
  paidAt: Date;
  originExpenseName: string;
  destinationExpenseName: string;
}

interface GetDebtTransferParticipantMatchOptions {
  sourceName: string;
  participants: Array<Pick<PartyParticipant, "id" | "name">>;
  recommendationLimit?: number;
}

export interface DebtTransferParticipantMatch {
  exactMatchParticipantId: PartyParticipant["id"] | null;
  recommendedParticipantIds: PartyParticipant["id"][];
}

export function createDebtTransferExpenses({
  amount,
  originDebtorId,
  originCreditorId,
  destinationDebtorId,
  destinationCreditorId,
  paidAt,
  originExpenseName,
  destinationExpenseName,
}: CreateDebtTransferExpensesOptions): {
  originExpense: Omit<Expense, "id" | "__hash">;
  destinationExpense: Omit<Expense, "id" | "__hash">;
} {
  if (amount <= 0) {
    throw new Error("Debt transfer amount must be greater than 0");
  }

  return {
    originExpense: {
      name: originExpenseName,
      paidAt: new Date(paidAt),
      paidBy: {
        [originDebtorId]: amount,
      },
      shares: {
        [originCreditorId]: {
          type: "divide",
          value: 1,
        },
      },
      photos: [],
      isTransfer: true,
    },
    destinationExpense: {
      name: destinationExpenseName,
      paidAt: new Date(paidAt),
      paidBy: {
        [destinationCreditorId]: amount,
      },
      shares: {
        [destinationDebtorId]: {
          type: "divide",
          value: 1,
        },
      },
      photos: [],
      isTransfer: true,
    },
  };
}

export function getDebtTransferParticipantMatch({
  sourceName,
  participants,
  recommendationLimit = 3,
}: GetDebtTransferParticipantMatchOptions): DebtTransferParticipantMatch {
  const normalizedSourceName = normalizeParticipantName(sourceName);

  if (!normalizedSourceName) {
    return {
      exactMatchParticipantId: null,
      recommendedParticipantIds: [],
    };
  }

  const normalizedSourceTokens = tokenizeParticipantName(normalizedSourceName);
  const participantsWithMatchScore = participants.map((participant) => {
    const normalizedParticipantName = normalizeParticipantName(
      participant.name,
    );

    return {
      participant,
      normalizedParticipantName,
      matchScore: getParticipantMatchScore({
        normalizedSourceName,
        normalizedSourceTokens,
        normalizedParticipantName,
      }),
    };
  });

  const exactMatches = participantsWithMatchScore.filter(
    ({ normalizedParticipantName }) =>
      normalizedParticipantName === normalizedSourceName,
  );

  if (exactMatches.length === 1) {
    return {
      exactMatchParticipantId: exactMatches[0].participant.id,
      recommendedParticipantIds: [],
    };
  }

  return {
    exactMatchParticipantId: null,
    recommendedParticipantIds: participantsWithMatchScore
      .filter(({ matchScore }) => matchScore > 0)
      .sort((left, right) => {
        if (left.matchScore !== right.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return left.participant.name.localeCompare(right.participant.name);
      })
      .slice(0, recommendationLimit)
      .map(({ participant }) => participant.id),
  };
}

function getParticipantMatchScore({
  normalizedSourceName,
  normalizedSourceTokens,
  normalizedParticipantName,
}: {
  normalizedSourceName: string;
  normalizedSourceTokens: string[];
  normalizedParticipantName: string;
}) {
  if (!normalizedParticipantName) {
    return 0;
  }

  if (normalizedParticipantName === normalizedSourceName) {
    return 100;
  }

  const participantTokens = tokenizeParticipantName(normalizedParticipantName);
  const sharedTokens = normalizedSourceTokens.filter((token) =>
    participantTokens.includes(token),
  ).length;
  const hasContainedName =
    normalizedParticipantName.includes(normalizedSourceName) ||
    normalizedSourceName.includes(normalizedParticipantName);

  return sharedTokens * 10 + (hasContainedName ? 5 : 0);
}

function tokenizeParticipantName(name: string) {
  return name.split(" ").filter(Boolean);
}

function normalizeParticipantName(name: string) {
  return name
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’.-]+/g, " ")
    .replace(/\s+/g, " ");
}
