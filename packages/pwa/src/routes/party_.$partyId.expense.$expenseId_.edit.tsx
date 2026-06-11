import { t } from "@lingui/core/macro";
import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
  type ExpenseEditorRef,
} from "#src/components/ExpenseEditor.tsx";
import { RealtimeExpenseEditorPresence } from "#src/components/RealtimeExpenseEditorPresence.tsx";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import { getLogger } from "#src/lib/log.ts";
import { calculateExpenseHash, getExpenseTotalAmount, type Expense } from "#src/models/expense.ts";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";
import { readExpenseById, toExpense } from "#src/lib/data/fateAppData.ts";
import { useFateLiveView, useFateRequest } from "#src/lib/data/fateReact.ts";
import { ExpenseListItemView } from "@trizum/data";

interface EditExpenseSearchParams {
  media?: number;
}

export const Route = createFileRoute("/party_/$partyId/expense/$expenseId_/edit")({
  component: EditExpense,
  pendingComponent: PartyPendingComponent,

  validateSearch: (search): EditExpenseSearchParams => {
    return {
      media: typeof search.media === "number" && search.media >= 0 ? search.media : undefined,
    };
  },

  async loader({ location, context, params: { expenseId, partyId } }) {
    await guardParticipatingInParty(partyId, context, location);
    await readExpenseById(context.data.client, expenseId);
  },
});

const logger = getLogger("routes", "EditExpense");

function EditExpense() {
  const { expenseId, partyId, expense, onUpdateExpense } = useExpense();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { history } = useRouter();

  const { galleryIndex, openGallery, closeGallery, onIndexChange } = useRouteMediaGallery({
    mediaIndex: search.media,
    navigate: (options) => void navigate(options),
    goBack: () => history.back(),
  });

  if (!expense) {
    throw new Error("Expense not found");
  }

  const editorRef = useRef<ExpenseEditorRef>(null);
  const latestExpenseRef = useRef(expense);
  const draftUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editableExpense = getEditableExpense(expense);
  const photos = editableExpense.photos;

  latestExpenseRef.current = expense;

  function clearScheduledDraftUpdate() {
    if (draftUpdateTimerRef.current) {
      clearTimeout(draftUpdateTimerRef.current);
      draftUpdateTimerRef.current = null;
    }
  }

  function scheduleDraftUpdate(values: ExpenseEditorFormValues) {
    clearScheduledDraftUpdate();

    draftUpdateTimerRef.current = setTimeout(() => {
      const baseExpense = latestExpenseRef.current;
      const draft = getExpenseFromFormValues(expenseId, values, baseExpense);

      void onUpdateExpense({
        ...baseExpense,
        __editCopy: draft,
        __editCopyLastUpdatedAt: new Date(),
      }).catch((error: unknown) => {
        logger.error("Failed to update realtime expense draft", { error });
      });
    }, 250);
  }

  async function onSubmit(values: ExpenseEditorFormValues) {
    try {
      clearScheduledDraftUpdate();

      toast.loading(t`Updating expense...`, {
        id: "update-expense",
      });

      const expense = getExpenseFromFormValues(expenseId, values, latestExpenseRef.current);

      await onUpdateExpense({
        ...expense,
        __hash: calculateExpenseHash(expense),
        __editCopy: undefined,
        __editCopyLastUpdatedAt: undefined,
      });

      await navigate({
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
      logger.error("Failed to update expense", { error });
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

  const editCopyUpdatedAt = expense.__editCopyLastUpdatedAt?.getTime() ?? 0;
  const formValues = getFormValues(editableExpense);
  const expenseName = formValues.name;

  useEffect(() => {
    editorRef.current?.setValues(getFormValues(getEditableExpense(latestExpenseRef.current)));
  }, [expense.__hash, editCopyUpdatedAt]);

  useEffect(() => {
    return clearScheduledDraftUpdate;
  }, []);

  return (
    <>
      <RealtimeExpenseEditorPresence expenseId={expenseId} />
      <ExpenseEditor
        title={t`Editing ${expenseName}`}
        onSubmit={onSubmit}
        onChange={(_previousValues, currentValues) => scheduleDraftUpdate(currentValues)}
        defaultValues={formValues}
        ref={editorRef}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- We don't want to auto focus the edit form
        autoFocus={false}
        goBackFallbackOptions={{ to: "/party/$partyId/expense/$expenseId" }}
        onViewPhoto={openGallery}
      />
      <RouteMediaGallery
        photoIds={photos}
        galleryIndex={galleryIndex}
        onIndexChange={onIndexChange}
        onClose={closeGallery}
      />
    </>
  );
}

function useExpense() {
  const { partyId, expenseId } = Route.useParams();
  const { updateExpense } = useCurrentParty();
  const { expense: expenseRef } = useFateRequest({
    expense: {
      id: expenseId,
      view: ExpenseListItemView,
    },
  });
  const expenseEntity = useFateLiveView(ExpenseListItemView, expenseRef);
  const expense = toExpense(expenseEntity);

  function onUpdateExpense(expense: Expense) {
    return updateExpense(expense);
  }

  return {
    partyId,
    expense,
    expenseId,
    onUpdateExpense,
  };
}

function getFormValues(expense: Expense): ExpenseEditorFormValues {
  return {
    name: expense.name,
    amount: getExpenseTotalAmount(expense) / 100,
    paidAt: expense.paidAt,
    paidBy: Object.keys(expense.paidBy)[0],
    shares: expense.shares,
    photos: expense.photos,
  };
}

function getEditableExpense(expense: Expense): Expense {
  return expense.__editCopy ?? expense;
}

function getExpenseFromFormValues(
  expenseId: string,
  values: ExpenseEditorFormValues,
  baseExpense: Expense,
): Expense {
  const shares: Expense["shares"] = {};

  Object.entries(values.shares).forEach(([participantId, share]) => {
    shares[participantId] = share;
  });

  const expense: Expense = {
    __hash: "",
    id: expenseId,
    isTransfer: baseExpense.isTransfer,
    name: values.name,
    paidAt: values.paidAt,
    paidBy: { [values.paidBy]: convertToUnits(values.amount) },
    photos: values.photos,
    shares,
  };

  return {
    ...expense,
    __hash: calculateExpenseHash(expense),
  };
}
