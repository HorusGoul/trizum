import { BackButton } from "#src/components/BackButton.js";
import { validateExpenseTitle } from "#src/lib/validation.js";
import { AppTextField } from "#src/ui/TextField.js";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { t, Trans } from "@lingui/macro";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useId } from "react";
import {
  isValidDocumentId,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import type { Party, PartyExpenseChunk } from "#src/models/party.js";
import { createExpenseId, type Expense } from "#src/models/expense.js";
import { convertToUnits, type ExpenseUser } from "#src/lib/expenses.js";
import { IconButton } from "#src/ui/IconButton.js";
import { CurrencyField } from "#src/components/CurrencyField.js";
import { toast } from "sonner";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";

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
  const { party, partyId, addExpenseToParty } = useParty();
  const navigate = useNavigate();
  const participant = useCurrentParticipant();

  async function onCreateExpense(values: NewExpenseFormValues) {
    try {
      if (!party || !partyId) {
        console.warn("This party doesn't exist");
        return;
      }
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

  if (!party || !partyId) {
    return t`Can't add an expense to a party that doesn't exist`;
  }

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

function useParty() {
  const { partyId } = Route.useParams();
  if (!isValidDocumentId(partyId)) throw new Error("Malformed Party ID");
  const [party, handle] = useSuspenseDocument<Party>(partyId);

  const repo = useRepo();

  function createChunk() {
    const handle = repo.create<PartyExpenseChunk>({
      id: "" as DocumentId,
      createdAt: new Date(),
      expenses: [],
      maxSize: 500,
    });

    handle.change((doc) => (doc.id = handle.documentId));

    return [handle.documentId, handle] as const;
  }

  async function addExpenseToParty(
    expense: Omit<Expense, "id">,
  ): Promise<Expense> {
    if (!party) {
      throw new Error("Party not found, this should not happen");
    }

    // Last chunk is the most recent one, so should be indexed at 0
    let lastChunkId = party.chunkIds.at(0);

    if (!lastChunkId) {
      // Create a new chunk if there is none
      const [chunkId] = createChunk();
      lastChunkId = chunkId;
    }

    let lastChunkHandle = repo.find<PartyExpenseChunk>(lastChunkId);
    let lastChunk = await lastChunkHandle.doc();

    if (!lastChunk) {
      throw new Error("Chunk not found, this should not happen");
    }

    if (lastChunk.expenses.length >= lastChunk.maxSize) {
      // Create a new chunk if the last one is full
      const [chunkId, handle] = createChunk();
      lastChunkId = chunkId;
      lastChunkHandle = handle;
      lastChunk = await lastChunkHandle.doc();

      if (!lastChunk) {
        throw new Error("Chunk not found, this should not happen");
      }
    }

    const expenseWithId = {
      ...expense,
      id: createExpenseId(lastChunkId),
    };

    lastChunkHandle.change((doc) => {
      doc.expenses.unshift(expenseWithId);
    });

    if (party.chunkIds.includes(lastChunkId)) {
      return expenseWithId;
    }

    handle.change(async (party) => {
      party.chunkIds.unshift(lastChunkId);
    });

    return expenseWithId;
  }

  return { party, partyId, addExpenseToParty };
}
