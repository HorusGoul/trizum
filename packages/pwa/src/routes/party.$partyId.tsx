import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { BackButton } from "#src/components/BackButton.js";
import { t, Trans } from "@lingui/macro";
import {
  getExpenseTotalAmount,
  getImpactOnBalanceForUser,
  type Expense,
} from "#src/models/expense.js";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import { cn } from "#src/ui/utils.js";
import { toast } from "sonner";
import { usePartyExpenses } from "#src/hooks/usePartyExpenses.js";
import { useParty } from "#src/hooks/useParty.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { CurrencyText } from "#src/components/CurrencyText.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";

export const Route = createFileRoute("/party/$partyId")({
  component: PartyById,
  loader: async ({ context, params: { partyId } }) => {
    const { party } = await guardParticipatingInParty(partyId, context);

    await Promise.all(
      party.chunkIds.map((chunkId) => {
        return documentCache.readAsync(context.repo, chunkId);
      }),
    );

    return;
  },
});

function PartyById() {
  const params = Route.useParams();
  const { party, partyId, isLoading } = useParty(params.partyId);
  const { removeParty } = usePartyList();
  const expenses = usePartyExpenses(partyId);
  const navigate = useNavigate();
  const participant = useCurrentParticipant();

  function onDeleteParty() {
    if (!partyId) return;
    removeParty(partyId);
    navigate({ to: "/", replace: true });
    toast.success(t`Party deleted`);
  }

  if (partyId === undefined) {
    return <span>Invalid Party ID</span>;
  }

  if (isLoading) {
    return null;
  }

  if (party === undefined) {
    return <span>404 bruv</span>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton />
        <h1 className="pl-4 text-2xl font-bold">{party.name}</h1>
        <div className="flex-1" />
        <MenuTrigger>
          <IconButton icon="ellipsis-vertical" aria-label="Menu" />
          <Popover placement="bottom end">
            <Menu>
              <MenuItem
                href={{
                  to: "/party/$partyId/who",
                  params: { partyId },
                }}
              >
                <IconWithFallback
                  name="user-round-pen"
                  size={20}
                  className="mr-3 self-start"
                />
                <div className="flex flex-col">
                  <span className="h-3.5 leading-none">
                    <Trans>Viewing as {participant.name}</Trans>
                  </span>

                  <span className="mt-2 h-2.5 text-sm leading-none opacity-80">
                    <Trans>Tap to change</Trans>
                  </span>
                </div>
              </MenuItem>

              <MenuItem
                href={{
                  to: "/party/$partyId/settings",
                  params: { partyId },
                }}
              >
                <IconWithFallback name="settings" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">
                  <Trans>Settings</Trans>
                </span>
              </MenuItem>

              <MenuItem onAction={onDeleteParty}>
                <IconWithFallback name="trash" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">Delete</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>

      <div className="h-2" />

      <div className="container flex flex-1 flex-col gap-4 px-2">
        {expenses.map((expense) => (
          <ExpenseItem key={expense.id} partyId={partyId} expense={expense} />
        ))}

        <div className="flex-1" />

        <div className="sticky bottom-6 flex justify-end">
          <MenuTrigger>
            <IconButton
              aria-label={t`Add or create`}
              icon="plus"
              color="accent"
              className="h-14 w-14 shadow-md"
            />

            <Popover placement="top end" offset={16}>
              <Menu className="min-w-60">
                <MenuItem
                  href={{ to: "/party/$partyId/add", params: { partyId } }}
                >
                  <IconWithFallback
                    name="list-plus"
                    size={20}
                    className="mr-3"
                  />
                  <span className="h-3.5 leading-none">
                    <Trans>Add an expense</Trans>
                  </span>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </div>
    </div>
  );
}

function ExpenseItem({
  partyId,
  expense,
}: {
  partyId: string;
  expense: Expense;
}) {
  const { party } = useParty(partyId);

  const participant = useCurrentParticipant();

  return (
    <Link
      href={{
        to: "/party/$partyId/expense/$expenseId",
        params: {
          partyId,
          expenseId: expense.id,
        },
      }}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "flex w-full scale-100 rounded-xl bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:bg-slate-900",
          (isHovered || isFocusVisible) &&
            "shadow-md dark:bg-slate-800 dark:shadow-none",
          isPressed &&
            "scale-105 bg-opacity-90 shadow-lg dark:bg-slate-700 dark:shadow-none",
        )
      }
    >
      <div className="flex flex-1 flex-col">
        <span className="font-medium">{expense.name}</span>
        <span>{expense.description}</span>
      </div>

      <div className="flex flex-shrink-0 flex-col text-end">
        <CurrencyText
          amount={getExpenseTotalAmount(expense)}
          currency={party.currency}
          className="font-medium"
        />
        <span className="text-sm">{expense.paidAt.toLocaleDateString()}</span>
        <span className="text-sm">
          <Trans>
            Impact on my balance:&nbsp;
            <CurrencyText
              amount={getImpactOnBalanceForUser(expense, participant.id)}
              currency={party.currency}
              variant="diff"
            />
          </Trans>
        </span>
      </div>
    </Link>
  );
}
