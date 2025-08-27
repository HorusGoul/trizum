import type { ExpenseUser } from "#src/lib/expenses.js";
import { useForm, useStore, type Updater } from "@tanstack/react-form";
import { BackButton } from "./BackButton";
import { Suspense, useId, useRef, useState } from "react";
import { IconButton } from "#src/ui/IconButton.js";
import { t, Trans } from "@lingui/macro";
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
import type { PartyParticipant } from "#src/models/party.ts";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { Tooltip, TooltipTrigger } from "#src/ui/Tooltip.tsx";
import { AppDatePicker } from "#src/ui/DatePicker.tsx";
import type { CalendarDate } from "@internationalized/date";
import { Alert, AlertDescription, AlertTitle } from "#src/ui/Alert.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { Button } from "#src/ui/Button.tsx";

export interface ExpenseEditorFormValues {
  name: string;
  amount: number;
  paidAt: CalendarDate;
  paidBy: ExpenseUser;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
  photos: LocalPhoto[];
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
        className="container mt-4 flex flex-col px-4"
      >
        <div className="grid grid-cols-2 gap-x-2 gap-y-4">
          <div className="col-span-2">
            <form.Field name="photos">
              {(field) => (
                <PhotosField
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
          </div>

          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => validateExpenseTitle(value),
            }}
          >
            {(field) => (
              <AppTextField
                label={t`Title`}
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
                autoFocus={true}
                className="col-span-2"
              />
            )}
          </form.Field>

          <form.Field
            name="amount"
            validators={{
              onChange: ({ value }) => {
                if (value <= 0) {
                  return t`Amount must be greater than 0`;
                }
              },
            }}
          >
            {(field) => (
              <CurrencyField
                name={field.name}
                label={t`Amount`}
                value={field.state.value}
                onChange={(value) => {
                  field.handleChange(value || 0);
                }}
                onBlur={field.handleBlur}
                errorMessage={field.state.meta.errors?.join(", ")}
                isInvalid={
                  field.state.meta.isTouched &&
                  field.state.meta.errors?.length > 0
                }
                className="col-span-2"
                onFocus={(event) => {
                  const input = event.target as HTMLInputElement;
                  input.select();
                }}
                inputMode="decimal"
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

          <form.Field name="paidAt">
            {(field) => (
              <AppDatePicker
                label={t`Date`}
                value={field.state.value}
                onChange={(value) => {
                  if (value) {
                    field.handleChange(value);
                  }
                }}
              />
            )}
          </form.Field>
        </div>

        {/* Participant Selection */}
        <div className="mt-4 flex flex-col gap-2">
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
          </div>

          <div className="space-y-2">
            {participants.map((participant) => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                amount={amount}
                shares={shares}
                onSharesChange={(shares) =>
                  form.setFieldValue("shares", shares)
                }
              />
            ))}
          </div>

          <SharesWarning amount={amount} shares={shares} />
        </div>

        <div className="h-16" />
      </form>
    </div>
  );
}

interface ParticipantItemProps {
  amount: number;
  participant: PartyParticipant;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
  onSharesChange: (
    shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>,
  ) => void;
}

function ParticipantItem({
  amount,
  shares,
  participant,
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

  function onIncrementSharesPress() {
    if (!participantShare || participantShare.type !== "divide") {
      return;
    }

    const newShares = {
      ...shares,
    };

    newShares[participant.id] = {
      type: "divide",
      value: Math.min(participantShare.value + 1, 99),
    };
    updateShares(newShares);
  }

  function onDecrementSharesPress() {
    if (!participantShare || participantShare.type !== "divide") {
      return;
    }
    const newShares = {
      ...shares,
    };
    newShares[participant.id] = {
      type: "divide",
      value: Math.max(participantShare.value - 1, 0),
    };
    updateShares(newShares);
  }

  function onExactAmountChange(value: number) {
    const newShares = {
      ...shares,
    };
    newShares[participant.id] = {
      type: "exact",
      value: convertToUnits(value || 0),
    };
    updateShares(newShares);
  }

  const currentShareType = participantShare?.type || "divide";

  return (
    <div className="grid h-10 grid-cols-[4fr_6fr] items-center justify-between rounded-lg border border-slate-500 bg-white pr-3 dark:border-slate-700 dark:bg-slate-900">
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
          <div className="flex flex-1 items-center justify-center gap-2">
            {participantShare.type === "divide" ? (
              <>
                <IconButton
                  icon="#lucide/minus"
                  className="h-5 w-5"
                  iconClassName="size-3"
                  onPress={onDecrementSharesPress}
                  color="input-like"
                />
                <AppNumberField
                  className="h-7 w-7 flex-shrink-0"
                  inputClassName="h-7 px-0 text-center"
                  value={participantShare.value}
                  maxValue={99}
                  minValue={0}
                  step={1}
                  inputMode="numeric"
                  onFocus={(event) => {
                    // Select all text
                    const input = event.target as HTMLInputElement;
                    input.select();
                  }}
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
                  aria-label={t`Shares for ${participant.name}`}
                />
                <IconButton
                  icon="#lucide/plus"
                  className="h-5 w-5"
                  iconClassName="size-3"
                  onPress={onIncrementSharesPress}
                  color="input-like"
                />
              </>
            ) : (
              <TooltipTrigger>
                <IconButton
                  color="input-like"
                  icon="#lucide/split"
                  onPress={() => {
                    onShareTypeChange("divide");
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
          </div>

          <div>
            <ParticipantSplitAmountField
              amount={amount}
              shares={shares}
              participantId={participant.id}
              onChange={onExactAmountChange}
              aria-label={t`Amount for ${participant.name}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
interface ParticipantSplitAmountFieldProps {
  amount: number;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
  participantId: ExpenseUser;
  onChange: (value: number) => void;
  isReadOnly?: boolean;
  "aria-label"?: string;
}

function ParticipantSplitAmountField({
  amount,
  shares,
  participantId,
  onChange,
  isReadOnly = false,
  "aria-label": ariaLabel,
}: ParticipantSplitAmountFieldProps) {
  const amountsByParticipantId = calculateParticipantUnitAmounts(
    amount,
    shares,
  );
  const participantAmount = amountsByParticipantId[participantId];

  return (
    <CurrencyField
      value={participantAmount / 100}
      onChange={onChange}
      className="w-20"
      inputClassName="h-7 px-0 text-right border-t-0 border-x-0 rounded-none border-b"
      onFocus={(event) => {
        // Select all text
        const input = event.target as HTMLInputElement;
        input.select();
      }}
      inputMode="decimal"
      aria-label={ariaLabel}
    />
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

interface SharesWarningProps {
  amount: number;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
}

function SharesWarning({ amount, shares }: SharesWarningProps) {
  const { party } = useCurrentParty();
  const activeParticipants = Object.keys(shares);

  if (activeParticipants.length === 0) {
    return null;
  }

  const unitAmounts = calculateParticipantUnitAmounts(amount, shares);
  const totalUnitAmount = Object.values(unitAmounts).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const showWarning = totalUnitAmount - convertToUnits(amount) !== 0;

  if (!showWarning) {
    return null;
  }

  return (
    <Alert variant="default">
      <Icon name="#lucide/badge-info" />

      <AlertTitle>{t`Heads up!`}</AlertTitle>

      <AlertDescription>
        <p>
          <Trans>
            Shares sum up to{" "}
            <strong>
              {totalUnitAmount / 100} {party.currency}
            </strong>{" "}
            while the expense amount is{" "}
            <strong>
              {amount} {party.currency}
            </strong>
            .
          </Trans>
        </p>

        <p>
          <Trans>Please correct it before saving.</Trans>
        </p>
      </AlertDescription>
    </Alert>
  );
}

interface PhotosFieldProps {
  value: LocalPhoto[];
  onChange: (updater: Updater<LocalPhoto[]>) => void;
}

function PhotosField({ value, onChange }: PhotosFieldProps) {
  return (
    <div
      className="no-scrollbar -my-4 flex gap-4 overflow-x-auto py-4"
      onWheel={(e) => {
        // Translate scroll Y to X smoothly
        e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
      {value.length === 0 ? (
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-xl bg-slate-50 p-4 dark:bg-slate-900 dark:text-slate-500">
          <span className="text-center text-sm">
            <Trans>Upload or capture an image of your receipt</Trans>
          </span>
        </div>
      ) : null}

      {value.map((photo) => (
        <CurrentPhoto
          key={photo.url}
          photoUrl={photo.url}
          onRemove={() => {
            onChange((prevPhotos) =>
              prevPhotos.filter((current) => current !== photo),
            );
          }}
        />
      ))}
      <AddPhotoButton
        onPhoto={(photo) => {
          onChange((prevPhotos) => [...prevPhotos, ...photo]);
        }}
      />
    </div>
  );
}

interface LocalPhoto {
  blob: Blob;
  url: string;
}

interface AddPhotoButtonProps {
  onPhoto: (photos: LocalPhoto[]) => void;
}

function AddPhotoButton({ onPhoto }: AddPhotoButtonProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const localPhotos = Array.from(event.target.files ?? []).map((blob) => {
      const url = URL.createObjectURL(blob);
      return { url, blob };
    });

    onPhoto(localPhotos);

    // Reset the input value to allow the user to add more photos
    event.target.value = "";
  }

  function openCamera() {
    cameraInputRef.current?.click();
  }

  function openGallery() {
    galleryInputRef.current?.click();
  }

  return (
    <div className="flex h-32 w-max flex-shrink-0 flex-col gap-2">
      <Button
        onPress={openCamera}
        color="input-like"
        className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
      >
        <Icon name="#lucide/camera" className="h-5 w-5" />
        <Trans>Take photo</Trans>
      </Button>

      <Button
        onPress={openGallery}
        color="input-like"
        className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
      >
        <Icon name="#lucide/image-up" className="h-5 w-5" />
        <Trans>Upload photo</Trans>
      </Button>

      <input
        type="file"
        className="sr-only"
        accept="image/*"
        capture="environment"
        multiple={false}
        onChange={onFileChange}
        ref={cameraInputRef}
        hidden={true}
      />

      <input
        type="file"
        className="sr-only"
        accept="image/*"
        multiple={true}
        onChange={onFileChange}
        ref={galleryInputRef}
        hidden={true}
      />
    </div>
  );
}

interface CurrentPhotoProps {
  photoUrl: string;
  onRemove: () => void;
}

function CurrentPhoto({ photoUrl, onRemove }: CurrentPhotoProps) {
  return (
    <div className="relative flex-shrink-0">
      <Button
        color="transparent"
        aria-label={t`View photo`}
        className="h-auto w-auto p-0"
      >
        <img
          src={photoUrl}
          className="block h-32 w-32 rounded-xl object-cover"
          alt=""
          onContextMenu={(e) => e.preventDefault()}
        />
      </Button>
      <Button
        color="slate"
        className="absolute -right-2 -top-2 h-auto w-auto rounded-full p-1"
        onPress={onRemove}
      >
        <Icon
          name="#lucide/x"
          className="h-4 w-4"
          aria-label={t`Remove photo`}
        />
      </Button>
    </div>
  );
}
