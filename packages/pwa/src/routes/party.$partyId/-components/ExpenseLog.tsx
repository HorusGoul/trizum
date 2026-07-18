import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { Button as AriaButton, MenuTrigger, Popover } from "react-aria-components";
import { useState } from "react";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { usePartyPaginatedExpenses } from "#src/hooks/usePartyPaginatedExpenses.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import {
  BLANK_EXPENSE_TEMPLATE_SYMBOL,
  shouldOpenExpenseTemplatePicker,
} from "#src/models/expenseTemplate.ts";
import { Icon } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import {
  ModalSheet,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "#src/ui/ModalSheet.tsx";
import { cn } from "#src/ui/utils.ts";
import { VirtualizedExpenseList } from "./VirtualizedExpenseList.js";

export function ExpenseLog() {
  const { party, dev, setParticipantDetails } = useCurrentParty();
  const { expenses, hasNext, isLoadingNext, loadNext } = usePartyPaginatedExpenses(party.id);
  const participant = useCurrentParticipant();
  const navigate = useNavigate();
  const [isAddExpenseSheetOpen, setIsAddExpenseSheetOpen] = useState(false);
  const templates = Object.values(party.expenseTemplates ?? {}).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const onlyUseCustomTemplates = Boolean(
    party.onlyUseCustomExpenseTemplates && templates.length > 0,
  );

  function openExpenseEditor(templateId?: string) {
    setIsAddExpenseSheetOpen(false);
    void navigate({
      to: "/party/$partyId/add",
      params: { partyId: party.id },
      search: templateId ? { template: templateId } : {},
    });
  }

  function onAddExpensePress() {
    if (
      shouldOpenExpenseTemplatePicker({
        alwaysUseDefaultTemplate: participant.alwaysUseDefaultExpenseTemplate ?? false,
        customTemplateCount: templates.length,
        onlyUseCustomTemplates,
      })
    ) {
      setIsAddExpenseSheetOpen(true);
      return;
    }

    const shouldUseDefaultTemplate =
      participant.alwaysUseDefaultExpenseTemplate || onlyUseCustomTemplates;
    const defaultTemplateId = shouldUseDefaultTemplate ? party.defaultExpenseTemplateId : undefined;
    const hasDefaultTemplate = Boolean(
      defaultTemplateId && party.expenseTemplates?.[defaultTemplateId],
    );
    const fallbackTemplateId = onlyUseCustomTemplates ? templates[0]?.id : undefined;
    openExpenseEditor(hasDefaultTemplate ? defaultTemplateId : fallbackTemplateId);
  }

  function toggleAlwaysUseDefaultTemplate() {
    setParticipantDetails(participant.id, {
      alwaysUseDefaultExpenseTemplate: !participant.alwaysUseDefaultExpenseTemplate,
    });
  }

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
          <IconButton
            aria-label={t`Add an expense`}
            icon="lucide.plus"
            color="accent"
            className="pointer-events-auto h-14 w-14 shadow-md"
            onPress={onAddExpensePress}
          />
        </div>
      </div>

      <ModalSheet isOpen={isAddExpenseSheetOpen} onOpenChange={setIsAddExpenseSheetOpen}>
        <ModalSheetHeader>
          <ModalSheetSection className="flex items-center gap-3">
            <ModalSheetTitle className="min-w-0 flex-1">
              <Trans>Add an expense</Trans>
            </ModalSheetTitle>

            <MenuTrigger>
              <IconButton
                icon="lucide.ellipsis-vertical"
                aria-label={t`Expense template options`}
              />
              <Popover placement="top end">
                <Menu className="min-w-72">
                  <MenuItem onAction={toggleAlwaysUseDefaultTemplate}>
                    <Icon icon="lucide.fast-forward" width={20} height={20} className="mr-3" />
                    <div className="mr-3 flex flex-1 flex-col">
                      <span className="leading-none">
                        <Trans>Always use default template</Trans>
                      </span>
                      <span className="mt-2 text-sm leading-snug opacity-80">
                        <Trans>Skip this picker next time</Trans>
                      </span>
                    </div>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
                        participant.alwaysUseDefaultExpenseTemplate
                          ? "bg-accent-500"
                          : "bg-accent-800",
                      )}
                    >
                      <span
                        className={cn(
                          "bg-accent-50 block size-5 rounded-full shadow-lg transition-transform",
                          participant.alwaysUseDefaultExpenseTemplate && "translate-x-5",
                        )}
                      />
                    </span>
                  </MenuItem>

                  <MenuItem
                    href={{
                      to: "/party/$partyId/settings/expense-templates",
                      params: { partyId: party.id },
                    }}
                  >
                    <Icon icon="lucide.settings" width={20} height={20} className="mr-3" />
                    <span className="leading-none">
                      <Trans>Manage expense templates</Trans>
                    </span>
                  </MenuItem>

                  {import.meta.env.DEV ? (
                    <MenuItem menuAction={dev.createTestExpenses}>
                      <Icon
                        icon="lucide.test-tube-diagonal"
                        width={20}
                        height={20}
                        className="mr-3"
                      />
                      <span className="leading-none">
                        <Trans>[DEV] Create expenses</Trans>
                      </span>
                    </MenuItem>
                  ) : null}
                </Menu>
              </Popover>
            </MenuTrigger>
          </ModalSheetSection>
        </ModalSheetHeader>

        <ModalSheetContent>
          <ModalSheetActions className="pb-2">
            {onlyUseCustomTemplates ? null : (
              <ExpenseTemplateSheetAction
                symbol={BLANK_EXPENSE_TEMPLATE_SYMBOL}
                name={t`Blank`}
                description={t`Start with empty expense values`}
                onPress={() => openExpenseEditor()}
              />
            )}

            {templates.map((template) => (
              <ExpenseTemplateSheetAction
                key={template.id}
                symbol={template.symbol}
                name={template.name}
                description={template.expenseName || t`Expense template`}
                onPress={() => openExpenseEditor(template.id)}
              />
            ))}
          </ModalSheetActions>
        </ModalSheetContent>
      </ModalSheet>
    </>
  );
}

function ExpenseTemplateSheetAction({
  description,
  name,
  onPress,
  symbol,
}: {
  description: string;
  name: string;
  onPress: () => void;
  symbol: string;
}) {
  return (
    <AriaButton
      onPress={onPress}
      className={({ isFocusVisible, isHovered, isPressed }) =>
        cn(
          "grid min-h-16 w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 rounded-[1.35rem] px-safe-or-4 py-3 text-left outline-hidden transition-all sm:px-safe-or-5",
          (isHovered || isFocusVisible) && "bg-accent-100 dark:bg-accent-900",
          isFocusVisible && "ring-accent-300 dark:ring-accent-700 ring-2",
          isPressed && "bg-accent-200 dark:bg-accent-800 scale-[0.98]",
        )
      }
    >
      <span
        aria-hidden="true"
        className="bg-accent-100 dark:bg-accent-800 flex size-10 items-center justify-center rounded-full text-xl"
      >
        {symbol}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-accent-950 dark:text-accent-50 truncate font-medium">{name}</span>
        <span className="text-accent-700 dark:text-accent-200 truncate text-sm">{description}</span>
      </span>
    </AriaButton>
  );
}
