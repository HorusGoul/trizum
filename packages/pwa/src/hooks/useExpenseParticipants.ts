import { PartyParticipantsView } from "#src/lib/data/views.ts";
import type { Expense } from "#src/models/expense.ts";
import { useCurrentParty } from "./useParty";
import { usePartyParticipants } from "./usePartyParticipants";

export function useExpenseParticipants(expense: Pick<Expense, "paidBy" | "shares">) {
  const { party } = useCurrentParty(PartyParticipantsView);
  const { active } = usePartyParticipants();

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
}
