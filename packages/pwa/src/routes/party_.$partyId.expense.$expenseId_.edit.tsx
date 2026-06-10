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
import { useRef } from "react";
import { toast } from "sonner";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";
import { fateExpenseCache, useFateCache } from "#src/lib/data/fateAppData.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";

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
    await fateExpenseCache.readAsync(context.data.client, expenseId);
  },
});

const logger = getLogger("routes", "EditExpense");

function EditExpense() {
  const { expenseId, partyId, expense, onUpdateExpense } = useExpense();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { history } = useRouter();

  const photos = expense?.photos ?? [];

  const { galleryIndex, openGallery, closeGallery, onIndexChange } = useRouteMediaGallery({
    mediaIndex: search.media,
    navigate: (options) => void navigate(options),
    goBack: () => history.back(),
  });

  if (!expense) {
    throw new Error("Expense not found");
  }

  const editorRef = useRef<ExpenseEditorRef>(null);

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

      await onUpdateExpense({
        ...expense,
        __hash: calculateExpenseHash(expense),
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

  const formValues = getFormValues(expense);
  const expenseName = formValues.name;

  return (
    <>
      <RealtimeExpenseEditorPresence expenseId={expenseId} />
      <ExpenseEditor
        title={t`Editing ${expenseName}`}
        onSubmit={onSubmit}
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
  const { client } = useTrizumData();
  const { updateExpense } = useCurrentParty();
  const expense = useFateCache(fateExpenseCache, client, expenseId);

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
