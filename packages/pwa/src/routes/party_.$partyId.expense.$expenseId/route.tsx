import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { decodeExpenseId, findExpenseById, getExpenseTotalAmount } from "#src/models/expense.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { BackButton } from "#src/components/BackButton.js";
import { MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { Icon } from "#src/ui/Icon.js";
import { documentCache, useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import type { PartyExpenseChunk } from "#src/models/party.js";
import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";
import { closeRouteState } from "#src/lib/navigationHistory.ts";
import { markExpenseEditOpenedFromDetailState } from "#src/lib/expenseEditRouteState.ts";
import { Amount } from "./-components/Amount.js";
import { PaidAt } from "./-components/PaidAt.js";
import { PaidBy } from "./-components/PaidBy.js";
import { Photos } from "./-components/Photos.js";
import { Shares } from "./-components/Shares.js";

interface ExpenseSearchParams {
  media?: number;
}

export const Route = createFileRoute("/party_/$partyId/expense/$expenseId")({
  component: ExpenseById,
  pendingComponent: PartyPendingComponent,

  validateSearch: (search): ExpenseSearchParams => {
    const media = search.media;
    return {
      media: typeof media === "number" ? media : undefined,
    };
  },

  async loader({ context, params: { expenseId, partyId }, location }) {
    await guardParticipatingInParty(partyId, context, location);

    const { chunkId } = decodeExpenseId(expenseId);
    await documentCache.readAsync(context.repo, chunkId);
  },
});

function ExpenseById() {
  const { expenseId, partyId, expense, onDeleteExpense, isLoading } = useExpense();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const currentLocation = useLocation();

  const photos = expense?.photos ?? [];

  const { galleryIndex, openGallery, closeGallery, onIndexChange } = useRouteMediaGallery({
    mediaIndex: search.media,
    currentLocation,
    buildLocation: (options) => router.buildLocation({ ...options, from: Route.fullPath }),
    navigate: (options) => void navigate(options),
    history: router.history,
  });

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
    <>
      <div className="flex min-h-full flex-col">
        <div className="mt-safe container flex h-16 items-center px-2">
          <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
          <h1 className="max-h-12 truncate px-4 text-xl font-medium">{expense.name}</h1>
          <div className="flex-1" />
          <MenuTrigger>
            <IconButton icon="lucide.ellipsis-vertical" aria-label={t`Menu`} className="shrink-0" />
            <Popover placement="bottom end">
              <Menu>
                <MenuItem
                  href={{
                    to: "/party/$partyId/expense/$expenseId/edit",
                    params: {
                      expenseId,
                      partyId,
                    },
                    state: markExpenseEditOpenedFromDetailState,
                  }}
                >
                  <Icon icon="lucide.pencil" width={20} height={20} className="mr-3" />
                  <span className="h-3.5 leading-none">
                    <Trans>Edit</Trans>
                  </span>
                </MenuItem>
                <MenuItem menuAction={onDeleteExpense}>
                  <Icon icon="lucide.trash" width={20} height={20} className="mr-3" />
                  <span className="h-3.5 leading-none">
                    <Trans>Delete</Trans>
                  </span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>

        <div className="container flex flex-col gap-4 px-4 pt-4">
          <Amount amount={getExpenseTotalAmount(expense)} />
          <PaidBy {...expense} />
          <PaidAt {...expense} />
          <Photos photos={expense.photos} onOpenGallery={openGallery} />
          <Shares {...expense} />
        </div>

        <div className="h-16 shrink-0" />
      </div>

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
  const { history } = useRouter();
  const { partyId, expenseId } = Route.useParams();
  const currentLocation = useLocation();
  const navigate = useNavigate();

  if (!isValidDocumentId(partyId)) throw new Error(t`Malformed Party ID`);

  const { chunkId } = decodeExpenseId(expenseId);

  const [chunk, handle] = useSuspenseDocument<PartyExpenseChunk>(chunkId, {
    required: true,
  });
  const { removeExpense } = useCurrentParty();

  const [expense, _expenseIndex] = findExpenseById(chunk.expenses, expenseId);

  async function onDeleteExpense() {
    if (expenseId === undefined) return;

    await removeExpense(expenseId);

    closeRouteState(currentLocation, history, () => {
      void navigate({
        href: `/party/${partyId}`,
        replace: true,
      });
    });
    toast.success("Expense deleted");
  }

  return {
    partyId,
    onDeleteExpense,
    expense,
    expenseId,
    isLoading: handle.inState(["loading"]),
  };
}
