import { decodeExpenseId, findExpenseById } from "#src/models/expense.js";
import { deleteAt, isValidDocumentId } from "@automerge/automerge-repo/slim";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { BackButton } from "#src/components/BackButton.js";
import { MenuTrigger, Popover } from "react-aria-components";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import {
  documentCache,
  useSuspenseDocument,
} from "#src/lib/automerge/suspense-hooks.js";
import type { PartyExpenseChunk } from "#src/models/party.js";
import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";

export const Route = createFileRoute("/party/$partyId/expense/$expenseId")({
  component: ExpenseById,

  async loader({ context, params: { expenseId, partyId } }) {
    await guardParticipatingInParty(partyId, context);

    const { chunkId } = decodeExpenseId(expenseId);
    await documentCache.readAsync(context.repo, chunkId);
  },
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
          <IconButton icon="#lucide/ellipsis-vertical" aria-label="Menu" />
          <Popover placement="bottom end">
            <Menu>
              <MenuItem onAction={onDeleteExpense}>
                <IconWithFallback
                  name="#lucide/trash"
                  size={20}
                  className="mr-3"
                />
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
  const { history } = useRouter();
  const { partyId, expenseId } = Route.useParams();

  if (!isValidDocumentId(partyId)) throw new Error("Malformed Party ID");

  const { chunkId } = decodeExpenseId(expenseId);

  const [chunk, handle] = useSuspenseDocument<PartyExpenseChunk>(chunkId, {
    required: true,
  });

  const [expense, expenseIndex] = findExpenseById(chunk.expenses, expenseId);

  function onDeleteExpense() {
    if (expenseId === undefined) return;

    handle.change((party) => deleteAt(party.expenses, expenseIndex));

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
