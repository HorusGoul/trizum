import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
  type ExpenseEditorRef,
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
  calculateExpenseHash,
  getExpenseTotalAmount,
  type Expense,
} from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import {
  isValidDocumentId,
  type DocHandleChangePayload,
} from "@automerge/automerge-repo";
import { t } from "@lingui/macro";
import { clone } from "@opentf/std";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
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
  const {
    expenseId,
    partyId,
    expense,
    isLoading,
    onUpdateExpense,
    onChangeExpense,
    subscribeToExpenseChanges,
  } = useExpense();
  const navigate = useNavigate();

  if (expenseId === undefined) {
    return <span>Invalid Expense ID</span>;
  }

  if (isLoading) {
    return null;
  }

  if (!expense) {
    return "404 bruv";
  }

  const editorRef = useRef<ExpenseEditorRef>(null);
  const currentHashRef = useRef<string>(getExpenseHash(expense));

  function onChange(values: ExpenseEditorFormValues) {
    const expense = {
      id: expenseId,
      name: values.name,
      paidAt: values.paidAt,
      paidBy: { [values.paidBy]: convertToUnits(values.amount) },
      shares: values.shares,
      photos: values.photos,
    };
    const hash = calculateExpenseHash(expense);

    if (hash === currentHashRef.current) {
      return;
    }

    currentHashRef.current = hash;

    onChangeExpense({
      ...expense,
      __hash: hash,
    });
  }

  async function onSubmit(values: ExpenseEditorFormValues) {
    try {
      // Create shares based on the form values
      const shares: Expense["shares"] = {};

      // Use the shares directly from the form
      Object.entries(values.shares).forEach(([participantId, share]) => {
        shares[participantId] = share;
      });

      toast.loading(t`Updating expense...`, {
        id: "update-expense",
      });

      const expense = {
        id: expenseId,
        name: values.name,
        paidAt: values.paidAt,
        paidBy: { [values.paidBy]: convertToUnits(values.amount) },
        shares,
        photos: values.photos,
      };

      onUpdateExpense({
        ...expense,
        __hash: calculateExpenseHash(expense),
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

  useEffect(() => {
    return subscribeToExpenseChanges((updatedExpense) => {
      const raw = clone(updatedExpense);

      const currentHash = getExpenseHash(raw);
      currentHashRef.current = currentHash;

      editorRef.current?.setValues(getFormValues(raw));
    });
  }, [onChange]);

  const formValues = getFormValues(expense);

  return (
    <ExpenseEditor
      title={t`Editing ${formValues.name}`}
      onSubmit={onSubmit}
      defaultValues={formValues}
      onChange={onChange}
      ref={editorRef}
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
      delete entry.__editCopy;
    });
  }

  function onChangeExpense(expense: Expense) {
    if (expenseId === undefined) return;

    handle.change((chunk) => {
      const entry = chunk.expenses[expenseIndex];

      if (!entry) {
        return;
      }

      if (entry.id !== expense.id) {
        return;
      }

      const copy = clone(expense);
      delete copy.__editCopy;

      if (!entry.__editCopy) {
        entry.__editCopy = copy;
        return;
      }

      applyExpenseDiff(entry.__editCopy, copy);
    });
  }

  function subscribeToExpenseChanges(callback: (expense: Expense) => void) {
    let prevHash = expense ? getExpenseHash(expense) : "";

    const handler = (payload: DocHandleChangePayload<PartyExpenseChunk>) => {
      const [expense] = findExpenseById(payload.doc.expenses, expenseId);

      if (!expense) {
        return;
      }

      const currentHash = getExpenseHash(expense);

      if (currentHash === prevHash) {
        return;
      }

      prevHash = currentHash;

      callback(expense);
    };

    handle.on("change", handler);

    return () => {
      handle.off("change", handler);
    };
  }

  return {
    partyId,
    expense,
    expenseId,
    isLoading: handle.inState(["loading"]),
    onChangeExpense,
    onUpdateExpense,
    subscribeToExpenseChanges,
  };
}

function getFormValues(expense: Expense): ExpenseEditorFormValues {
  if (expense.__editCopy) {
    return {
      name: expense.__editCopy.name,
      paidAt: expense.__editCopy.paidAt,
      shares: expense.__editCopy.shares,
      photos: expense.__editCopy.photos,
      amount: getExpenseTotalAmount(expense.__editCopy) / 100,
      paidBy: Object.keys(expense.__editCopy.paidBy)[0],
    };
  }

  return {
    name: expense.name,
    amount: getExpenseTotalAmount(expense) / 100,
    paidAt: expense.paidAt,
    paidBy: Object.keys(expense.paidBy)[0],
    shares: expense.shares,
    photos: expense.photos,
  };
}

function getExpenseHash(expense: Expense) {
  return expense.__editCopy?.__hash ?? expense.__hash;
}
