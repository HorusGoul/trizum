import { t } from "@lingui/core/macro";
import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
  type ExpenseEditorRef,
} from "#src/components/ExpenseEditor.tsx";
import { RealtimeExpenseEditorPresence } from "#src/components/RealtimeExpenseEditorPresence.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { useSuspenseDocument, cache } from "@trizum/sdk";
import { convertToUnits } from "#src/lib/expenses.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import { patchMutate } from "#src/lib/patchMutate.ts";
import {
  decodeExpenseId,
  findExpenseById,
  calculateExpenseHash,
  getExpenseTotalAmount,
  type Expense,
} from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import { type DocumentChangePayload } from "@trizum/sdk";
import { diff, type DiffResult } from "@opentf/obj-diff";
import { clone } from "@opentf/std";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";

interface EditExpenseSearchParams {
  media?: number;
}

export const Route = createFileRoute(
  "/party_/$partyId/expense/$expenseId_/edit",
)({
  component: RouteComponent,
  pendingComponent: PartyPendingComponent,

  validateSearch: (search): EditExpenseSearchParams => {
    return {
      media:
        typeof search.media === "number" && search.media >= 0
          ? search.media
          : undefined,
    };
  },

  async loader({ location, context, params: { expenseId, partyId } }) {
    await guardParticipatingInParty(partyId, context, location);

    const { chunkId } = decodeExpenseId(expenseId);
    await cache.readAsync(context.client, chunkId);
  },
});

const TIME_TO_DISCARD_EDIT_COPY = 1000 * 60 * 5; // 5 minutes

function RouteComponent() {
  const {
    expenseId,
    partyId,
    expense,
    onUpdateExpense,
    onChangeExpense,
    subscribeToExpenseChanges,
  } = useExpense();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { history } = useRouter();

  const photos = expense?.photos ?? [];

  const { galleryIndex, openGallery, closeGallery, onIndexChange } =
    useRouteMediaGallery({
      mediaIndex: search.media,
      navigate: (options) => void navigate(options),
      goBack: () => history.back(),
    });

  if (!expense) {
    throw new Error("Expense not found");
  }

  const editorRef = useRef<ExpenseEditorRef>(null);
  const currentHashRef = useRef<string>(getExpenseHash(expense));

  const onChange = useCallback(
    (
      previousValues: ExpenseEditorFormValues,
      currentValues: ExpenseEditorFormValues,
    ) => {
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
    },
    [onChangeExpense, expenseId],
  );

  function onSubmit(values: ExpenseEditorFormValues) {
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

      void navigate({
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
  }, [onChange, subscribeToExpenseChanges]);

  const formValues = getFormValues(expense);
  const expenseName = formValues.name;

  return (
    <>
      <RealtimeExpenseEditorPresence expenseId={expenseId} />
      <ExpenseEditor
        title={t`Editing ${expenseName}`}
        onSubmit={onSubmit}
        defaultValues={formValues}
        onChange={onChange}
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
  useCurrentParticipant();

  const { updateExpense } = useCurrentParty();

  const { chunkId } = decodeExpenseId(expenseId);

  const [chunk, handle] = useSuspenseDocument<PartyExpenseChunk>(chunkId, {
    required: true,
  });

  const [expense] = findExpenseById(chunk.expenses, expenseId);

  function onUpdateExpense(expense: Expense) {
    void updateExpense(expense);
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

    const handler = (payload?: unknown) => {
      const typedPayload = payload as DocumentChangePayload<PartyExpenseChunk>;
      const [expense] = findExpenseById(typedPayload.doc.expenses, expenseId);

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
