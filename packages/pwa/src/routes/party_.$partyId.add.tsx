import { BackButton } from "#src/components/BackButton.js";
import { validateExpenseTitle } from "#src/lib/validation.js";
import { AppNumberField, AppTextField } from "#src/ui/TextField.js";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import { type DocumentId } from "@automerge/automerge-repo/slim";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import type { Party } from "#src/models/party.js";
import type { Expense } from "#src/models/expense.js";
import type { ExpenseUser } from "#src/lib/expenses.js";
import { IconButton } from "#src/ui/IconButton.js";

export const Route = createFileRoute("/party/$partyId/add")({
  component: () => <AddExpense />,
});

interface NewExpenseFormValues {
  name: string;
  description: string;
  amount: number;
  paidBy: ExpenseUser;
}

function AddExpense() {
  const repo = useRepo();
  const { party, partyId, addExpenseToParty } = useParty();
  const navigate = useNavigate();

  function onCreateExpense(values: NewExpenseFormValues) {
    const paidAt = new Date();
    // TODO: handle more expense share types
    const shares: Expense["shares"] = Object.keys(party.participants).reduce(
      (acc, key) => {
        acc[key as ExpenseUser] = { type: "divide", value: 1 };
        return acc;
      },
      {} as Expense["shares"],
    );
    const handle = repo.create<Expense>({
      id: "" as DocumentId,
      name: values.name,
      description: values.description,
      paidAt,
      paidBy: { [values.paidBy]: values.amount },
      shares,
    });
    handle.change((doc) => (doc.id = handle.documentId));
    addExpenseToParty(handle.documentId, paidAt);
    navigate({ to: "/party/$partyId", params: { partyId } });
    return handle.documentId;
  }

  const form = useForm<NewExpenseFormValues>({
    defaultValues: {
      name: "",
      description: "",
      amount: 0,
      paidBy: Object.keys(party.participants)[0],
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
                  icon="check"
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
              description={t`How do you want to call this expense?`}
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
            <AppNumberField
              name={field.name}
              label={t`Amount`}
              description="In cents" // TODO: better description
              minValue={1}
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

function useParty() {
  const { partyId: _partyId } = Route.useParams();
  const partyId = _partyId as DocumentId; //= isValidDocumentId(_partyId) ? _partyId : undefined;
  const [party, handle] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });
  function addExpenseToParty(expenseId: Expense["id"], paidAt: Date) {
    handle.change((party) => {
      party.expenses.push({
        paidAt,
        expenseId: handle.documentId,
      });
    });
  }
  return { party, partyId, addExpenseToParty };
}
