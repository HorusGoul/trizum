import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
} from "#src/components/ExpenseEditor.tsx";
import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import {
  applyExpenseDiff,
  decodeExpenseId,
  findExpenseById,
  getExpenseTotalAmount,
  type Expense,
} from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import { isValidDocumentId } from "@automerge/automerge-repo";
import {
  CalendarDate,
  getLocalTimeZone,
  toCalendarDate,
} from "@internationalized/date";
import { t } from "@lingui/macro";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import Dinero from "dinero.js";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/party_/$partyId/expense/$expenseId_/edit",
)({
  component: RouteComponent,

  async loader({ context, params: { expenseId, partyId } }) {
    await guardParticipatingInParty(partyId, context);

    const { chunkId } = decodeExpenseId(expenseId);
    await documentCache.readAsync(context.repo, chunkId);
  },
});

function RouteComponent() {
  const { expenseId, partyId, expense, isLoading, onUpdateExpense } =
    useExpense();
  const navigate = useNavigate();

  async function onSubmit(values: ExpenseEditorFormValues) {
    try {
      const paidAt = values.paidAt.toDate(getLocalTimeZone());

      // Create shares based on the form values
      const shares: Expense["shares"] = {};

      // Use the shares directly from the form
      Object.entries(values.shares).forEach(([participantId, share]) => {
        shares[participantId] = share;
      });

      toast.loading(t`Updating expense...`, {
        id: "update-expense",
      });

      onUpdateExpense({
        id: expenseId,
        name: values.name,
        paidAt,
        paidBy: { [values.paidBy]: convertToUnits(values.amount) },
        shares,
        photos: values.photos,
      });

      navigate({
        to: "/party/$partyId/expense/$expenseId",
        replace: true,
        params: {
          partyId,
          expenseId,
        },
      });

      toast.success(t`Expense updated`, {
        id: "update-expense",
      });
    } catch (error) {
      console.error("Failed to update expense", error);
      toast.error(t`Failed to update expense`, {
        id: "update-expense",
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

  if (expenseId === undefined) {
    return <span>Invalid Expense ID</span>;
  }

  if (isLoading) {
    return null;
  }

  if (!expense) {
    return "404 bruv";
  }

  return (
    <ExpenseEditor
      title={t`Editing ${expense.name}`}
      onSubmit={onSubmit}
      defaultValues={getFormValues(expense)}
    />
  );
}

function useExpense() {
  const { history } = useRouter();
  const { partyId, expenseId } = Route.useParams();

  if (!isValidDocumentId(partyId)) throw new Error("Malformed Party ID");

  const { chunkId } = decodeExpenseId(expenseId);

  const [chunk, handle] = useSuspenseDocument<PartyExpenseChunk>(chunkId, {
    required: true,
  });

  const [expense, expenseIndex] = findExpenseById(chunk.expenses, expenseId);

  function onUpdateExpense(expense: Expense) {
    if (expenseId === undefined) return;

    handle.change((chunk) => {
      const entry = chunk.expenses[expenseIndex];

      if (!entry) {
        return;
      }

      if (entry.id !== expense.id) {
        return;
      }

      applyExpenseDiff(entry, expense);
    });
  }

  return {
    partyId,
    expense,
    expenseId,
    isLoading: handle.inState(["loading"]),
    onUpdateExpense,
  };
}

function getFormValues(expense: Expense): ExpenseEditorFormValues {
  const initialAmount = getExpenseTotalAmount(expense) / 100;
  const initialPaidBy = Object.keys(expense.paidBy)[0];
  const initialPaidAt = new CalendarDate(
    expense.paidAt.getFullYear(),
    expense.paidAt.getMonth(),
    expense.paidAt.getDate(),
  );

  return {
    name: expense.name,
    amount: initialAmount,
    paidAt: initialPaidAt,
    paidBy: initialPaidBy,
    shares: expense.shares,
    photos: expense.photos,
  };
}
