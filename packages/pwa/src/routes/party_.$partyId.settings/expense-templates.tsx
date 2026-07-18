import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useParty } from "#src/hooks/useParty.ts";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { MAX_EXPENSE_TEMPLATES } from "#src/models/expenseTemplate.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { cn } from "#src/ui/utils.ts";
import { Switch } from "#src/ui/Switch.tsx";
import { PartySettingsHeader } from "./-components/PartySettingsHeader.tsx";

export const Route = createFileRoute("/party_/$partyId/settings/expense-templates")({
  component: ExpenseTemplatesSettings,
});

interface DefaultTemplateOption {
  id: string;
  label: string;
  symbol: string;
}

const BLANK_TEMPLATE_ID = "blank";

function ExpenseTemplatesSettings() {
  const { partyId } = Route.useParams();
  const { t: translate, i18n } = useLingui();
  const { party, setDefaultExpenseTemplate, setParticipantDetails } = useParty(partyId);
  const participant = useCurrentParticipant();
  const templates = Object.values(party.expenseTemplates ?? {}).sort((left, right) =>
    left.name.localeCompare(right.name, i18n.locale),
  );
  const defaultOptions: DefaultTemplateOption[] = [
    { id: BLANK_TEMPLATE_ID, label: translate`Blank expense`, symbol: "➕" },
    ...templates.map((template) => ({
      id: template.id,
      label: template.name,
      symbol: template.symbol,
    })),
  ];
  const selectedDefaultId = party.defaultExpenseTemplateId
    ? (party.expenseTemplates?.[party.defaultExpenseTemplateId]?.id ?? BLANK_TEMPLATE_ID)
    : BLANK_TEMPLATE_ID;
  const canAddTemplate = templates.length < MAX_EXPENSE_TEMPLATES;
  const templateCount = templates.length;

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
        <section className="flex flex-col gap-3">
          <AppSelect<DefaultTemplateOption>
            label={t`Default template`}
            description={t`Used to prefill new expenses. Blank expense keeps the current empty form.`}
            items={defaultOptions}
            selectedKey={selectedDefaultId}
            onSelectionChange={(key) => {
              const templateId = String(key);
              setDefaultExpenseTemplate(templateId === BLANK_TEMPLATE_ID ? undefined : templateId);
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
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                <Trans>Always use default template</Trans>
              </span>
              <span className="text-accent-700 dark:text-accent-200 text-sm font-normal">
                <Trans>Skip the template picker when adding an expense</Trans>
              </span>
            </span>
            <Switch
              aria-label={t`Always use default template`}
              isSelected={participant.alwaysUseDefaultExpenseTemplate ?? false}
              onChange={(isSelected) => {
                setParticipantDetails(participant.id, {
                  alwaysUseDefaultExpenseTemplate: isSelected,
                });
              }}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                <Trans>Templates</Trans>
              </h2>
              <p className="text-accent-700 dark:text-accent-200 text-sm">
                <Trans>
                  {templateCount} of {MAX_EXPENSE_TEMPLATES} templates
                </Trans>
              </p>
            </div>

            <Link
              to="/party/$partyId/settings/expense-templates/$templateId"
              params={{ partyId, templateId: "new" }}
              aria-disabled={!canAddTemplate}
              className={cn(
                "bg-accent-500 text-accent-50 focus-visible:ring-accent-500 flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium outline-hidden transition-all focus-visible:ring-2 focus-visible:ring-offset-2",
                canAddTemplate
                  ? "hover:bg-accent-600 active:scale-95"
                  : "pointer-events-none opacity-50",
              )}
            >
              <Icon icon="lucide.plus" className="size-4" />
              <Trans>Add</Trans>
            </Link>
          </div>

          {templates.length === 0 ? (
            <div className="border-accent-200 bg-accent-50 dark:border-accent-800 dark:bg-accent-950 flex flex-col items-center gap-2 rounded-2xl border px-6 py-8 text-center">
              <span className="text-3xl" aria-hidden="true">
                🧾
              </span>
              <p className="font-medium">
                <Trans>No expense templates yet</Trans>
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
                  <Icon icon="lucide.chevron-right" className="text-accent-600 size-4 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
