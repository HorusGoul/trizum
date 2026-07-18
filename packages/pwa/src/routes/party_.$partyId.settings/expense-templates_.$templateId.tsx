import { msg, t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useForm, useStore } from "@tanstack/react-form";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useId, useState } from "react";
import { toast } from "sonner";
import { CurrencyField } from "#src/components/CurrencyField.tsx";
import { EmojiPicker } from "#src/components/EmojiPicker.tsx";
import { ExpenseParticipantsSection } from "#src/components/ExpenseEditor.tsx";
import { useBackNavigation } from "#src/hooks/useBackNavigation.ts";
import { useParty } from "#src/hooks/useParty.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import {
  ExpenseTemplateLimitError,
  getExpenseTemplateEditorValues,
  MAX_EXPENSE_TEMPLATES,
  type ExpenseTemplate,
  type ExpenseTemplateEditorValues,
} from "#src/models/expenseTemplate.ts";
import { Button } from "#src/ui/Button.tsx";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { Switch } from "#src/ui/Switch.tsx";
import { AppTextField } from "#src/ui/fields/TextField.tsx";
import { ArchivedParticipantsAlert } from "./-components/ArchivedParticipantsAlert.tsx";
import { DeleteExpenseTemplateSheet } from "./-components/DeleteExpenseTemplateSheet.tsx";
import { ExpenseTemplateEditorHeader } from "./-components/ExpenseTemplateEditorHeader.tsx";
import { PartySettingsSection } from "./-components/PartySettingsSection.tsx";

export const Route = createFileRoute("/party_/$partyId/settings/expense-templates_/$templateId")({
  component: ExpenseTemplateEditor,
});

interface PayerOption {
  id: string;
  label: string;
}

const ALWAYS_INCLUDE_EVERYONE_ID = "always-include-everyone";
const ALWAYS_INCLUDE_EVERYONE_DESCRIPTION_ID = `${ALWAYS_INCLUDE_EVERYONE_ID}-description`;
const DEFAULT_TEMPLATE_NAME = msg`Template {number}`;

function getNextTemplateName({
  existingNames,
  formatName,
  locale,
  templateCount,
}: {
  existingNames: Set<string>;
  formatName: (number: number) => string;
  locale: string;
  templateCount: number;
}) {
  let number = templateCount + 1;

  while (true) {
    const candidate = formatName(number);

    if (!existingNames.has(candidate.toLocaleLowerCase(locale))) {
      return candidate;
    }

    number += 1;
  }
}

function announceTemplateLimit() {
  toast(t`You can create up to ${MAX_EXPENSE_TEMPLATES} custom templates.`);
}

function ExpenseTemplateEditor() {
  const { partyId, templateId } = Route.useParams();
  const isNew = templateId === "new";
  const { i18n, t: translate } = useLingui();
  const { party, deleteExpenseTemplate, saveExpenseTemplate } = useParty(partyId);
  const template = isNew ? undefined : party.expenseTemplates?.[templateId];

  if (!isNew && !template) {
    throw notFound();
  }

  const returnToTemplates = useBackNavigation({
    to: "/party/$partyId/settings/expense-templates",
    params: { partyId },
  });
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);
  const formId = useId();
  const activeParticipants = Object.values(party.participants)
    .filter((participant) => !participant.isArchived)
    .sort((left, right) => left.name.localeCompare(right.name, i18n.locale));
  const payerOptions: PayerOption[] = [
    { id: "current-participant", label: translate`Current participant` },
    ...Object.values(party.participants)
      .sort((left, right) => left.name.localeCompare(right.name, i18n.locale))
      .map((participant) => ({
        id: participant.id,
        label: participant.isArchived
          ? translate({ message: `${participant.name} (archived)` })
          : participant.name,
      })),
  ];
  const existingTemplates = Object.values(party.expenseTemplates ?? {});
  const existingTemplateNames = new Set(
    existingTemplates.map((existingTemplate) =>
      existingTemplate.name.trim().toLocaleLowerCase(i18n.locale),
    ),
  );
  const defaultTemplateName = getNextTemplateName({
    existingNames: existingTemplateNames,
    formatName: (number) => i18n._({ ...DEFAULT_TEMPLATE_NAME, values: { number } }),
    locale: i18n.locale,
    templateCount: existingTemplates.length,
  });

  function validateTemplateName(name: string) {
    const normalizedName = name.trim();

    if (!normalizedName) {
      return t`Please give this template a name`;
    }

    if (normalizedName.length > 40) {
      return t`Name is too long`;
    }

    const hasDuplicateName = Object.values(party.expenseTemplates ?? {}).some(
      (existingTemplate) =>
        existingTemplate.id !== template?.id &&
        existingTemplate.name.trim().toLocaleLowerCase(i18n.locale) ===
          normalizedName.toLocaleLowerCase(i18n.locale),
    );

    if (hasDuplicateName) {
      return t`A template with this name already exists`;
    }
  }

  const form = useForm({
    defaultValues: getExpenseTemplateEditorValues(
      template,
      activeParticipants.map((participant) => participant.id),
      defaultTemplateName,
    ),
    onSubmit: ({ value }) => {
      if (isNew && Object.keys(party.expenseTemplates ?? {}).length >= MAX_EXPENSE_TEMPLATES) {
        announceTemplateLimit();
        return;
      }

      const normalizedName = value.name.trim();

      const savedTemplate: ExpenseTemplate = {
        id: template?.id ?? crypto.randomUUID(),
        name: normalizedName,
        symbol: value.symbol,
        ...(value.expenseName.trim() ? { expenseName: value.expenseName.trim() } : {}),
        ...(value.amount > 0 ? { amount: convertToUnits(value.amount) } : {}),
        paidBy:
          value.paidBy === "current-participant"
            ? { type: "current-participant" }
            : { type: "participant", participantId: value.paidBy },
        participantSelection: value.participantSelection,
        shares: value.shares,
      };

      try {
        saveExpenseTemplate(savedTemplate);
      } catch (error) {
        if (error instanceof ExpenseTemplateLimitError) {
          announceTemplateLimit();
          return;
        }

        throw error;
      }
      form.reset(value);
      toast.success(isNew ? t`Expense template created` : t`Expense template saved`);
      returnToTemplates();
    },
  });

  const amount = useStore(form.store, (state) => state.values.amount);
  const shares = useStore(form.store, (state) => state.values.shares);
  const participantSelection = useStore(form.store, (state) => state.values.participantSelection);
  const archivedReferencedParticipants = Object.values(party.participants).filter(
    (participant) => participant.isArchived && shares[participant.id],
  );

  function setShares(
    nextShares: ExpenseTemplateEditorValues["shares"],
    nextSelection: ExpenseTemplateEditorValues["participantSelection"] = "specific",
  ) {
    form.setFieldValue("shares", nextShares);
    form.setFieldValue("participantSelection", nextSelection);
  }

  function includeAllParticipants(include: boolean) {
    if (!include) {
      form.setFieldValue("participantSelection", "specific");
      return;
    }

    const nextShares = { ...shares };

    for (const participant of activeParticipants) {
      if (!nextShares[participant.id]) {
        nextShares[participant.id] = { type: "divide", value: 1 };
      }
    }

    setShares(nextShares, "all");
  }

  function confirmDelete() {
    if (!template) {
      return;
    }

    deleteExpenseTemplate(template.id);
    setIsDeleteSheetOpen(false);
    toast.success(t`Expense template deleted`);
    returnToTemplates();
  }

  return (
    <div className="flex min-h-full flex-col">
      <ExpenseTemplateEditorHeader form={form} formId={formId} isNew={isNew} partyId={partyId} />

      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        className="pb-safe-offset-6 container mt-4 flex flex-col gap-6 px-4"
      >
        <PartySettingsSection icon="lucide.layout-template" title={<Trans>Template</Trans>}>
          <div className="flex items-start gap-3 py-2">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => validateTemplateName(value),
              }}
            >
              {(field) => (
                <AppTextField
                  label={t`Name`}
                  name={field.name}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  minLength={1}
                  maxLength={40}
                  isInvalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
                  errorMessage={field.state.meta.errors.join(", ")}
                  className="min-w-0 flex-1"
                />
              )}
            </form.Field>

            <form.Field name="symbol">
              {(field) => (
                <div className="flex shrink-0 flex-col gap-2">
                  <span aria-hidden="true" className="invisible text-sm leading-none font-medium">
                    <Trans>Icon</Trans>
                  </span>
                  <EmojiPicker
                    value={field.state.value}
                    onChange={field.handleChange}
                    aria-label={t`Template icon`}
                  />
                </div>
              )}
            </form.Field>
          </div>
        </PartySettingsSection>

        <PartySettingsSection icon="lucide.receipt-text" title={<Trans>Expense defaults</Trans>}>
          <div className="flex flex-col gap-4 py-2">
            <form.Field
              name="expenseName"
              validators={{
                onChange: ({ value }) => {
                  if (value.trim().length > 50) return t`Title is too long`;
                },
              }}
            >
              {(field) => (
                <AppTextField
                  label={t`Title`}
                  name={field.name}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  maxLength={50}
                  isInvalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
                  errorMessage={field.state.meta.errors.join(", ")}
                />
              )}
            </form.Field>

            <form.Field name="amount">
              {(field) => (
                <CurrencyField
                  label={t`Amount`}
                  name={field.name}
                  value={field.state.value}
                  minValue={0}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>

            <form.Field name="paidBy">
              {(field) => (
                <AppSelect<PayerOption>
                  label={t`Paid by`}
                  name={field.name}
                  items={payerOptions}
                  selectedKey={field.state.value}
                  onSelectionChange={(key) => field.handleChange(String(key))}
                >
                  {(option) => (
                    <SelectItem key={option.id} value={option} textValue={option.label}>
                      {option.label}
                    </SelectItem>
                  )}
                </AppSelect>
              )}
            </form.Field>

            <div className="flex items-center justify-between gap-4 rounded-xl py-2">
              <label
                htmlFor={ALWAYS_INCLUDE_EVERYONE_ID}
                aria-label={t`Always include everyone`}
                className="flex min-w-0 cursor-pointer flex-col select-none"
              >
                <span className="text-sm font-medium">
                  <Trans>Always include everyone</Trans>
                </span>
                <span
                  id={ALWAYS_INCLUDE_EVERYONE_DESCRIPTION_ID}
                  className="text-accent-500 text-sm"
                >
                  <Trans>Select everyone now and automatically include new participants.</Trans>
                </span>
              </label>
              <Switch
                id={ALWAYS_INCLUDE_EVERYONE_ID}
                aria-label={t`Always include everyone`}
                aria-describedby={ALWAYS_INCLUDE_EVERYONE_DESCRIPTION_ID}
                isSelected={participantSelection === "all"}
                onChange={includeAllParticipants}
              />
            </div>

            <ExpenseParticipantsSection
              className="mt-0"
              amount={amount}
              autoOpenCalculator={false}
              calculatorAttachmentPhotoIds={[]}
              enableCalculator={false}
              onSharesChange={setShares}
              participants={activeParticipants}
              shares={shares}
            />

            <ArchivedParticipantsAlert isVisible={archivedReferencedParticipants.length > 0} />
          </div>
        </PartySettingsSection>

        {!isNew ? (
          <Button
            type="button"
            className="text-rose-700 dark:text-rose-300"
            onPress={() => setIsDeleteSheetOpen(true)}
          >
            <Trans>Delete template</Trans>
          </Button>
        ) : null}
      </form>

      <DeleteExpenseTemplateSheet
        isOpen={isDeleteSheetOpen}
        onConfirm={confirmDelete}
        onOpenChange={setIsDeleteSheetOpen}
      />
    </div>
  );
}
