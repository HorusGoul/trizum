import type { Expense } from "#src/models/expense.js";
import { deleteAt, isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { BackButton } from "#src/components/BackButton.js";
import { MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import type { Party } from "#src/models/party.js";

export const Route = createFileRoute("/party/$partyId/expense/$expenseId")({
  component: ExpenseById,
});

function ExpenseById() {
  const { expenseId, expense, onDeleteExpense, isLoading } = useExpense();

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
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton />
        <h1 className="pl-4 text-2xl font-bold">{expense.name}</h1>
        <div className="flex-1" />
        <MenuTrigger>
          <IconButton icon="ellipsis-vertical" aria-label="Menu" />
          <Popover placement="bottom end">
            <Menu>
              <MenuItem onAction={onDeleteExpense}>
                <IconWithFallback name="trash" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">Delete</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    </div>
  );
}

function useExpense() {
  const repo = useRepo();
  const { history } = useRouter();
  const { partyId: _partyId, expenseId: _expenseId } = Route.useParams();
  const partyId = isValidDocumentId(_partyId) ? _partyId : undefined;
  const expenseId = isValidDocumentId(_expenseId) ? _expenseId : undefined;
  const [expense] = useSuspenseDocument<Expense>(expenseId);
  const [party, handle] = useSuspenseDocument<Party>(partyId);
  function onDeleteExpense() {
    if (expenseId === undefined || !isValidDocumentId(expenseId)) return;
    repo.delete(expenseId);
    if (party) {
      const index = party.expenses.findIndex((p) => p.expenseId === expenseId);
      if (index === -1) return;
      handle.change((party) => deleteAt(party.expenses, index));
    }
    history.back();
  }
  return {
    partyId,
    onDeleteExpense,
    expense,
    expenseId,
    isLoading: handle.inState(["loading"]),
  };
}
