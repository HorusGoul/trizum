import type { Expense } from "#src/models/expense.ts";
import { useCurrentParty } from "./useParty";
import { usePartyParticipants } from "./usePartyParticipants";
import { useMemo } from "react";

export function useExpenseParticipants(
  expense: Pick<Expense, "paidBy" | "shares">,
) {
  const { party } = useCurrentParty();
  const { active } = usePartyParticipants();

  return useMemo(() => {
    const participants = new Set<string>();

    for (const participant of active) {
      participants.add(participant.id);
    }

    for (const userId in expense.paidBy) {
      participants.add(userId);
    }

    for (const userId in expense.shares) {
      participants.add(userId);
    }

    return [...participants].map((userId) => party.participants[userId]);
  }, [expense.paidBy, expense.shares, party.participants, active]);
}
