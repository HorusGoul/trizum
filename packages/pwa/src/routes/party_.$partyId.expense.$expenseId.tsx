import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  decodeExpenseId,
  findExpenseById,
  getExpenseTotalAmount,
  getExpenseUnitShares,
  type Expense,
} from "#src/models/expense.js";
import { isValidDocumentId } from "@trizum/sdk";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { BackButton } from "#src/components/BackButton.js";
import { MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { Icon, IconWithFallback } from "#src/ui/Icon.js";
import { useSuspenseDocument, cache } from "@trizum/sdk";
import type { PartyExpenseChunk } from "#src/models/party.js";
import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { useLingui } from "@lingui/react";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { Button } from "#src/ui/Button.tsx";
import { Fragment, Suspense } from "react";
import { Skeleton } from "#src/ui/Skeleton.tsx";
import { RouteMediaGallery } from "#src/components/RouteMediaGallery.tsx";
import { useRouteMediaGallery } from "#src/components/useRouteMediaGallery.ts";

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
    await cache.readAsync(context.client, chunkId);
  },
});

function ExpenseById() {
  const { expenseId, partyId, expense, onDeleteExpense, isLoading } =
    useExpense();
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
        <div className="container flex h-16 items-center px-2 mt-safe">
          <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
          <h1 className="max-h-12 truncate px-4 text-xl font-medium">
            {expense.name}
          </h1>
          <div className="flex-1" />
          <MenuTrigger>
            <IconButton
              icon="#lucide/ellipsis-vertical"
              aria-label={t`Menu`}
              className="flex-shrink-0"
            />
            <Popover placement="bottom end">
              <Menu>
                <MenuItem
                  href={{
                    to: "/party/$partyId/expense/$expenseId/edit",
                    params: {
                      expenseId,
                      partyId,
                    },
                  }}
                >
                  <IconWithFallback
                    name="#lucide/pencil"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Edit</Trans>
                  </span>
                </MenuItem>
                <MenuItem onAction={() => void onDeleteExpense()}>
                  <IconWithFallback
                    name="#lucide/trash"
                    size={20}
                    className="mr-3"
                  />
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

        <div className="h-16 flex-shrink-0" />
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

    history.back();
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

function Amount({ amount }: { amount: number }) {
  const { party } = useCurrentParty();

  return (
    <CurrencyText
      amount={amount}
      currency={party.currency}
      className="text-4xl font-bold"
    />
  );
}

function PaidBy({ paidBy }: Pick<Expense, "paidBy">) {
  const { party } = useCurrentParty();
  const currentParticipant = useCurrentParticipant();
  const hasMultiple = Object.keys(paidBy).length > 1;

  const paidByElements = Object.entries(paidBy).map(([userId, amount]) => {
    const participant = party.participants[userId];
    const isMe = participant.id === currentParticipant.id;
    const nameNode = (
      <div className="inline-flex items-center gap-1">
        {participant.name}

        {isMe ? (
          <span className="h-4 rounded-sm bg-accent-500 px-1 text-xs font-semibold uppercase text-accent-50">
            {t`Me`}
          </span>
        ) : null}
      </div>
    );

    if (hasMultiple) {
      return (
        <Fragment key={userId}>
          {nameNode}{" "}
          <span>
            (<CurrencyText amount={amount} currency={party.currency} />)
          </span>
        </Fragment>
      );
    }

    return <Fragment key={userId}>{nameNode}</Fragment>;
  });

  return (
    <dl className="flex">
      <dt className="flex items-center gap-2">
        <Icon
          name={hasMultiple ? "#lucide/users" : "#lucide/user"}
          aria-hidden="true"
        />

        <span className="font-medium">{t`Paid by`}</span>
      </dt>
      <dd className="font-semibold">
        &nbsp;
        {paidByElements}
      </dd>
    </dl>
  );
}

function PaidAt({ paidAt }: Pick<Expense, "paidAt">) {
  const { i18n } = useLingui();

  return (
    <dl className="flex items-center gap-2">
      <dt>
        <Icon name="#lucide/calendar" aria-label={t`Paid at`} />
      </dt>
      <dd className="font-medium">{paidAt.toLocaleDateString(i18n.locale)}</dd>
    </dl>
  );
}

interface PhotosProps extends Partial<Pick<Expense, "photos">> {
  onOpenGallery: (index: number) => void;
}

function Photos({ photos = [], onOpenGallery }: PhotosProps) {
  const hasMultiple = photos.length > 1;

  if (photos.length === 0) {
    return null;
  }

  return (
    <dl className="flex flex-col gap-4">
      <dt className="flex items-center gap-2">
        <Icon
          name={hasMultiple ? "#lucide/images" : "#lucide/image"}
          aria-hidden="true"
        />

        <span className="font-medium">{t`Attachments`}</span>
      </dt>

      <dd className="-mx-4 -my-4 flex gap-4 overflow-x-auto px-4 py-4">
        {photos.map((photoId, index) => (
          <Suspense key={photoId} fallback={<Skeleton className="h-32 w-32" />}>
            <PhotoItemById
              photoId={photoId}
              onPress={() => onOpenGallery(index)}
            />
          </Suspense>
        ))}
      </dd>
    </dl>
  );
}

interface PhotoItemByIdProps {
  photoId: string;
  onPress: () => void;
}

function PhotoItemById({ photoId, onPress }: PhotoItemByIdProps) {
  const { url } = useMediaFile(photoId);

  return (
    <Button
      color="transparent"
      aria-label={t`View photo`}
      className="h-auto w-auto p-0"
      onPress={onPress}
    >
      <img
        src={url}
        className="block h-32 w-32 rounded-xl object-cover"
        alt=""
        onContextMenu={(e) => e.preventDefault()}
      />
    </Button>
  );
}

function Shares(expense: Pick<Expense, "shares" | "paidBy">) {
  const { i18n } = useLingui();
  const unitAmounts = getExpenseUnitShares(expense);
  const { party } = useCurrentParty();
  const currentParticipant = useCurrentParticipant();

  return (
    <dl className="flex flex-col gap-4">
      <dt className="flex items-center gap-2">
        <Icon name="#lucide/split" aria-hidden="true" />
        <span className="font-medium">{t`Shares`}</span>
      </dt>

      <dd className="-mx-2 overflow-hidden rounded-lg">
        <ul>
          {Object.entries(unitAmounts)
            .sort(([a], [b]) =>
              party.participants[a].name.localeCompare(
                party.participants[b].name,
                i18n.locale,
              ),
            )
            .map(([userId, amount]) => {
              const isMe = userId === currentParticipant.id;

              return (
                <li
                  key={userId}
                  className="flex justify-between bg-accent-50 p-2 px-3 even:bg-accent-50/80 dark:bg-accent-900 dark:even:bg-accent-900/60"
                >
                  <span className="flex items-center gap-1 font-medium">
                    {party.participants[userId].name}

                    {isMe ? (
                      <span className="h-4 rounded-sm bg-accent-500 px-1 text-xs font-semibold uppercase text-accent-50">
                        {t`Me`}
                      </span>
                    ) : null}
                  </span>
                  <CurrencyText
                    amount={amount}
                    currency={party.currency}
                    className="font-semibold"
                  />
                </li>
              );
            })}
        </ul>
      </dd>
    </dl>
  );
}
