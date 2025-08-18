import type { ExpenseUser } from "#src/lib/expenses.js";
import { useForm, useStore } from "@tanstack/react-form";
import { BackButton } from "./BackButton";
import { Suspense, useId, useState } from "react";
import { IconButton } from "#src/ui/IconButton.js";
import { t } from "@lingui/macro";
import { validateExpenseTitle } from "#src/lib/validation.js";
import { AppNumberField, AppTextField } from "#src/ui/TextField.js";
import { CurrencyField } from "./CurrencyField";
import { convertToUnits } from "#src/lib/expenses.js";
import { toast } from "sonner";
import Dinero from "dinero.js";
import { useExpenseParticipants } from "#src/hooks/useExpenseParticipants.ts";
import { CurrencyText } from "./CurrencyText";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { Checkbox } from "#src/ui/Checkbox.tsx";
import { Button } from "#src/ui/Button.tsx";
import type { PartyParticipant } from "#src/models/party.ts";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { Tooltip, TooltipTrigger } from "#src/ui/Tooltip.tsx";

export interface ExpenseEditorFormValues {
  name: string;
  amount: number;
  paidBy: ExpenseUser;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
}

interface ExpenseEditorProps {
  title: string;
  onSubmit: (values: ExpenseEditorFormValues) => void;
  defaultValues: ExpenseEditorFormValues;
}

export function ExpenseEditor({
  title,
  onSubmit,
  defaultValues,
}: ExpenseEditorProps) {
  // Derive initial mode from shares
  const getInitialMode = (
    shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>,
  ) => {
    for (const share of Object.values(shares)) {
      if (
        share.type === "exact" ||
        (share.type === "divide" && share.value !== 1)
      ) {
        return "advanced";
      }
    }
    return "simple";
  };

  const [mode, setMode] = useState<"simple" | "advanced">(
    getInitialMode(defaultValues.shares || {}),
  );

  const participants = useExpenseParticipants({
    paidBy: {
      [defaultValues.paidBy]: 1,
    },
    shares: defaultValues.shares,
  });

  const form = useForm({
    defaultValues: {
      ...defaultValues,
      shares:
        defaultValues.shares ||
        participants.reduce(
          (acc, { id }) => {
            acc[id] = { type: "divide" as const, value: 1 };
            return acc;
          },
          {} as Record<
            ExpenseUser,
            { type: "divide" | "exact"; value: number }
          >,
        ),
    },
    onSubmit: ({ value }) => {
      // Validate that amounts add up correctly using Dinero.js for precise calculations
      const activeParticipants = Object.keys(value.shares);
      const totalAmount = Dinero({ amount: convertToUnits(value.amount) });

      // Calculate total shares for divide participants
      const totalShares = activeParticipants.reduce((total, participantId) => {
        const share = value.shares[participantId];
        if (share?.type === "divide") {
          return total + share.value;
        }
        return total;
      }, 0);

      // Calculate total amount taken by exact shares using Dinero.js
      const exactTotal = activeParticipants.reduce(
        (total, participantId) => {
          const share = value.shares[participantId];
          if (share?.type === "exact") {
            return total.add(Dinero({ amount: share.value }));
          }
          return total;
        },
        Dinero({ amount: 0 }),
      );

      // Calculate total split amount using Dinero.js
      let totalSplit = exactTotal;
      if (totalShares > 0) {
        // Calculate remaining amount for divide participants
        const remainingAmount = totalAmount.subtract(exactTotal);
        totalSplit = exactTotal.add(remainingAmount);
      }

      // Compare using Dinero.js equality
      if (!totalSplit.equalsTo(totalAmount)) {
        toast.error(
          t`Expense amounts don't match total. Please check your split configuration.`,
        );
        return;
      }

      onSubmit(value);
    },
  });

  const formId = useId();

  const handleIncludeAllChange = (include: boolean) => {
    const newShares = { ...form.state.values.shares };

    for (const participant of participants) {
      if (include) {
        if (!newShares[participant.id]) {
          newShares[participant.id] = { type: "divide" as const, value: 1 };
        }
      } else {
        // Remove participant - remove their share
        delete newShares[participant.id];
      }
    }

    form.setFieldValue("shares", newShares);
  };

  const handleModeChange = (newMode: "simple" | "advanced") => {
    setMode(newMode);

    if (newMode === "simple") {
      // Reset to even split for simple mode
      const newShares = { ...form.getFieldValue("shares") };

      for (const participant of participants) {
        newShares[participant.id] = { type: "divide" as const, value: 1 };
      }

      form.setFieldValue("shares", newShares);
    }
  };

  const shares = useStore(form.store, (state) => state.values.shares);
  const amount = useStore(form.store, (state) => state.values.amount);

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2">
        <BackButton />
        <h1 className="pl-4 text-2xl font-bold">{title}</h1>
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

        <form.Field name="paidBy">
          {(field) => (
            <AppSelect<(typeof participants)[number]>
              label={t`Paid by`}
              items={participants}
              onSelectionChange={(value) => {
                if (value) {
                  field.handleChange(String(value));
                }
              }}
              selectedKey={field.state.value}
            >
              {(participant) => (
                <SelectItem key={participant.id} value={participant}>
                  {participant.name}
                </SelectItem>
              )}
            </AppSelect>
          )}
        </form.Field>

        {/* Participant Selection */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between border-l border-transparent pl-3">
            <Checkbox
              isSelected={Object.keys(shares).length === participants.length}
              isIndeterminate={
                Object.keys(shares).length > 0 &&
                Object.keys(shares).length < participants.length
              }
              onChange={(isSelected) => {
                handleIncludeAllChange(isSelected);
              }}
            >
              {t`Include all`}
            </Checkbox>

            <Button
              color="input-like"
              className="h-8 w-24 rounded-lg px-3 text-sm"
              onPress={() => {
                if (mode === "simple") {
                  handleModeChange("advanced");
                } else {
                  handleModeChange("simple");
                }
              }}
            >
              {mode === "simple" ? t`Advanced` : t`Simple`}
            </Button>
          </div>

          <div className="space-y-2">
            {participants.map((participant) => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                amount={amount}
                shares={shares}
                mode={mode}
                onSharesChange={(shares) =>
                  form.setFieldValue("shares", shares)
                }
              />
            ))}
          </div>
        </div>

        {/* Total Display */}
        <TotalSplitAmount amount={amount} shares={shares} />
      </form>
    </div>
  );
}

interface ParticipantItemProps {
  amount: number;
  participant: PartyParticipant;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
  mode: "simple" | "advanced";
  onSharesChange: (
    shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>,
  ) => void;
}

function ParticipantItem({
  amount,
  shares,
  participant,
  mode,
  onSharesChange,
}: ParticipantItemProps) {
  const participantShare = shares[participant.id];

  function updateShares(
    shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>,
  ) {
    onSharesChange(shares);
  }

  function onShareTypeChange(value: string) {
    const newShares = {
      ...shares,
    };
    const newType = value as "divide" | "exact";

    if (newType === "exact") {
      const amountsByParticipantId = calculateParticipantUnitAmounts(
        amount,
        shares,
      );

      // Set the exact value to the calculated participant's amount
      newShares[participant.id] = {
        type: "exact",
        value: amountsByParticipantId[participant.id],
      };
    } else {
      // When switching to divide, default to 1
      newShares[participant.id] = {
        type: "divide",
        value: 1,
      };
    }

    updateShares(newShares);
  }

  function onSelectParticipant(value: boolean) {
    if (value) {
      // Add participant - give them default share
      const currentShares = shares;
      const newShares = { ...currentShares };
      newShares[participant.id] = {
        type: "divide" as const,
        value: 1,
      };

      updateShares(newShares);
    } else {
      // Remove participant - remove their share
      const currentShares = shares;
      const newShares = { ...currentShares };
      delete newShares[participant.id];
      updateShares(newShares);
    }
  }

  const currentShareType = participantShare?.type || "divide";

  return (
    <div className="grid h-10 grid-cols-2 items-center justify-between rounded-lg border border-slate-500 bg-white pr-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-full items-center gap-3">
        <Checkbox
          isSelected={!!shares[participant.id]}
          onChange={onSelectParticipant}
          className="h-full flex-1 pl-3"
        >
          {participant.name}
        </Checkbox>
      </div>

      {shares[participant.id] && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {mode === "advanced" && (
              <TooltipTrigger>
                <IconButton
                  color="input-like"
                  icon={
                    currentShareType === "divide"
                      ? "#lucide/split"
                      : "#lucide/equal"
                  }
                  onPress={() => {
                    onShareTypeChange(
                      currentShareType === "divide" ? "exact" : "divide",
                    );
                  }}
                  className="h-7 w-7"
                  iconClassName="size-3"
                />

                <Tooltip>
                  {currentShareType === "divide"
                    ? t`Switch to a set amount`
                    : t`Switch to fractional split`}
                </Tooltip>
              </TooltipTrigger>
            )}

            {participantShare.type === "divide" && mode === "advanced" ? (
              <AppNumberField
                className="h-7 w-7"
                inputClassName="h-7 px-0 text-center"
                value={participantShare.value}
                maxValue={99}
                minValue={0}
                step={1}
                onChange={(value) => {
                  const newShares = {
                    ...shares,
                  };

                  newShares[participant.id] = {
                    type: "divide",
                    value,
                  };

                  updateShares(newShares);
                }}
              />
            ) : null}
          </div>

          <div>
            {mode === "simple" ? (
              <ParticipantSplitAmount
                amount={amount}
                shares={shares}
                participantId={participant.id}
              />
            ) : (
              <>
                {participantShare.type === "exact" ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={participantShare.value / 100}
                    onChange={(e) => {
                      const newShares = {
                        ...shares,
                      };
                      newShares[participant.id] = {
                        type: "exact",
                        value: convertToUnits(parseFloat(e.target.value) || 0),
                      };
                      updateShares(newShares);
                    }}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-700"
                  />
                ) : (
                  <ParticipantSplitAmount
                    amount={amount}
                    shares={shares}
                    participantId={participant.id}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
interface ParticipantSplitAmountProps {
  amount: number;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
  participantId: ExpenseUser;
}

function ParticipantSplitAmount({
  amount,
  shares,
  participantId,
}: ParticipantSplitAmountProps) {
  const amountsByParticipantId = calculateParticipantUnitAmounts(
    amount,
    shares,
  );
  const { party } = useCurrentParty();

  return (
    <span className="text-sm text-gray-600 dark:text-gray-400">
      <CurrencyText
        amount={amountsByParticipantId[participantId]}
        currency={party.currency}
        variant="inherit"
        format="0.00"
      />
    </span>
  );
}

function calculateParticipantUnitAmounts(
  amount: number,
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>,
) {
  const activeParticipants = Object.keys(shares);

  // Calculate total shares for divide participants (this is just a count, not money)
  const totalShares = activeParticipants.reduce((total, participantId) => {
    const share = shares[participantId];
    if (share?.type === "divide") {
      return total + share.value;
    }
    return total;
  }, 0);

  const participantAmounts = (() => {
    // Convert display amount to units for precise calculations
    const amountInUnits = convertToUnits(amount);
    const totalAmount = Dinero({ amount: amountInUnits });

    // First, calculate the total amount taken by exact shares using Dinero.js
    const exactTotal = activeParticipants.reduce(
      (total, participantId) => {
        const share = shares[participantId];
        if (share?.type === "exact") {
          return total.add(Dinero({ amount: share.value }));
        }
        return total;
      },
      Dinero({ amount: 0 }),
    );

    // Remaining amount to be split among divide shares using Dinero.js
    const remainingAmount = totalAmount.subtract(exactTotal);

    // First pass: calculate proportional amounts
    const proportionalAmounts = activeParticipants.reduce(
      (acc, participantId) => {
        const share = shares[participantId];
        let participantAmount = 0;

        if (share?.type === "divide") {
          // Calculate using Dinero.js for precise division
          if (totalShares > 0) {
            const shareRatio = share.value / totalShares;
            const amountInUnits = remainingAmount.multiply(shareRatio);
            participantAmount = amountInUnits.getAmount();
          }
        } else if (share?.type === "exact") {
          // Exact shares are already in units
          participantAmount = share.value;
        }

        acc[participantId] = participantAmount;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Second pass: distribute remaining cents to ensure total adds up exactly
    const totalCalculated = Object.values(proportionalAmounts).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    const remainingCents = amountInUnits - totalCalculated;

    if (remainingCents !== 0) {
      // Find divide participants to distribute remaining cents
      const divideParticipants = activeParticipants.filter((participantId) => {
        const share = shares[participantId];
        return share?.type === "divide";
      });

      if (divideParticipants.length > 0) {
        // Sort participants by their current amount to distribute remaining cents
        // to those with the smallest amounts first (for positive remaining) or
        // to those with the largest amounts first (for negative remaining)
        const sortedParticipants = [...divideParticipants].sort((a, b) => {
          if (remainingCents > 0) {
            return proportionalAmounts[a] - proportionalAmounts[b];
          } else {
            return proportionalAmounts[b] - proportionalAmounts[a];
          }
        });

        // Distribute remaining cents one by one to divide participants
        const absRemainingCents = Math.abs(remainingCents);
        for (let i = 0; i < absRemainingCents; i++) {
          const participantIndex = i % sortedParticipants.length;
          const participantId = sortedParticipants[participantIndex];
          if (remainingCents > 0) {
            proportionalAmounts[participantId] += 1;
          } else {
            proportionalAmounts[participantId] -= 1;
          }
        }
      }
    }

    return proportionalAmounts;
  })();

  return participantAmounts;
}

interface TotalSplitAmountProps {
  amount: number;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
}

function TotalSplitAmount({ amount, shares }: TotalSplitAmountProps) {
  const { party } = useCurrentParty();
  const activeParticipants = Object.keys(shares);
  const unitAmounts = calculateParticipantUnitAmounts(amount, shares);
  const totalUnitAmount = Object.values(unitAmounts).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const showWarning = totalUnitAmount - convertToUnits(amount) !== 0;

  return activeParticipants.length > 0 ? (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{t`Total split:`}</span>
        <span className="font-medium">
          <CurrencyText
            amount={totalUnitAmount}
            currency={party.currency}
            variant="inherit"
            format="0.00"
          />
        </span>
      </div>
      {showWarning && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t`Warning: Split amounts don't match total expense`}
        </div>
      )}
    </div>
  ) : null;
}
