import type { Party } from "#src/models/party.ts";
import type { Expense } from "#src/models/expense.ts";

export function getPartyParticipants(participants: Party["participants"]) {
  const all = Object.values(participants);

  return {
    all,
    active: all.filter((participant) => !participant.isArchived),
    archived: all.filter((participant) => participant.isArchived),
  };
}

export function getExpenseParticipants(
  participants: Party["participants"],
  expense: Pick<Expense, "paidBy" | "shares">,
) {
  const ids = new Set(getPartyParticipants(participants).active.map(({ id }) => id));

  for (const id in expense.paidBy) ids.add(id);

  for (const id in expense.shares) ids.add(id);

  return [...ids].map((id) => participants[id]);
}
