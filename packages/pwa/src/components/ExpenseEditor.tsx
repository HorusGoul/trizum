import type { ExpenseUser } from "#src/lib/expenses.js";
import { useForm } from "@tanstack/react-form";
import { BackButton } from "./BackButton";
import { Suspense, useId, useState, useMemo } from "react";
import { IconButton } from "#src/ui/IconButton.js";
import { t } from "@lingui/macro";
import { validateExpenseTitle } from "#src/lib/validation.js";
import { AppTextField } from "#src/ui/TextField.js";
import { CurrencyField } from "./CurrencyField";
import { useCurrentParty } from "#src/hooks/useParty.js";
import { cn } from "#src/ui/utils.js";
import { convertToUnits } from "#src/lib/expenses.js";
import { toast } from "sonner";
import Dinero from "dinero.js";

export interface ExpenseEditorFormValues {
  name: string;
  description: string;
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
  const { party } = useCurrentParty();
  
  // Derive initial mode from shares
  const getInitialMode = (shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>) => {
    for (const share of Object.values(shares)) {
      if (share.type === "exact" || (share.type === "divide" && share.value !== 1)) {
        return "advanced";
      }
    }
    return "simple";
  };
  
  const [mode, setMode] = useState<"simple" | "advanced">(
    getInitialMode(defaultValues.shares || {})
  );
  
  const form = useForm({
    defaultValues: {
      ...defaultValues,
      shares: defaultValues.shares || Object.keys(party.participants).reduce((acc, key) => {
        if (!party.participants[key].isArchived) {
          acc[key] = { type: "divide" as const, value: 1 };
        }
        return acc;
      }, {} as Record<ExpenseUser, { type: "divide" | "exact"; value: number }>),
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
      const exactTotal = activeParticipants.reduce((total, participantId) => {
        const share = value.shares[participantId];
        if (share?.type === "exact") {
          return total.add(Dinero({ amount: share.value }));
        }
        return total;
      }, Dinero({ amount: 0 }));
      
      // Calculate total split amount using Dinero.js
      let totalSplit = exactTotal;
      if (totalShares > 0) {
        // Calculate remaining amount for divide participants
        const remainingAmount = totalAmount.subtract(exactTotal);
        totalSplit = exactTotal.add(remainingAmount);
      }
      
      // Compare using Dinero.js equality
      if (!totalSplit.equalsTo(totalAmount)) {
        toast.error(t`Expense amounts don't match total. Please check your split configuration.`);
        return;
      }
      
      onSubmit(value);
    },
  });

  const formId = useId();

  const handleIncludeAllChange = (include: boolean) => {
    const newShares = { ...form.state.values.shares };
    
    Object.keys(party.participants).forEach(participantId => {
      if (!party.participants[participantId].isArchived) {
        if (include) {
          // Add participant - give them default share if they don't have one
          if (!newShares[participantId]) {
            newShares[participantId] = { type: "divide" as const, value: 1 };
          }
        } else {
          // Remove participant - remove their share
          delete newShares[participantId];
        }
      }
    });
    
    form.setFieldValue("shares", newShares);
  };

  const handleModeChange = (newMode: "simple" | "advanced") => {
    setMode(newMode);
    
    if (newMode === "simple") {
      // Reset to even split for simple mode
      const newShares = { ...form.state.values.shares };
      Object.keys(party.participants).forEach(participantId => {
        if (!party.participants[participantId].isArchived) {
          newShares[participantId] = { type: "divide" as const, value: 1 };
        }
      });
      form.setFieldValue("shares", newShares);
    }
  };

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

        <form.Field name="description">
          {(field) => (
            <AppTextField
              label={t`Description`}
              description={t`Optional description for this expense`}
              maxLength={200}
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
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t`Paid by`}
              </label>
              <select
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
              >
                {Object.values(party.participants)
                  .filter(participant => !participant.isArchived)
                  .map(participant => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </form.Field>

        {/* Mode Selection */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t`Expense Split Mode`}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleModeChange("simple")}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                mode === "simple"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              )}
            >
              {t`Simple`}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("advanced")}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                mode === "advanced"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              )}
            >
              {t`Advanced`}
            </button>
          </div>
        </div>

        {/* Participant Selection */}
        <form.Field name="shares">
          {(sharesField) => (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t`Participants`}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="include-all"
                    checked={Object.keys(sharesField.state.value).length === Object.keys(party.participants).filter(id => !party.participants[id].isArchived).length}
                    onChange={(e) => {
                      handleIncludeAllChange(e.target.checked);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="include-all" className="text-sm text-gray-600 dark:text-gray-400">
                    {t`Include all`}
                  </label>
                </div>
              </div>
              
              <div className="space-y-3">
                {Object.values(party.participants)
                  .filter(participant => !participant.isArchived)
                  .map(participant => (
                    <div key={participant.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`participant-${participant.id}`}
                          checked={!!sharesField.state.value[participant.id]}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Add participant - give them default share
                              const currentShares = sharesField.state.value;
                              const newShares = { ...currentShares };
                              newShares[participant.id] = { type: "divide" as const, value: 1 };
                              sharesField.handleChange(newShares);
                            } else {
                              // Remove participant - remove their share
                              const currentShares = sharesField.state.value;
                              const newShares = { ...currentShares };
                              delete newShares[participant.id];
                              sharesField.handleChange(newShares);
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`participant-${participant.id}`} className="font-medium">
                          {participant.name}
                        </label>
                      </div>
                      
                      {sharesField.state.value[participant.id] && (
                        <div className="flex items-center gap-2">
                          {mode === "simple" ? (
                            <form.Subscribe
                              selector={(state) => [state.values.shares, state.values.amount]}
                            >
                              {([shares, amount]) => {
                                const activeParticipants = Object.keys(form.state.values.shares);

                                // Calculate total shares for divide participants (this is just a count, not money)
                                const totalShares = activeParticipants.reduce((total, participantId) => {
                                  const share = (shares as Record<string, { type: "divide" | "exact"; value: number }>)[participantId];
                                  if (share?.type === "divide") {
                                    return total + share.value;
                                  }
                                  return total;
                                }, 0);

                                const participantAmounts = (() => {
                                  // First, calculate the total amount taken by exact shares using Dinero.js
                                  const exactTotal = activeParticipants.reduce((total, participantId) => {
                                    const share = (shares as Record<string, { type: "divide" | "exact"; value: number }>)[participantId];
                                    if (share?.type === "exact") {
                                      return total.add(Dinero({ amount: share.value }));
                                    }
                                    return total;
                                  }, Dinero({ amount: 0 }));
                                  
                                  // Remaining amount to be split among divide shares using Dinero.js
                                  const totalAmount = Dinero({ amount: convertToUnits(amount as number) });
                                  const remainingAmount = totalAmount.subtract(exactTotal);
                                  
                                  if (totalShares === 0) return {};
                                  
                                  // First pass: calculate proportional amounts
                                  const proportionalAmounts = activeParticipants.reduce((acc, participantId) => {
                                    const share = (shares as Record<string, { type: "divide" | "exact"; value: number }>)[participantId];
                                    let participantAmount = 0;
                                    
                                    if (share?.type === "divide") {
                                      // Calculate using Dinero.js for precise division
                                      if (totalShares > 0) {
                                        const shareRatio = share.value / totalShares;
                                        const amountInUnits = remainingAmount.multiply(shareRatio);
                                        participantAmount = amountInUnits.getAmount() / 100; // Convert cents to dollars/euros
                                      }
                                    } else if (share?.type === "exact") {
                                      // Convert units back to display amount
                                      participantAmount = share.value / 100; // Convert cents to dollars/euros
                                    }
                                    
                                    acc[participantId] = participantAmount;
                                    return acc;
                                  }, {} as Record<string, number>);
                                  
                                  // Second pass: distribute remaining cents to ensure total adds up exactly
                                  const totalCalculated = Object.values(proportionalAmounts).reduce((sum, amount) => sum + amount, 0);
                                  const remainingCents = Math.round((amount as number - totalCalculated) * 100);
                                  
                                  if (remainingCents !== 0) {
                                    // Find divide participants to distribute remaining cents
                                    const divideParticipants = activeParticipants.filter(participantId => {
                                      const share = (shares as Record<string, { type: "divide" | "exact"; value: number }>)[participantId];
                                      return share?.type === "divide";
                                    });
                                    
                                    if (divideParticipants.length > 0) {
                                      // Distribute remaining cents one by one to divide participants
                                      for (let i = 0; i < Math.abs(remainingCents); i++) {
                                        const participantIndex = i % divideParticipants.length;
                                        const participantId = divideParticipants[participantIndex];
                                        if (remainingCents > 0) {
                                          proportionalAmounts[participantId] += 0.01;
                                        } else {
                                          proportionalAmounts[participantId] -= 0.01;
                                        }
                                      }
                                    }
                                  }
                                  
                                  return proportionalAmounts;
                                })();

                                return (
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {participantAmounts[participant.id]?.toFixed(2) || "0.00"}
                                  </span>
                                );
                              }}
                            </form.Subscribe>
                          ) : (
                            <form.Field name="shares">
                              {(sharesField) => (
                                <form.Subscribe
                                  selector={(state) => [state.values.amount]}
                                >
                                  {([amount]) => {
                                    const activeParticipants = Object.keys(form.state.values.shares);

                                    // Calculate total shares for divide participants (this is just a count, not money)
                                    const totalShares = activeParticipants.reduce((total, participantId) => {
                                      const share = sharesField.state.value[participantId];
                                      if (share?.type === "divide") {
                                        return total + share.value;
                                      }
                                      return total;
                                    }, 0);

                                    const participantAmounts = (() => {
                                      // First, calculate the total amount taken by exact shares using Dinero.js
                                      const exactTotal = activeParticipants.reduce((total, participantId) => {
                                        const share = sharesField.state.value[participantId];
                                        if (share?.type === "exact") {
                                          return total.add(Dinero({ amount: share.value }));
                                        }
                                        return total;
                                      }, Dinero({ amount: 0 }));
                                      
                                      // Remaining amount to be split among divide shares using Dinero.js
                                      const totalAmount = Dinero({ amount: convertToUnits(amount as number) });
                                      const remainingAmount = totalAmount.subtract(exactTotal);
                                      
                                      if (totalShares === 0) return {};
                                      
                                      // First pass: calculate proportional amounts
                                      const proportionalAmounts = activeParticipants.reduce((acc, participantId) => {
                                        const share = sharesField.state.value[participantId];
                                        let participantAmount = 0;
                                        
                                        if (share?.type === "divide") {
                                          // Calculate using Dinero.js for precise division
                                          if (totalShares > 0) {
                                            const shareRatio = share.value / totalShares;
                                            const amountInUnits = remainingAmount.multiply(shareRatio);
                                            participantAmount = amountInUnits.getAmount() / 100; // Convert cents to dollars/euros
                                          }
                                        } else if (share?.type === "exact") {
                                          // Convert units back to display amount
                                          participantAmount = Dinero({ amount: share.value }).getAmount() / 100; // Convert cents to dollars/euros
                                        }
                                        
                                        acc[participantId] = participantAmount;
                                        return acc;
                                      }, {} as Record<string, number>);
                                      
                                      // Second pass: distribute remaining cents to ensure total adds up exactly
                                      const totalCalculated = Object.values(proportionalAmounts).reduce((sum, amount) => sum + amount, 0);
                                      const remainingCents = Math.round((amount as number - totalCalculated) * 100);
                                      
                                      if (remainingCents !== 0) {
                                        // Find divide participants to distribute remaining cents
                                        const divideParticipants = activeParticipants.filter(participantId => {
                                          const share = sharesField.state.value[participantId];
                                          return share?.type === "divide";
                                        });
                                        
                                        if (divideParticipants.length > 0) {
                                          // Distribute remaining cents one by one to divide participants
                                          for (let i = 0; i < Math.abs(remainingCents); i++) {
                                            const participantIndex = i % divideParticipants.length;
                                            const participantId = divideParticipants[participantIndex];
                                            if (remainingCents > 0) {
                                              proportionalAmounts[participantId] += 0.01;
                                            } else {
                                              proportionalAmounts[participantId] -= 0.01;
                                            }
                                          }
                                        }
                                      }
                                      
                                      return proportionalAmounts;
                                    })();

                                    return (
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={sharesField.state.value[participant.id]?.type || "divide"}
                                          onChange={(e) => {
                                            const newShares = { ...sharesField.state.value };
                                            const newType = e.target.value as "divide" | "exact";
                                            
                                            if (newType === "exact") {
                                              // When switching to exact, calculate the current divide amount
                                              const currentShare = sharesField.state.value[participant.id];
                                              let exactValue = 0;
                                              
                                              if (currentShare?.type === "divide") {
                                                // Calculate what this participant would pay with current divide
                                                                                const activeParticipants = Object.keys(form.state.values.shares);
                                                
                                                const totalShares = activeParticipants.reduce((total, participantId) => {
                                                  const share = sharesField.state.value[participantId];
                                                  if (share?.type === "divide") {
                                                    return total + share.value;
                                                  }
                                                  return total;
                                                }, 0);
                                                
                                                if (totalShares > 0) {
                                                  // Calculate using Dinero.js for precision
                                                  const totalAmount = Dinero({ amount: convertToUnits(amount as number) });
                                                  const shareRatio = currentShare.value / totalShares;
                                                  const amountInUnits = totalAmount.multiply(shareRatio);
                                                  exactValue = amountInUnits.getAmount();
                                                }
                                              }
                                              
                                              newShares[participant.id] = {
                                                type: "exact",
                                                value: exactValue
                                              };
                                            } else {
                                              // When switching to divide, default to 1
                                              newShares[participant.id] = {
                                                type: "divide",
                                                value: 1
                                              };
                                            }
                                            
                                            sharesField.handleChange(newShares);
                                          }}
                                          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                                        >
                                          <option value="divide">{t`Divide`}</option>
                                          <option value="exact">{t`Exact`}</option>
                                        </select>
                                        
                                        {sharesField.state.value[participant.id]?.type === "divide" ? (
                                          <input
                                            type="number"
                                            min="0.1"
                                            step="0.1"
                                            value={sharesField.state.value[participant.id]?.value || 1}
                                            onChange={(e) => {
                                              const newShares = { ...sharesField.state.value };
                                              newShares[participant.id] = {
                                                type: "divide",
                                                value: parseFloat(e.target.value) || 1
                                              };
                                              sharesField.handleChange(newShares);
                                            }}
                                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                                          />
                                        ) : (
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={sharesField.state.value[participant.id]?.type === "exact" ? (sharesField.state.value[participant.id]?.value || 0) / 100 : sharesField.state.value[participant.id]?.value || 0}
                                            onChange={(e) => {
                                              const newShares = { ...sharesField.state.value };
                                              newShares[participant.id] = {
                                                type: "exact",
                                                value: convertToUnits(parseFloat(e.target.value) || 0)
                                              };
                                              sharesField.handleChange(newShares);
                                            }}
                                            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                                          />
                                        )}
                                        
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                          {participantAmounts[participant.id]?.toFixed(2) || "0.00"}
                                        </span>
                                      </div>
                                    );
                                  }}
                                </form.Subscribe>
                              )}
                            </form.Field>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </form.Field>

        {/* Total Display */}
        <form.Subscribe
          selector={(state) => [state.values.shares, state.values.amount]}
        >
          {([shares, amount]) => {
            const activeParticipants = Object.keys(shares as Record<string, { type: "divide" | "exact"; value: number }>);

            // Calculate total shares for divide participants (this is just a count, not money)
            const totalShares = activeParticipants.reduce((total, participantId) => {
              const share = (shares as Record<string, { type: "divide" | "exact"; value: number }>)[participantId];
              if (share?.type === "divide") {
                return total + share.value;
              }
              return total;
            }, 0);

            const participantAmounts = (() => {
              // First, calculate the total amount taken by exact shares using Dinero.js
              const exactTotal = activeParticipants.reduce((total, participantId) => {
                const share = (shares as Record<string, { type: "divide" | "exact"; value: number }>)[participantId];
                if (share?.type === "exact") {
                  return total.add(Dinero({ amount: share.value }));
                }
                return total;
              }, Dinero({ amount: 0 }));
              
              // Remaining amount to be split among divide shares using Dinero.js
              const totalAmount = Dinero({ amount: convertToUnits(amount as number) });
              const remainingAmount = totalAmount.subtract(exactTotal);
              
              if (totalShares === 0) return {};
              
              // First pass: calculate proportional amounts
              const proportionalAmounts = activeParticipants.reduce((acc, participantId) => {
                const share = (shares as Record<string, { type: "divide" | "exact"; value: number }>)[participantId];
                let participantAmount = 0;
                
                if (share?.type === "divide") {
                  // Calculate using Dinero.js for precise division
                  if (totalShares > 0) {
                    const shareRatio = share.value / totalShares;
                    const amountInUnits = remainingAmount.multiply(shareRatio);
                    participantAmount = amountInUnits.getAmount() / 100; // Convert cents to dollars/euros
                  }
                } else if (share?.type === "exact") {
                  // Convert units back to display amount
                  participantAmount = Dinero({ amount: share.value }).getAmount() / 100; // Convert cents to dollars/euros
                }
                
                acc[participantId] = participantAmount;
                return acc;
              }, {} as Record<string, number>);
              
              // Second pass: distribute remaining cents to ensure total adds up exactly
              const totalCalculated = Object.values(proportionalAmounts).reduce((sum, amount) => sum + amount, 0);
              const remainingCents = Math.round((amount as number - totalCalculated) * 100);
              
              if (remainingCents !== 0) {
                // Find divide participants to distribute remaining cents
                const divideParticipants = activeParticipants.filter(participantId => {
                  const share = (shares as Record<string, { type: "divide" | "exact"; value: number }>)[participantId];
                  return share?.type === "divide";
                });
                
                if (divideParticipants.length > 0) {
                  // Distribute remaining cents one by one to divide participants
                  for (let i = 0; i < Math.abs(remainingCents); i++) {
                    const participantIndex = i % divideParticipants.length;
                    const participantId = divideParticipants[participantIndex];
                    if (remainingCents > 0) {
                      proportionalAmounts[participantId] += 0.01;
                    } else {
                      proportionalAmounts[participantId] -= 0.01;
                    }
                  }
                }
              }
              
              return proportionalAmounts;
            })();

            return activeParticipants.length > 0 ? (
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t`Total split:`}</span>
                  <span className="font-medium">
                    {Object.values(participantAmounts).reduce((sum: number, amount: number) => sum + amount, 0).toFixed(2)}
                  </span>
                </div>
                {Math.abs(Object.values(participantAmounts).reduce((sum: number, amount: number) => sum + amount, 0) - (amount as number)) > 0.01 && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {t`Warning: Split amounts don't match total expense`}
                  </div>
                )}
              </div>
            ) : null;
          }}
        </form.Subscribe>
      </form>
    </div>
  );
}
