import { t } from "@lingui/core/macro";
import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";

import { type Expense } from "#src/models/expense.js";
import { convertToUnits } from "#src/lib/expenses.js";
import { getLogger } from "#src/lib/log.ts";

import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import { ExpenseEditor, type ExpenseEditorFormValues } from "#src/components/ExpenseEditor.js";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";
import { useState } from "react";

interface AddExpenseSearchParams {
  media?: number;
}

const logger = getLogger("routes", "AddExpense");

export const Route = createFileRoute("/party_/$partyId/add")({
  component: AddExpense,
  pendingComponent: PartyPendingComponent,

  validateSearch: (search): AddExpenseSearchParams => {
    return {
      media: typeof search.media === "number" && search.media >= 0 ? search.media : undefined,
    };
  },

  async loader({ context, params, location }) {
    await guardParticipatingInParty(params.partyId, context, location);
  },
});

function AddExpense() {
  const { partyId, addExpenseToParty } = useCurrentParty();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const currentLocation = useLocation();
  const participant = useCurrentParticipant();

  const { galleryIndex, openGallery, closeGallery, onIndexChange } = useRouteMediaGallery({
    mediaIndex: search.media,
    currentLocation,
    buildLocation: (options) => router.buildLocation({ ...options, from: Route.fullPath }),
    navigate: (options) => void navigate(options),
    history: router.history,
  });

  // Track photos for gallery - updates when form changes
  const [photos, setPhotos] = useState<string[]>([]);
  const [paidAt] = useState(() => new Date());

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

      await navigate({
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
      logger.error("Failed to add expense", { error });
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
    <>
      <ExpenseEditor
        title={t`New expense`}
        onSubmit={onCreateExpense}
        onChange={(_prev, current) => setPhotos(current.photos)}
        defaultValues={{
          name: "",
          amount: 0,
          paidBy: participant.id,
          shares: {},
          paidAt,
          photos: [],
        }}
        goBackFallbackOptions={{ to: "/party/$partyId" }}
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
