import { t } from "@lingui/core/macro";
import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
  type ExpenseEditorRef,
} from "#src/components/ExpenseEditor.tsx";
import { RealtimeExpenseEditorPresence } from "#src/components/RealtimeExpenseEditorPresence.tsx";
import { usePartyExpense } from "#src/hooks/usePartyExpense.ts";
import { upsertExpenseInFate } from "#src/lib/data/fateAppData.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import { getLogger } from "#src/lib/log.ts";
import { calculateExpenseHash, getExpenseTotalAmount, type Expense } from "#src/models/expense.ts";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";
import { guardExpenseExists, guardParticipatingInParty } from "#src/lib/guards.ts";

interface EditExpenseSearchParams {
  media?: number;
}

export const Route = createFileRoute("/party_/$partyId/expense/$expenseId_/edit")({
  component: EditExpense,
  pendingComponent: PartyPendingComponent,
  loader: async ({ context, params: { expenseId, partyId }, location }) => {
    const { party } = await guardParticipatingInParty(partyId, context, location);
    await guardExpenseExists(expenseId, context);

    return { party };
  },

  validateSearch: (search): EditExpenseSearchParams => {
    return {
      media: typeof search.media === "number" && search.media >= 0 ? search.media : undefined,
    };
  },
});

const logger = getLogger("routes", "EditExpense");

function EditExpense() {
  const { expenseId, partyId, expense, isLoading, onUpdateExpense } = useExpense();
  const { party } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { history } = useRouter();
  const editorRef = useRef<ExpenseEditorRef>(null);
  const latestExpenseRef = useRef<Expense | null>(expense);
  const draftUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { galleryIndex, openGallery, closeGallery, onIndexChange } = useRouteMediaGallery({
    mediaIndex: search.media,
    navigate: (options) => void navigate(options),
    goBack: () => history.back(),
  });

  if (expense) {
    latestExpenseRef.current = expense;
  }

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

      if (!baseExpense) {
        return;
      }

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

      const latestExpense = latestExpenseRef.current;

      if (!latestExpense) {
        throw new Error("Expense not found");
      }

      const expense = getExpenseFromFormValues(expenseId, values, latestExpense);

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

  const editableExpense = expense ? getEditableExpense(expense) : null;
  const photos = editableExpense?.photos ?? [];
  const editCopyUpdatedAt = expense?.__editCopyLastUpdatedAt?.getTime() ?? 0;
  const formValues = editableExpense ? getFormValues(editableExpense) : null;
  const expenseName = formValues?.name ?? "";

  useEffect(() => {
    const latestExpense = latestExpenseRef.current;

    if (!latestExpense) {
      return;
    }

    editorRef.current?.setValues(getFormValues(getEditableExpense(latestExpense)));
  }, [expense?.__hash, editCopyUpdatedAt]);

  useEffect(() => {
    return clearScheduledDraftUpdate;
  }, []);

  if (isLoading) {
    return null;
  }

  if (!expense || !formValues) {
    throw new Error("Expense not found");
  }

  return (
    <>
      <RealtimeExpenseEditorPresence expenseId={expenseId} />
      <ExpenseEditor
        title={t`Editing ${expenseName}`}
        onSubmit={onSubmit}
        onChange={(_previousValues, currentValues) => scheduleDraftUpdate(currentValues)}
        defaultValues={formValues}
        party={party}
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
  const { client } = useTrizumData();
  const { expense, isLoading } = usePartyExpense(partyId, expenseId);

  function onUpdateExpense(expense: Expense) {
    return upsertExpenseInFate(client, partyId, expense);
  }

  return {
    partyId,
    expense,
    expenseId,
    isLoading,
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
