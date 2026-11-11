import type { Expense, ExpenseParticipantPresence } from "#src/models/expense.ts";
import type { PartyParticipant } from "#src/models/party.ts";

type ExpensePresenceUpdatePayload = {
  type: "expense-presence-update";
  data: ExpenseParticipantPresence & {
    expenseId: Expense["id"];
  };
};

type ExpensePresenceDeletePayload = {
  type: "expense-presence-delete";
  data: {
    participantId: PartyParticipant["id"];
    expenseId: Expense["id"];
  };
};

export type ExpensePresenceMessage = ExpensePresenceUpdatePayload | ExpensePresenceDeletePayload;
