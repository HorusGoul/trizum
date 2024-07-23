import type { Expense } from "#src/models/expense.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { createFileRoute } from "@tanstack/react-router";
import { BackButton } from "#src/components/BackButton.js";

export const Route = createFileRoute("/party/$partyId/expense/$expenseId")({
  component: ExpenseById,
});

function ExpenseById() {
  const { expense } = useExpense();

  if (!expense) {
    return "404 bruv";
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton />
        <h1 className="pl-4 text-2xl font-bold">{expense.name}</h1>
        <div className="flex-1" />
        {/* <MenuTrigger>
          <IconButton icon="ellipsis-vertical" aria-label="Menu" />
          <Popover placement="bottom end">
            <Menu>
              <MenuItem onAction={onDeleteParty}>
                <IconWithFallback name="trash" size={20} className="mr-3" />
                <span className="h-3.5 leading-none">Delete</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger> */}
      </div>
    </div>
  );
}

function useExpense() {
  const { expenseId: _expenseId } = Route.useParams();
  const expenseId = isValidDocumentId(_expenseId) ? _expenseId : undefined;
  const [expense] = useDocument<Expense>(expenseId);
  return { expense, expenseId };
}
