import { t } from "@lingui/core/macro";
import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
  type ExpenseEditorRef,
} from "#src/components/ExpenseEditor.tsx";
import { RealtimeExpenseEditorPresence } from "#src/components/RealtimeExpenseEditorPresence.tsx";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { documentCache, useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import { getLogger } from "#src/lib/log.ts";
import { patchMutate } from "#src/lib/patchMutate.ts";
import {
  decodeExpenseId,
  findExpenseById,
  calculateExpenseHash,
  type Expense,
} from "#src/models/expense.ts";
import type { PartyExpenseChunk } from "#src/models/party.ts";
import { type DocHandleChangePayload } from "@automerge/automerge-repo";
import { diff, type DiffResult } from "@opentf/obj-diff";
import { clone } from "@opentf/std";
import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteCalculator } from "#src/components/useRouteCalculator.ts";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";
import {
  getExpenseEditHash,
  getExpenseEditValues,
  getOrCreateExpenseEditCopy,
} from "./-expenseEditValues.ts";
import { hasExpenseEditOpenedFromDetailState } from "./-expenseEditRouteState.ts";

interface EditExpenseSearchParams {
  calculator?: string;
  media?: number;
}

export const Route = createFileRoute("/party_/$partyId/expense/$expenseId_/edit")({
  component: EditExpense,
  pendingComponent: PartyPendingComponent,

  validateSearch: (search): EditExpenseSearchParams => {
    return {
      calculator:
        typeof search.calculator === "string" && search.calculator.length > 0
          ? search.calculator
          : undefined,
      media: typeof search.media === "number" && search.media >= 0 ? search.media : undefined,
    };
  },

  async loader({ location, context, params: { expenseId, partyId } }) {
    await guardParticipatingInParty(partyId, context, location);

    const { chunkId } = decodeExpenseId(expenseId);
    await documentCache.readAsync(context.repo, chunkId);
  },
});

const logger = getLogger("routes", "EditExpense");

function EditExpense() {
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
  const router = useRouter();
  const currentLocation = useLocation();

  function mergeSearchOptions<TOptions extends { search: Partial<EditExpenseSearchParams> }>(
    options: TOptions,
  ) {
    return {
      ...options,
      search: {
        ...search,
        ...options.search,
      },
    };
  }

  const { galleryIndex, openGallery, closeGallery, onIndexChange } = useRouteMediaGallery({
    mediaIndex: search.media,
    currentLocation,
    buildLocation: (options) =>
      router.buildLocation({ ...mergeSearchOptions(options), from: Route.fullPath }),
    navigate: (options) => void navigate(mergeSearchOptions(options)),
    history: router.history,
  });
  const { activeCalculatorId, openCalculator, closeCalculator } = useRouteCalculator({
    calculatorId: search.calculator,
    currentLocation,
    buildLocation: (options) =>
      router.buildLocation({ ...mergeSearchOptions(options), from: Route.fullPath }),
    navigate: (options) => void navigate(mergeSearchOptions(options)),
    history: router.history,
  });

  if (!expense) {
    throw new Error("Expense not found");
  }

  const formValues = getExpenseEditValues(expense);
  const photos = formValues.photos;

  const editorRef = useRef<ExpenseEditorRef>(null);
  const currentHashRef = useRef<string | null>(null);
  if (currentHashRef.current === null) {
    currentHashRef.current = getExpenseEditHash(expense);
  }

  const onChange = (
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
  };

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

      if (hasExpenseEditOpenedFromDetailState(currentLocation.state)) {
        router.history.go(-1);
      } else {
        await navigate({
          to: "/party/$partyId/expense/$expenseId",
          replace: true,
          params: {
            partyId,
            expenseId,
          },
        });
      }

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

  useEffect(() => {
    return subscribeToExpenseChanges((updatedExpense) => {
      const raw = clone(updatedExpense);

      const currentHash = getExpenseEditHash(raw);
      currentHashRef.current = currentHash;

      editorRef.current?.setValues(getExpenseEditValues(raw));
    });
  }, [subscribeToExpenseChanges]);

  const expenseName = formValues.name;

  return (
    <>
      <RealtimeExpenseEditorPresence expenseId={expenseId} />
      <ExpenseEditor
        mode="edit"
        title={t({ message: `Editing ${expenseName}` })}
        onSubmit={onSubmit}
        defaultValues={formValues}
        onChange={onChange}
        ref={editorRef}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- We don't want to auto focus the edit form
        autoFocus={false}
        goBackFallbackOptions={{ to: "/party/$partyId/expense/$expenseId" }}
        activeCalculatorId={activeCalculatorId}
        onCloseCalculator={closeCalculator}
        onOpenCalculator={openCalculator}
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

  const { chunkId } = decodeExpenseId(expenseId);

  const [chunk, handle] = useSuspenseDocument<PartyExpenseChunk>(chunkId, {
    required: true,
  });

  const [expense] = findExpenseById(chunk.expenses, expenseId);

  function onUpdateExpense(expense: Expense) {
    return updateExpense(expense);
  }

  function onChangeExpense(patches: DiffResult[]) {
    handle.change((chunk) => {
      const entry = chunk.expenses.find((e) => e.id === expenseId);

      if (!entry) {
        return;
      }

      const editCopy = getOrCreateExpenseEditCopy(entry);
      patchMutate(editCopy, patches);
      editCopy.__hash = calculateExpenseHash(editCopy);
      entry.__editCopyLastUpdatedAt = new Date();
    });
  }

  function subscribeToExpenseChanges(callback: (expense: Expense) => void) {
    let prevHash = expense ? getExpenseEditHash(expense) : "";

    const handler = (payload: DocHandleChangePayload<PartyExpenseChunk>) => {
      const [expense] = findExpenseById(payload.doc.expenses, expenseId);

      if (!expense) {
        return;
      }

      const currentHash = getExpenseEditHash(expense);

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
