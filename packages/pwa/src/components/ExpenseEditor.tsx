import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import type { ExpenseUser } from "#src/lib/expenses.js";
import { useForm, useStore, type Updater } from "@tanstack/react-form";
import { BackButton } from "./BackButton";
import {
  Suspense,
  use,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";
import { IconButton } from "#src/ui/IconButton.js";
import { useLingui } from "@lingui/react";
import { validateExpenseTitle } from "#src/lib/validation.js";
import { AppNumberField, AppTextField } from "#src/ui/TextField.js";
import { CurrencyField } from "./CurrencyField";
import { convertToUnits } from "#src/lib/expenses.js";
import { toast } from "sonner";
import Dinero from "dinero.js";
import { useExpenseParticipants } from "#src/hooks/useExpenseParticipants.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { Checkbox } from "#src/ui/Checkbox.tsx";
import type { PartyParticipant } from "#src/models/party.ts";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";
import { Tooltip, TooltipTrigger } from "#src/ui/Tooltip.tsx";
import { AppDatePicker } from "#src/ui/DatePicker.tsx";
import {
  fromDate,
  getLocalTimeZone,
  type ZonedDateTime,
} from "@internationalized/date";
import { Alert, AlertDescription, AlertTitle } from "#src/ui/Alert.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { Button } from "#src/ui/Button.tsx";
import { getExpenseUnitShares } from "#src/models/expense.ts";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { Skeleton } from "#src/ui/Skeleton.tsx";
import type { MediaFile } from "#src/models/media.ts";
import { useMediaFileActions } from "#src/hooks/useMediaFileActions.ts";
import { compressionPresets } from "#src/lib/imageCompression.ts";
import { MediaGalleryContext } from "./MediaGalleryContext";

export interface ExpenseEditorFormValues {
  name: string;
  amount: number;
  paidAt: Date;
  paidBy: ExpenseUser;
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>;
  photos: MediaFile["id"][];
}

export interface ExpenseEditorRef {
  setValues: (values: ExpenseEditorFormValues) => void;
}

interface ExpenseEditorProps {
  title: string;
  onSubmit: (values: ExpenseEditorFormValues) => void;
  onChange?: (
    previousValues: ExpenseEditorFormValues,
    currentValues: ExpenseEditorFormValues,
  ) => void;
  defaultValues: ExpenseEditorFormValues;
  ref?: React.RefObject<ExpenseEditorRef | null>;
  autoFocus?: boolean;
  goBackFallbackOptions: React.ComponentProps<
    typeof BackButton
  >["fallbackOptions"];
  /** Optional callback to view a photo at a given index (for route-based gallery) */
  onViewPhoto?: (index: number) => void;
}

export function ExpenseEditor({
  title,
  onSubmit,
  defaultValues,
  onChange,
  ref,
  autoFocus = true,
  goBackFallbackOptions,
  onViewPhoto,
}: ExpenseEditorProps) {
  const { i18n } = useLingui();
  const unsortedParticipants = useExpenseParticipants({
    paidBy: {
      [defaultValues.paidBy]: 1,
    },
    shares: defaultValues.shares,
  });
  const participants = [...unsortedParticipants].sort((a, b) =>
    a.name.localeCompare(b.name, i18n.locale),
  );

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

  const isReceivingUpdatesRef = useRef(false);
  const focusedFieldRef = useRef<keyof ExpenseEditorFormValues | null>(null);

  function createFieldFocusHandlers(field: {
    name: string;
    handleBlur: () => void;
  }) {
    return {
      onFocus: () => {
        focusedFieldRef.current = field.name as keyof ExpenseEditorFormValues;
      },
      onBlur: () => {
        focusedFieldRef.current = null;
        field.handleBlur();
      },
    };
  }

  useImperativeHandle(
    ref,
    () => ({
      setValues: (values) => {
        isReceivingUpdatesRef.current = true;
        const currentFocusedField = focusedFieldRef.current;

        for (const key in values) {
          const isFocused = key === currentFocusedField;

          if (isFocused) {
            // If the field is focused, we don't want to update the value
            continue;
          }

          form.setFieldValue(
            key as keyof ExpenseEditorFormValues,
            values[key as keyof ExpenseEditorFormValues],
          );
          void form.validateField(
            key as keyof ExpenseEditorFormValues,
            "server",
          );
        }

        isReceivingUpdatesRef.current = false;
      },
    }),
    [form],
  );

  useEffect(() => {
    if (!onChange) {
      return;
    }

    return form.store.subscribe(({ currentVal, prevVal }) => {
      if (isReceivingUpdatesRef.current) {
        return;
      }

      onChange(prevVal.values, currentVal.values);
    });
  }, [form.store, onChange]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={goBackFallbackOptions} />
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">{title}</h1>
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
                  className="flex-shrink-0"
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
          void form.handleSubmit();
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
                  onViewPhoto={onViewPhoto}
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
                errorMessage={field.state.meta.errors?.join(", ")}
                isInvalid={
                  field.state.meta.isTouched &&
                  field.state.meta.errors?.length > 0
                }
                // eslint-disable-next-line jsx-a11y/no-autofocus -- We want to auto focus the title field when creating a new expense
                autoFocus={autoFocus}
                className="col-span-2"
                data-presence-element-id="title"
                data-presence-offset-top={6}
                data-presence-offset-left={-10}
                {...createFieldFocusHandlers(field)}
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
                calculator
                name={field.name}
                label={t`Amount`}
                value={field.state.value}
                onChange={(value) => {
                  field.handleChange(value || 0);
                }}
                onBlur={createFieldFocusHandlers(field).onBlur}
                errorMessage={field.state.meta.errors?.join(", ")}
                isInvalid={
                  field.state.meta.isTouched &&
                  field.state.meta.errors?.length > 0
                }
                className="col-span-2"
                onFocus={(event) => {
                  const input = event.target as HTMLInputElement;
                  input.select();
                  focusedFieldRef.current =
                    field.name as keyof ExpenseEditorFormValues;
                }}
                inputMode="decimal"
                data-presence-element-id="amount"
                data-presence-offset-top={6}
                data-presence-offset-left={-10}
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
                data-presence-element-id="paidBy"
                data-presence-offset-top={6}
                data-presence-offset-left={-10}
                {...createFieldFocusHandlers(field)}
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
              <AppDatePicker<ZonedDateTime>
                label={t`Date`}
                value={fromDate(field.state.value, getLocalTimeZone())}
                granularity="day"
                onChange={(value) => {
                  if (value) {
                    field.handleChange(value.toDate());
                  }
                }}
                data-presence-element-id="paidAt"
                data-presence-offset-top={6}
                data-presence-offset-left={-10}
                {...createFieldFocusHandlers(field)}
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

        <div className="h-16 flex-shrink-0" />
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
    <div
      data-presence-element-id={`participant-${participant.id}`}
      className="grid h-10 grid-cols-[4fr_6fr] items-center justify-between rounded-lg border border-accent-500 bg-white pr-3 dark:border-accent-700 dark:bg-accent-900"
    >
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
          <div className="flex flex-1 items-center justify-center gap-1">
            {participantShare.type === "divide" ? (
              <>
                <IconButton
                  icon="#lucide/minus"
                  className="h-7 w-7"
                  iconClassName="size-3.5"
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
                  className="h-7 w-7"
                  iconClassName="size-3.5"
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
                  iconClassName="size-3.5"
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
  "aria-label"?: string;
}

function ParticipantSplitAmountField({
  amount,
  shares,
  participantId,
  onChange,
  "aria-label": ariaLabel,
}: ParticipantSplitAmountFieldProps) {
  const amountsByParticipantId = calculateParticipantUnitAmounts(
    amount,
    shares,
  );
  const participantAmount = amountsByParticipantId[participantId];

  return (
    <CurrencyField
      calculator
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
  const amountInUnits = convertToUnits(amount);

  return getExpenseUnitShares({
    shares,
    paidBy: { noop: amountInUnits },
  });
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
  value: MediaFile["id"][];
  onChange: (updater: Updater<MediaFile["id"][]>) => void;
  onViewPhoto?: (index: number) => void;
}

function PhotosField({ value, onChange, onViewPhoto }: PhotosFieldProps) {
  return (
    <div
      className="no-scrollbar -my-4 flex gap-4 overflow-x-auto py-4"
      onWheel={(e) => {
        // Translate scroll Y to X smoothly
        e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
      {value.length === 0 ? (
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-xl bg-accent-50 p-4 dark:bg-accent-900 dark:text-accent-500">
          <span className="text-center text-sm">
            <Trans>Upload or capture an image of your receipt</Trans>
          </span>
        </div>
      ) : null}

      {value.map((photoId, index) => (
        <Suspense key={photoId} fallback={<Skeleton className="h-32 w-32" />}>
          <CurrentPhoto
            key={photoId}
            photoId={photoId}
            onRemove={() => {
              onChange((prevPhotos) =>
                prevPhotos.filter((current) => current !== photoId),
              );
            }}
            onViewPhoto={onViewPhoto ? () => onViewPhoto(index) : undefined}
          />
        </Suspense>
      ))}
      <AddPhotoButton
        onPhoto={(photo) => {
          onChange((prevPhotos) => [...prevPhotos, ...photo]);
        }}
      />
    </div>
  );
}

interface AddPhotoButtonProps {
  onPhoto: (photos: MediaFile["id"][]) => void;
}

function AddPhotoButton({ onPhoto }: AddPhotoButtonProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { createMediaFile } = useMediaFileActions();

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const toastId: string | number = toast.loading(t`Uploading...`);

    try {
      const photoIds = await Promise.all(
        Array.from(event.target.files ?? []).map(async (blob) => {
          const [mediaFileId] = await createMediaFile(
            blob,
            {},
            compressionPresets.balanced,
          );
          return mediaFileId;
        }),
      );

      onPhoto(photoIds);

      toast.dismiss(toastId);
    } catch (error) {
      console.error(error);
      toast.error(t`Failed to upload, please try again`, {
        id: toastId,
      });
    }

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
        onChange={(event) => void onFileChange(event)}
        ref={cameraInputRef}
        hidden={true}
      />

      <input
        type="file"
        className="sr-only"
        accept="image/*"
        multiple={true}
        onChange={(event) => void onFileChange(event)}
        ref={galleryInputRef}
        hidden={true}
      />
    </div>
  );
}

interface CurrentPhotoProps {
  photoId: string;
  onRemove: () => void;
  onViewPhoto?: () => void;
}

function CurrentPhoto({ photoId, onRemove, onViewPhoto }: CurrentPhotoProps) {
  const { url } = useMediaFile(photoId);
  const { open } = use(MediaGalleryContext);

  function handleViewPhoto() {
    if (onViewPhoto) {
      onViewPhoto();
    } else {
      // Fall back to context-based gallery for routes that don't use route-based gallery
      open({ items: [{ src: url }], index: 0 });
    }
  }

  return (
    <div className="relative flex-shrink-0">
      <Button
        color="transparent"
        aria-label={t`View photo`}
        className="h-auto w-auto p-0"
        onPress={handleViewPhoto}
      >
        <img
          src={url}
          className="block h-32 w-32 rounded-xl object-cover"
          alt=""
          onContextMenu={(e) => e.preventDefault()}
        />
      </Button>
      <Button
        color="input-like"
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
