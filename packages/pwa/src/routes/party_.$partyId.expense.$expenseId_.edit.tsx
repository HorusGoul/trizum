import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
  type ExpenseEditorRef,
} from "#src/components/ExpenseEditor.tsx";
import { RealtimeExpenseEditorPresence } from "#src/components/RealtimeExpenseEditorPresence.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import { patchMutate } from "#src/lib/patchMutate.ts";
import {
  applyExpenseDiff,
  decodeExpenseId,
  findExpenseById,
  calculateExpenseHash,
  getExpenseTotalAmount,
  type Expense,
  type ExpenseParticipantPresence,
} from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import { type DocHandleChangePayload } from "@automerge/automerge-repo";
import { t } from "@lingui/macro";
import { diff, type DiffResult } from "@opentf/obj-diff";
import { clone } from "@opentf/std";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/party_/$partyId/expense/$expenseId_/edit",
)({
  component: RouteComponent,

  async loader({ location, context, params: { expenseId, partyId } }) {
    await guardParticipatingInParty(partyId, context, location);

    const { chunkId } = decodeExpenseId(expenseId);
    await documentCache.readAsync(context.repo, chunkId);
  },
});

const TIME_TO_DISCARD_EDIT_COPY = 1000 * 60 * 5; // 5 minutes

function RouteComponent() {
  const {
    expenseId,
    partyId,
    expense,
    isLoading,
    onUpdateExpense,
    onChangeExpense,
    subscribeToExpenseChanges,
    onPresenceUpdate,
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

  function onChange(
    previousValues: ExpenseEditorFormValues,
    currentValues: ExpenseEditorFormValues,
  ) {
    function createExpense(values: ExpenseEditorFormValues) {
      return {
        id: expenseId,
        name: values.name,
        paidAt: values.paidAt,
        paidBy: { [values.paidBy]: convertToUnits(values.amount) },
        shares: values.shares,
        photos: values.photos,
      };
    }

    const expense = createExpense(currentValues);
    const hash = calculateExpenseHash(expense);

    if (hash === currentHashRef.current) {
      return;
    }

    currentHashRef.current = hash;

    const patches = diff(createExpense(previousValues), expense);
    onChangeExpense(patches);
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
    <>
      <RealtimeExpenseEditorPresence
        presence={expense.__presence}
        onPresenceUpdate={onPresenceUpdate}
      />
      <ExpenseEditor
        title={t`Editing ${formValues.name}`}
        onSubmit={onSubmit}
        defaultValues={formValues}
        onChange={onChange}
        ref={editorRef}
        autoFocus={false}
        goBackFallbackOptions={{ to: "/party/$partyId/expense/$expenseId" }}
      />
    </>
  );
}

function useExpense() {
  const { partyId, expenseId } = Route.useParams();
  const participant = useCurrentParticipant();

  const { updateExpense } = useCurrentParty();

  const { chunkId } = decodeExpenseId(expenseId);

  const [chunk, handle] = useSuspenseDocument<PartyExpenseChunk>(chunkId, {
    required: true,
  });

  const [expense, expenseIndex] = findExpenseById(chunk.expenses, expenseId);

  function onUpdateExpense(expense: Expense) {
    updateExpense(expense);
  }

  function onChangeExpense(patches: DiffResult[]) {
    handle.change((chunk) => {
      const entry = chunk.expenses.find((e) => e.id === expenseId);

      if (!entry) {
        return;
      }

      if (!entry.__editCopy) {
        entry.__editCopy = clone(entry);
      }

      patchMutate(entry.__editCopy, patches);
      entry.__editCopy.__hash = calculateExpenseHash(entry.__editCopy);
      entry.__editCopyLastUpdatedAt = new Date();
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

  function onPresenceUpdate(
    value: Pick<ExpenseParticipantPresence, "elementId"> | null,
  ) {
    handle.change((chunk) => {
      const entry = chunk.expenses[expenseIndex];

      if (!entry) {
        return;
      }

      if (entry.id !== expenseId) {
        return;
      }

      if (!entry.__presence) {
        entry.__presence = {};
      }

      if (value) {
        entry.__presence[participant.id] = {
          participantId: participant.id,
          dateTime: new Date(),
          elementId: value.elementId,
        };
      } else {
        if (entry.__presence[participant.id]) {
          delete entry.__presence[participant.id];
        }
      }
    });
  }

  return {
    partyId,
    expense,
    expenseId,
    isLoading: handle.inState(["loading"]),
    onChangeExpense,
    onUpdateExpense,
    subscribeToExpenseChanges,
    onPresenceUpdate,
  };
}

function getFormValues(expense: Expense): ExpenseEditorFormValues {
  if (shouldUseEditCopy(expense)) {
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
  if (shouldUseEditCopy(expense)) {
    return expense.__editCopy.__hash;
  }

  return expense.__hash;
}

function shouldUseEditCopy(
  expense: Expense,
): expense is Expense & { __editCopy: Expense } {
  if (!expense.__editCopy) {
    return false;
  }

  if (!expense.__editCopyLastUpdatedAt) {
    return false;
  }

  return (
    expense.__editCopyLastUpdatedAt.getTime() + TIME_TO_DISCARD_EDIT_COPY >
    Date.now()
  );
}
