import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { MenuTrigger, Popover } from "react-aria-components";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { usePartyPaginatedExpenses } from "#src/hooks/usePartyPaginatedExpenses.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import { Icon } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import { VirtualizedExpenseList } from "./VirtualizedExpenseList.js";

export function ExpenseLog() {
  const { party, dev } = useCurrentParty();
  const { expenses, hasNext, isLoadingNext, loadNext } = usePartyPaginatedExpenses(party.id);
  const participant = useCurrentParticipant();
  const navigate = useNavigate();

  const filteredExpenses = expenses.filter((expense) => {
    if (participant.personalMode) {
      if (expense.paidBy[participant.id]) {
        return true;
      }

      if (expense.shares[participant.id]) {
        return true;
      }

      return false;
    }

    return true;
  });

  return (
    <>
      <div className="h-2 shrink-0" />

      <div className="relative container flex min-h-0 flex-1 flex-col px-2">
        <VirtualizedExpenseList
          expenses={filteredExpenses}
          partyId={party.id}
          hasNext={hasNext}
          isLoadingNext={isLoadingNext}
          loadNext={loadNext}
        />

        <div className="bottom-safe-offset-6 pointer-events-none absolute inset-x-2 flex justify-end">
          {import.meta.env.DEV ? (
            <MenuTrigger>
              <IconButton
                aria-label={t`Add or create`}
                icon="lucide.plus"
                color="accent"
                className="pointer-events-auto h-14 w-14 shadow-md"
              />

              <Popover placement="top end" offset={16}>
                <Menu className="min-w-60">
                  {import.meta.env.DEV ? (
                    <MenuItem menuAction={dev.createTestExpenses}>
                      <Icon
                        icon="lucide.test-tube-diagonal"
                        width={20}
                        height={20}
                        className="mr-3"
                      />
                      <span className="h-3.5 leading-none">
                        <Trans>[DEV] Create expenses</Trans>
                      </span>
                    </MenuItem>
                  ) : null}
                  <MenuItem
                    href={{
                      to: "/party/$partyId/add",
                      params: { partyId: party.id },
                    }}
                  >
                    <Icon icon="lucide.list-plus" width={20} height={20} className="mr-3" />
                    <span className="h-3.5 leading-none">
                      <Trans>Add an expense</Trans>
                    </span>
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          ) : (
            <IconButton
              aria-label={t`Add an expense`}
              icon="lucide.plus"
              color="accent"
              className="pointer-events-auto h-14 w-14 shadow-md"
              onPress={() => {
                void navigate({
                  to: "/party/$partyId/add",
                  params: { partyId: party.id },
                });
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
