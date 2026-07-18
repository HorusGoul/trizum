import { t } from "@lingui/core/macro";
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
  getExpenseTemplateEditorValues,
  type ExpenseTemplate,
  type ExpenseTemplateEditorValues,
} from "#src/models/expenseTemplate.ts";
import { Button } from "#src/ui/Button.tsx";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { AppTextField } from "#src/ui/fields/TextField.tsx";
import { ArchivedParticipantsAlert } from "./-components/ArchivedParticipantsAlert.tsx";
import { DeleteExpenseTemplateSheet } from "./-components/DeleteExpenseTemplateSheet.tsx";
import { ExpenseTemplateEditorHeader } from "./-components/ExpenseTemplateEditorHeader.tsx";

export const Route = createFileRoute("/party_/$partyId/settings/expense-templates_/$templateId")({
  component: ExpenseTemplateEditor,
});

interface PayerOption {
  id: string;
  label: string;
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

  const form = useForm({
    defaultValues: getExpenseTemplateEditorValues(template),
    onSubmit: ({ value }) => {
      const normalizedName = value.name.trim();
      const hasDuplicateName = Object.values(party.expenseTemplates ?? {}).some(
        (existingTemplate) =>
          existingTemplate.id !== template?.id &&
          existingTemplate.name.trim().toLocaleLowerCase(i18n.locale) ===
            normalizedName.toLocaleLowerCase(i18n.locale),
      );

      if (hasDuplicateName) {
        toast.error(t`Template names must be unique`);
        return;
      }

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

      saveExpenseTemplate(savedTemplate);
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
    nextSelection?: ExpenseTemplateEditorValues["participantSelection"],
  ) {
    form.setFieldValue("shares", nextShares);

    if (nextSelection) {
      form.setFieldValue("participantSelection", nextSelection);
      return;
    }

    const includesEveryActiveParticipant = activeParticipants.every(
      (participant) => nextShares[participant.id],
    );

    form.setFieldValue("participantSelection", includesEveryActiveParticipant ? "all" : "specific");
  }

  function includeAllParticipants(include: boolean) {
    const nextShares = { ...shares };

    for (const participant of activeParticipants) {
      if (include) {
        if (!nextShares[participant.id]) {
          nextShares[participant.id] = { type: "divide", value: 1 };
        }
      } else {
        delete nextShares[participant.id];
      }
    }

    setShares(nextShares, include ? "all" : "specific");
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
        <section className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const normalizedName = value.trim();
                  if (!normalizedName) return t`Template name is required`;
                  if (normalizedName.length > 40) return t`Template name is too long`;
                },
              }}
            >
              {(field) => (
                <AppTextField
                  label={t`Template name`}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  maxLength={40}
                  isRequired
                  isInvalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
                  errorMessage={field.state.meta.errors.join(", ")}
                  className="min-w-0 flex-1"
                />
              )}
            </form.Field>

            <form.Field name="symbol">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
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
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">
              <Trans>Expense defaults</Trans>
            </h2>
            <p className="text-accent-700 dark:text-accent-200 text-sm">
              <Trans>These values prefill the new expense form and can still be edited.</Trans>
            </p>
          </div>

          <form.Field
            name="expenseName"
            validators={{
              onChange: ({ value }) => {
                if (value.trim().length > 50) return t`Expense title is too long`;
              },
            }}
          >
            {(field) => (
              <AppTextField
                label={t`Expense title`}
                description={t`Optional`}
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
                description={t`Leave at zero for an empty amount`}
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
        </section>

        <section>
          <div>
            <h2 className="font-semibold">
              <Trans>Split defaults</Trans>
            </h2>
            <p className="text-accent-700 dark:text-accent-200 text-sm">
              {participantSelection === "all" ? (
                <Trans>All active participants, including people added in the future.</Trans>
              ) : (
                <Trans>Only the selected participants.</Trans>
              )}
            </p>
          </div>

          <ExpenseParticipantsSection
            amount={amount}
            autoOpenCalculator={false}
            calculatorAttachmentPhotoIds={[]}
            enableCalculator={false}
            onIncludeAllChange={includeAllParticipants}
            onSharesChange={setShares}
            participants={activeParticipants}
            shares={shares}
          />

          <ArchivedParticipantsAlert isVisible={archivedReferencedParticipants.length > 0} />
        </section>

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
