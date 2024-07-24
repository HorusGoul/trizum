import {
  isValidDocumentId,
  updateText,
  type AnyDocumentId,
} from "@automerge/automerge-repo/slim";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Party } from "#src/models/party.js";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { usePartyList } from "#src/hooks/usePartyList.js";
import { useEffect } from "react";
import { BackButton } from "#src/components/BackButton.js";
import { t, Trans } from "@lingui/macro";
import type { Expense } from "#src/models/expense.js";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import { cn } from "#src/ui/utils.js";

export const Route = createFileRoute("/party/$partyId")({
  component: PartyById,
});

function PartyById() {
  const { party, partyId, isLoading } = useParty();
  const { addPartyToList, removeParty } = usePartyList();
  const expenseIds =
    party?.expenses
      ?.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
      ?.map((e) => e.expenseId) ?? [];
  const navigate = useNavigate();

  useEffect(() => {
    if (!partyId) return;
    addPartyToList(partyId);
  }, [addPartyToList, partyId]);

  function onDeleteParty() {
    if (!partyId) return;
    removeParty(partyId);
    navigate({ to: "/", replace: true });
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
        {expenseIds.map((expenseId) => (
          <ExpenseItem
            key={expenseId}
            partyId={partyId}
            expenseId={expenseId}
          />
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

function useParty() {
  const { partyId } = Route.useParams();
  if (!isValidDocumentId(partyId)) throw new Error("Malformed Party ID");
  const [party, handle] = useSuspenseDocument<Party>(partyId);
  function dispatch({ type, payload }: ChangePartyAction) {
    switch (type) {
      case "party_change_name":
        return handle.change((party) => {
          updateText(party, ["name"], payload.name);
        });
    }
  }
  return {
    party,
    partyId,
    isLoading: handle.inState(["loading"]),
    dispatch,
  };
}

interface ChangePartyNameAction {
  type: "party_change_name";
  payload: {
    name: string;
  };
}

type ChangePartyAction = ChangePartyNameAction;

function ExpenseItem({
  partyId,
  expenseId,
}: {
  partyId: AnyDocumentId;
  expenseId: AnyDocumentId;
}) {
  const [expense, handle] = useSuspenseDocument<Expense>(expenseId);

  if (!expense || handle.isDeleted()) {
    // not sure if this is the right way to handle NULL
    // or the isDeleted for list items, but this should work
    return null;
  }

  return (
    <Link
      href={{
        to: "/party/$partyId/expense/$expenseId",
        params: {
          partyId,
          expenseId: expenseId,
        },
      }}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "flex w-full scale-100 flex-col rounded-xl bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:bg-slate-900",
          (isHovered || isFocusVisible) &&
            "shadow-md dark:bg-slate-800 dark:shadow-none",
          isPressed &&
            "scale-105 bg-opacity-90 shadow-lg dark:bg-slate-700 dark:shadow-none",
        )
      }
    >
      <span className="text-xl font-medium">{expense.name}</span>
      <span className="text-lg">{expense.description}</span>
      <span className="text-lg">{expense.paidAt.toLocaleDateString()}</span>
    </Link>
  );
}
