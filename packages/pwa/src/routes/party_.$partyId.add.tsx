import { BackButton } from "#src/components/BackButton.js";
import { validateExpenseTitle } from "#src/lib/validation.js";
import { AppTextField } from "#src/ui/TextField.js";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";

import { type Expense } from "#src/models/expense.js";
import { convertToUnits, type ExpenseUser } from "#src/lib/expenses.js";
import { IconButton } from "#src/ui/IconButton.js";
import { CurrencyField } from "#src/components/CurrencyField.js";
import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useCurrentParty } from "#src/hooks/useParty.js";

export const Route = createFileRoute("/party/$partyId/add")({
  component: AddExpense,

  async loader({ context, params }) {
    await guardParticipatingInParty(params.partyId, context);
  },
});

interface NewExpenseFormValues {
  name: string;
  description: string;
  amount: number;
  paidBy: ExpenseUser;
}

function AddExpense() {
  const { party, partyId, addExpenseToParty } = useCurrentParty();
  const navigate = useNavigate();
  const participant = useCurrentParticipant();

  async function onCreateExpense(values: NewExpenseFormValues) {
    try {
      const paidAt = new Date();
      // TODO: handle more expense share types
      const shares: Expense["shares"] = Object.keys(party.participants).reduce(
        (acc, key) => {
          acc[key as ExpenseUser] = { type: "divide", value: 1 };
          return acc;
        },
        {} as Expense["shares"],
      );

      toast.loading(t`Adding expense...`, {
        id: "add-expense",
      });

      const expense = await addExpenseToParty({
        name: values.name,
        description: values.description,
        paidAt,
        paidBy: { [values.paidBy]: convertToUnits(values.amount) },
        shares,
      });

      navigate({
        to: "/party/$partyId/expense/$expenseId",
        replace: true,
        params: {
          partyId,
          expenseId: expense.id,
        },
      });

      toast.success(t`Expense added`, {
        id: "add-expense",
      });
    } catch (error) {
      console.error("Failed to add expense", error);
      toast.error(t`Failed to add expense`, {
        id: "add-expense",
        description:
          typeof error === "object" &&
          error &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : undefined,
      });
    }
  }

  const form = useForm<NewExpenseFormValues>({
    defaultValues: {
      name: "",
      description: "",
      amount: 0,
      paidBy: participant.id,
    },
    onSubmit: ({ value }) => {
      onCreateExpense(value);
    },
  });

  const formId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton />
        <h1 className="pl-4 text-2xl font-bold">
          <Trans>New expense</Trans>
        </h1>
        <div className="flex-1" />
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) =>
            canSubmit ? (
              <Suspense fallback={null}>
                <IconButton
                  icon="#lucide/check"
                  aria-label={isSubmitting ? t`Submitting...` : t`Save`}
                  type="submit"
                  form={formId}
                  isDisabled={isSubmitting}
                />
              </Suspense>
            ) : null
          }
        </form.Subscribe>
      </div>

      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="container mt-4 flex flex-col gap-6 px-4"
      >
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => validateExpenseTitle(value),
          }}
        >
          {(field) => (
            <AppTextField
              label={t`Title`}
              description={t`How do you want to call this expense ? `}
              minLength={1}
              maxLength={50}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={field.state.meta.errors?.join(", ")}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>

        <form.Field name="amount">
          {(field) => (
            <CurrencyField
              name={field.name}
              label={t`Amount`}
              description="How much did you pay?"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              isInvalid={
                field.state.meta.isTouched &&
                field.state.meta.errors?.length > 0
              }
            />
          )}
        </form.Field>
      </form>
    </div>
  );
}
