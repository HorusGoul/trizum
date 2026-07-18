import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { decodeExpenseId, findExpenseById, getExpenseTotalAmount } from "#src/models/expense.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { BackButton } from "#src/components/BackButton.js";
import { Dialog, MenuTrigger, Modal, ModalOverlay, Popover } from "react-aria-components";
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
import { getLogger } from "#src/lib/log.ts";
import { Button } from "#src/ui/Button.tsx";
import { useActionProp } from "#src/ui/useActionProp.ts";
import { cn } from "#src/ui/utils.ts";
import { useState } from "react";
import { markExpenseEditOpenedFromDetailState } from "../party_.$partyId.expense.$expenseId_.edit/-expenseEditRouteState.ts";
import { Amount } from "./-components/Amount.js";
import { PaidAt } from "./-components/PaidAt.js";
import { PaidBy } from "./-components/PaidBy.js";
import { Photos } from "./-components/Photos.js";
import { Shares } from "./-components/Shares.js";

interface ExpenseSearchParams {
  media?: number;
}

const logger = getLogger("routes", "ExpenseDetail");

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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
                <MenuItem onAction={() => setIsDeleteDialogOpen(true)}>
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

      <ExpenseDeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onConfirmAction={onDeleteExpense}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </>
  );
}

function ExpenseDeleteConfirmationDialog({
  isOpen,
  onConfirmAction,
  onOpenChange,
}: {
  isOpen: boolean;
  onConfirmAction: () => Promise<void>;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const [isPending, confirmDelete] = useActionProp({ action: onConfirmAction });

  return (
    <ModalOverlay
      isDismissable={!isPending}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-accent-950/45 px-safe-or-4 py-safe-offset-6 backdrop-blur-md",
          isEntering && "duration-200 ease-out animate-in fade-in",
          isExiting && "duration-150 ease-in animate-out fade-out",
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          cn(
            "w-full max-w-[420px] outline-hidden",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`Delete expense`}
          className="border-accent-200 dark:border-accent-800 dark:bg-accent-950 rounded-lg border bg-white shadow-2xl outline-hidden"
        >
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3">
              <span className="bg-danger-50 text-danger-500 dark:bg-danger-950/50 dark:text-danger-300 flex size-10 items-center justify-center rounded-full">
                <Icon icon="lucide.trash-2" width={20} height={20} />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-medium">
                  <Trans>Delete expense?</Trans>
                </h2>
                <p className="text-accent-700 dark:text-accent-50 text-sm">
                  <Trans>
                    This expense will be permanently deleted. This action cannot be undone.
                  </Trans>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                className="bg-danger-500 text-danger-50 dark:bg-danger-500 font-semibold"
                color="accent"
                isPending={isPending}
                onPress={() => confirmDelete?.()}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <Icon icon="lucide.trash-2" width={18} height={18} />
                  <Trans>Delete expense</Trans>
                </span>
              </Button>
              <Button
                // eslint-disable-next-line jsx-a11y/no-autofocus -- Focus the safe action when this destructive dialog opens
                autoFocus
                color="input-like"
                isDisabled={isPending}
                onPress={() => onOpenChange(false)}
                type="button"
              >
                <Trans>Cancel</Trans>
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
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

    try {
      await removeExpense(expenseId);
    } catch (error) {
      logger.error("Failed to delete expense", { error });
      toast.error(t`Failed to delete expense. Please try again.`);
      return;
    }

    closeRouteState(currentLocation, history, () => {
      void navigate({
        href: `/party/${partyId}`,
        replace: true,
      });
    });
    toast.success(t`Expense deleted`);
  }

  return {
    partyId,
    onDeleteExpense,
    expense,
    expenseId,
    isLoading: handle.inState(["loading"]),
  };
}
