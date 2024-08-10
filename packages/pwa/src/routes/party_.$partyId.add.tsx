import { t } from "@lingui/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { type Expense } from "#src/models/expense.js";
import { convertToUnits, type ExpenseUser } from "#src/lib/expenses.js";

import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
} from "#src/components/ExpenseEditor.js";

export const Route = createFileRoute("/party/$partyId/add")({
  component: AddExpense,

  async loader({ context, params }) {
    await guardParticipatingInParty(params.partyId, context);
  },
});

function AddExpense() {
  const { party, partyId, addExpenseToParty } = useCurrentParty();
  const navigate = useNavigate();
  const participant = useCurrentParticipant();

  async function onCreateExpense(values: ExpenseEditorFormValues) {
    try {
      const paidAt = new Date();
      // TODO: handle more expense share types
      const shares: Expense["shares"] = Object.keys(party.participants).reduce(
        (acc, key) => {
          acc[key as ExpenseUser] = { type: "divide", value: 1 };
          return acc;
        },
        {} as Expense["shares"],
      );

      toast.loading(t`Adding expense...`, {
        id: "add-expense",
      });

      const expense = await addExpenseToParty({
        name: values.name,
        description: values.description,
        paidAt,
        paidBy: { [values.paidBy]: convertToUnits(values.amount) },
        shares,
      });

      navigate({
        to: "/party/$partyId/expense/$expenseId",
        replace: true,
        params: {
          partyId,
          expenseId: expense.id,
        },
      });

      toast.success(t`Expense added`, {
        id: "add-expense",
      });
    } catch (error) {
      console.error("Failed to add expense", error);
      toast.error(t`Failed to add expense`, {
        id: "add-expense",
        description:
          typeof error === "object" &&
          error &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : undefined,
      });
    }
  }

  return (
    <ExpenseEditor
      title={t`New expense`}
      onSubmit={onCreateExpense}
      defaultValues={{
        name: "",
        description: "",
        amount: 0,
        paidBy: participant.id,
      }}
    />
  );
}
