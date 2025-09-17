import { t } from "@lingui/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { type Expense } from "#src/models/expense.js";
import { convertToUnits } from "#src/lib/expenses.js";

import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
} from "#src/components/ExpenseEditor.js";

import { getLocalTimeZone, now } from "@internationalized/date";
import { useMediaFileActions } from "#src/hooks/useMediaFileActions.ts";

export const Route = createFileRoute("/party_/$partyId/add")({
  component: AddExpense,

  async loader({ context, params, location }) {
    await guardParticipatingInParty(params.partyId, context, location);
  },
});

function AddExpense() {
  const { party, partyId, addExpenseToParty } = useCurrentParty();
  const { createMediaFile } = useMediaFileActions();
  const navigate = useNavigate();
  const participant = useCurrentParticipant();

  async function onCreateExpense(values: ExpenseEditorFormValues) {
    try {
      // Create shares based on the form values
      const shares: Expense["shares"] = {};

      // Use the shares directly from the form
      Object.entries(values.shares).forEach(([participantId, share]) => {
        shares[participantId] = share;
      });

      toast.loading(t`Adding expense...`, {
        id: "add-expense",
      });

      const expense = await addExpenseToParty({
        name: values.name,
        paidAt: values.paidAt,
        paidBy: { [values.paidBy]: convertToUnits(values.amount) },
        shares,
        photos: values.photos,
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
        amount: 0,
        paidBy: participant.id,
        shares: {},
        paidAt: new Date(),
        photos: [],
      }}
      goBackFallbackOptions={{ to: "/party/$partyId" }}
    />
  );
}
