import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useParty } from "#src/hooks/useParty.ts";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import {
  BLANK_EXPENSE_TEMPLATE_SYMBOL,
  MAX_EXPENSE_TEMPLATES,
} from "#src/models/expenseTemplate.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { Button } from "#src/ui/Button.tsx";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { Switch } from "#src/ui/Switch.tsx";
import { cn } from "#src/ui/utils.ts";
import { OnlyUseCustomTemplatesSheet } from "./-components/OnlyUseCustomTemplatesSheet.tsx";
import { PartySettingsHeader } from "./-components/PartySettingsHeader.tsx";
import { PartySettingsSection } from "./-components/PartySettingsSection.tsx";

export const Route = createFileRoute("/party_/$partyId/settings/expense-templates")({
  component: ExpenseTemplatesSettings,
});

interface DefaultTemplateOption {
  id: string;
  label: string;
  symbol: string;
}

const BLANK_TEMPLATE_ID = "blank";
const ALWAYS_USE_DEFAULT_TEMPLATE_ID = "always-use-default-expense-template";
const ALWAYS_USE_DEFAULT_TEMPLATE_DESCRIPTION_ID = `${ALWAYS_USE_DEFAULT_TEMPLATE_ID}-description`;
const ONLY_USE_CUSTOM_TEMPLATES_ID = "only-use-custom-expense-templates";
const ONLY_USE_CUSTOM_TEMPLATES_DESCRIPTION_ID = `${ONLY_USE_CUSTOM_TEMPLATES_ID}-description`;

function announceTemplateLimit() {
  toast(t`You can create up to ${MAX_EXPENSE_TEMPLATES} custom templates.`);
}

function ExpenseTemplatesSettings() {
  const { partyId } = Route.useParams();
  const { t: translate, i18n } = useLingui();
  const {
    party,
    setDefaultExpenseTemplate,
    setOnlyUseCustomExpenseTemplates,
    setParticipantDetails,
  } = useParty(partyId);
  const participant = useCurrentParticipant();
  const [isOnlyCustomTemplatesSheetOpen, setIsOnlyCustomTemplatesSheetOpen] = useState(false);
  const templates = Object.values(party.expenseTemplates ?? {}).sort((left, right) =>
    left.name.localeCompare(right.name, i18n.locale),
  );
  const templateCount = templates.length;
  const onlyUseCustomTemplates = Boolean(party.onlyUseCustomExpenseTemplates && templateCount > 0);
  const customTemplateOptions = templates.map((template) => ({
    id: template.id,
    label: template.name,
    symbol: template.symbol,
  }));
  const defaultOptions: DefaultTemplateOption[] = onlyUseCustomTemplates
    ? customTemplateOptions
    : [
        {
          id: BLANK_TEMPLATE_ID,
          label: translate`Blank`,
          symbol: BLANK_EXPENSE_TEMPLATE_SYMBOL,
        },
        ...customTemplateOptions,
      ];
  const configuredDefaultTemplate = party.defaultExpenseTemplateId
    ? party.expenseTemplates?.[party.defaultExpenseTemplateId]
    : undefined;
  const selectedDefaultId = configuredDefaultTemplate
    ? configuredDefaultTemplate.id
    : onlyUseCustomTemplates
      ? templates[0]!.id
      : BLANK_TEMPLATE_ID;
  const canAddTemplate = templateCount < MAX_EXPENSE_TEMPLATES;

  function changeOnlyUseCustomTemplates(isSelected: boolean) {
    if (!isSelected) {
      setOnlyUseCustomExpenseTemplates(false);
      return;
    }

    const firstTemplate = templates[0];

    if (!firstTemplate) {
      return;
    }

    if (configuredDefaultTemplate) {
      setOnlyUseCustomExpenseTemplates(true, firstTemplate.id);
      return;
    }

    setIsOnlyCustomTemplatesSheetOpen(true);
  }

  function confirmOnlyUseCustomTemplates() {
    const firstTemplate = templates[0];

    if (firstTemplate) {
      setOnlyUseCustomExpenseTemplates(true, firstTemplate.id);
    }

    setIsOnlyCustomTemplatesSheetOpen(false);
  }

  return (
    <div className="flex min-h-full flex-col">
      <PartySettingsHeader
        title={<Trans>Expense templates</Trans>}
        fallbackOptions={{
          to: "/party/$partyId/settings",
          params: { partyId },
        }}
      />

      <main className="pb-safe-offset-6 container mt-4 flex flex-col gap-6 px-4">
        <PartySettingsSection icon="lucide.user-round" title={<Trans>Personal</Trans>}>
          <div className="flex items-center justify-between gap-4 rounded-xl py-2">
            <label
              htmlFor={ALWAYS_USE_DEFAULT_TEMPLATE_ID}
              aria-label={t`Always use default template`}
              className="flex min-w-0 cursor-pointer flex-col select-none"
            >
              <span className="text-sm font-medium">
                <Trans>Always use default template</Trans>
              </span>
              <span
                id={ALWAYS_USE_DEFAULT_TEMPLATE_DESCRIPTION_ID}
                className="text-accent-500 text-sm"
              >
                <Trans>Skip the template picker when you add an expense.</Trans>
              </span>
            </label>
            <Switch
              id={ALWAYS_USE_DEFAULT_TEMPLATE_ID}
              aria-label={t`Always use default template`}
              aria-describedby={ALWAYS_USE_DEFAULT_TEMPLATE_DESCRIPTION_ID}
              isSelected={participant.alwaysUseDefaultExpenseTemplate ?? false}
              onChange={(isSelected) => {
                setParticipantDetails(participant.id, {
                  alwaysUseDefaultExpenseTemplate: isSelected,
                });
              }}
            />
          </div>
        </PartySettingsSection>

        <PartySettingsSection icon="lucide.users" title={<Trans>Party</Trans>}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col">
              <AppSelect<DefaultTemplateOption>
                className="py-2"
                label={t`Default template`}
                items={defaultOptions}
                selectedKey={selectedDefaultId}
                onSelectionChange={(key) => {
                  const templateId = String(key);
                  setDefaultExpenseTemplate(
                    templateId === BLANK_TEMPLATE_ID ? undefined : templateId,
                  );
                }}
              >
                {(option) => (
                  <SelectItem key={option.id} value={option} textValue={option.label}>
                    <span className="mr-2 text-base">{option.symbol}</span>
                    {option.label}
                  </SelectItem>
                )}
              </AppSelect>

              <div className="flex items-center justify-between gap-4 rounded-xl py-2">
                <label
                  htmlFor={ONLY_USE_CUSTOM_TEMPLATES_ID}
                  aria-label={t`Only use custom templates`}
                  className={cn(
                    "flex min-w-0 flex-col select-none",
                    templateCount > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                  )}
                >
                  <span className="text-sm font-medium">
                    <Trans>Only use custom templates</Trans>
                  </span>
                  <span
                    id={ONLY_USE_CUSTOM_TEMPLATES_DESCRIPTION_ID}
                    className="text-accent-500 text-sm"
                  >
                    {templateCount > 0 ? (
                      <Trans>Hide the blank option when adding an expense.</Trans>
                    ) : (
                      <Trans>Create a custom template to enable this setting.</Trans>
                    )}
                  </span>
                </label>
                <Switch
                  id={ONLY_USE_CUSTOM_TEMPLATES_ID}
                  aria-label={t`Only use custom templates`}
                  aria-describedby={ONLY_USE_CUSTOM_TEMPLATES_DESCRIPTION_ID}
                  isDisabled={templateCount === 0}
                  isSelected={onlyUseCustomTemplates}
                  onChange={changeOnlyUseCustomTemplates}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">
                    <Trans>Custom templates</Trans>
                  </h3>
                  <p className="text-accent-700 dark:text-accent-200 text-sm">
                    <Trans>
                      {templateCount} of {MAX_EXPENSE_TEMPLATES} custom templates
                    </Trans>
                  </p>
                </div>

                {canAddTemplate ? (
                  <Link
                    to="/party/$partyId/settings/expense-templates/$templateId"
                    params={{ partyId, templateId: "new" }}
                    className="bg-accent-500 text-accent-50 focus-visible:ring-accent-500 hover:bg-accent-600 flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-hidden transition-all focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95"
                  >
                    <Icon icon="lucide.plus" className="size-3.5" />
                    <Trans>Add</Trans>
                  </Link>
                ) : (
                  <Button
                    color="accent"
                    className="h-8 w-auto gap-1.5 px-3 text-sm font-medium"
                    onPress={announceTemplateLimit}
                  >
                    <Icon icon="lucide.plus" className="size-3.5" />
                    <Trans>Add</Trans>
                  </Button>
                )}
              </div>

              {templates.length === 0 ? (
                <div className="border-accent-200 bg-accent-50 dark:border-accent-800 dark:bg-accent-950 flex flex-col items-center gap-2 rounded-2xl border px-6 py-8 text-center">
                  <Icon
                    icon="lucide.layout-template"
                    className="text-accent-600 dark:text-accent-300 size-8"
                  />
                  <p className="font-medium">
                    <Trans>No custom templates yet</Trans>
                  </p>
                  <p className="text-accent-700 dark:text-accent-200 text-sm">
                    <Trans>Create one to prefill common expense details and splits.</Trans>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {templates.map((template) => (
                    <Link
                      key={template.id}
                      to="/party/$partyId/settings/expense-templates/$templateId"
                      params={{ partyId, templateId: template.id }}
                      className="border-accent-200 hover:bg-accent-100/70 focus-visible:ring-accent-500 dark:border-accent-800 dark:bg-accent-950 dark:hover:bg-accent-900/70 flex min-h-18 items-center gap-3 rounded-xl border bg-white px-4 py-3 outline-hidden transition-all focus-visible:ring-2 active:scale-[0.98]"
                    >
                      <span className="bg-accent-100 dark:bg-accent-900 flex size-11 shrink-0 items-center justify-center rounded-full text-xl">
                        {template.symbol}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{template.name}</span>
                      {party.defaultExpenseTemplateId === template.id ? (
                        <span className="bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-100 rounded-full px-2 py-1 text-xs font-medium">
                          <Trans>Default</Trans>
                        </span>
                      ) : null}
                      <Icon
                        icon="lucide.chevron-right"
                        className="text-accent-600 size-4 shrink-0"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PartySettingsSection>
      </main>

      <OnlyUseCustomTemplatesSheet
        isOpen={isOnlyCustomTemplatesSheetOpen}
        onConfirm={confirmOnlyUseCustomTemplates}
        onOpenChange={setIsOnlyCustomTemplatesSheetOpen}
        templateName={templates[0]?.name ?? ""}
      />
    </div>
  );
}
