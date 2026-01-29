import { t } from "@lingui/core/macro";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";

import { type Expense } from "#src/models/expense.js";
import { convertToUnits } from "#src/lib/expenses.js";

import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import {
  ExpenseEditor,
  type ExpenseEditorFormValues,
} from "#src/components/ExpenseEditor.js";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";
import { useState } from "react";

interface AddExpenseSearchParams {
  media?: number;
  /** Pre-filled expense name from receipt scan */
  name?: string;
  /** Pre-filled amount from receipt scan */
  amount?: string;
  /** Pre-filled date from receipt scan (ISO string) */
  date?: string;
}

export const Route = createFileRoute("/party_/$partyId/add")({
  component: AddExpense,
  pendingComponent: PartyPendingComponent,

  validateSearch: (search): AddExpenseSearchParams => {
    return {
      media:
        typeof search.media === "number" && search.media >= 0
          ? search.media
          : undefined,
      name: typeof search.name === "string" ? search.name : undefined,
      amount: typeof search.amount === "string" ? search.amount : undefined,
      date: typeof search.date === "string" ? search.date : undefined,
    };
  },

  async loader({ context, params, location }) {
    await guardParticipatingInParty(params.partyId, context, location);
  },
});

function AddExpense() {
  const { partyId, addExpenseToParty } = useCurrentParty();
  const { partyList } = usePartyList();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { history } = useRouter();
  const participant = useCurrentParticipant();

  // AI features are enabled by default
  const enableAIFeatures = partyList.enableAIFeatures ?? true;

  const { galleryIndex, openGallery, closeGallery, onIndexChange } =
    useRouteMediaGallery({
      mediaIndex: search.media,
      navigate: (options) => void navigate(options),
      goBack: () => history.back(),
    });

  // Track photos for gallery - updates when form changes
  const [photos, setPhotos] = useState<string[]>([]);

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

      void navigate({
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
    <>
      <ExpenseEditor
        title={t`New expense`}
        onSubmit={(values) => void onCreateExpense(values)}
        onChange={(_prev, current) => setPhotos(current.photos)}
        defaultValues={{
          name: search.name ?? "",
          amount: search.amount ? parseFloat(search.amount) : 0,
          paidBy: participant.id,
          shares: {},
          paidAt: search.date ? new Date(search.date) : new Date(),
          photos: [],
        }}
        goBackFallbackOptions={{ to: "/party/$partyId" }}
        onViewPhoto={openGallery}
        onScanReceipt={
          enableAIFeatures
            ? () => {
                void navigate({
                  to: "/party/$partyId/scan-receipt",
                  params: { partyId },
                });
              }
            : undefined
        }
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
