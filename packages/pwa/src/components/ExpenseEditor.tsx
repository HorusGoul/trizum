import { trackEvent } from "#src/lib/analytics.ts";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import type { ExpenseUser } from "#src/lib/expenses.js";
import { useForm, useStore, type Updater } from "@tanstack/react-form";
import { BackButton } from "./BackButton";
import { Suspense, use, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { IconButton } from "@trizum/ui/IconButton";
import { useLingui } from "@lingui/react";
import { validateExpenseTitle } from "#src/lib/validation.js";
import { AppNumberField, AppTextField } from "@trizum/ui/fields/TextField";
import { CurrencyField } from "./CurrencyField";
import { convertToUnits } from "#src/lib/expenses.js";
import { toast } from "sonner";
import { useExpenseParticipants } from "#src/hooks/useExpenseParticipants.ts";
import { Checkbox } from "@trizum/ui/Checkbox";
import type { PartyParticipant } from "#src/models/party.ts";
import { AppSelect, SelectItem } from "@trizum/ui/Select";
import { Tooltip, TooltipTrigger } from "@trizum/ui/Tooltip";
import { AppDatePicker } from "@trizum/ui/DatePicker";
import { fromDate, getLocalTimeZone, type ZonedDateTime } from "@internationalized/date";
import { Icon } from "@trizum/ui/Icon";
import { Button } from "@trizum/ui/Button";
import { MenuTrigger, Popover } from "react-aria-components";
import { Menu, MenuItem } from "@trizum/ui/Menu";
import { Switch } from "@trizum/ui/Switch";
import { usePartyList } from "#src/hooks/usePartyList.ts";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { Skeleton } from "@trizum/ui/Skeleton";
import type { MediaFile } from "#src/models/media.ts";
import { getImageUploadErrorMessage, useMediaFileActions } from "#src/hooks/useMediaFileActions.ts";
import {
  compressionPresets,
  ImageProcessingError,
  imageCaptureAccept,
  imageUploadAccept,
} from "#src/lib/imageCompression.ts";
import {
  getNativeCameraCaptureFile,
  isNativeCameraCancel,
  shouldUseNativeCameraCapture,
} from "#src/lib/nativeCamera.ts";
import { getLogger } from "#src/lib/log.ts";
import { MediaGalleryContext } from "@trizum/ui/MediaGalleryContext";
import type { AppFormApi } from "#src/lib/reactFormTypes.ts";
import {
  type ExpenseEditorFormValues,
  type ExpenseEditorMode,
  getExpenseEditorValidationResult,
  getExpenseEditorUnitShares,
  type ExpenseEditorShares,
} from "#src/lib/expenseEditor.ts";
import { ExpenseEditorValidationStatus } from "./ExpenseEditorValidationStatus.tsx";
import { ExpenseCurrencyFields } from "./ExpenseCurrencyFields";
import { cn } from "@trizum/ui/utils";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { useAppSession } from "#src/lib/auth-client.ts";
import { getReceiptDraftValues } from "#src/lib/receiptSuggestions.ts";
import { applyReceiptSuggestions } from "#src/lib/receiptSuggestionEdits.ts";
import { useExchangeRates } from "#src/hooks/useExchangeRates.ts";
import type { CurrencyCode } from "#src/lib/money.ts";
import { ReceiptSuggestionsSheet } from "./ReceiptSuggestionsSheet";
import { useReceiptSuggestions, type ReceiptImage } from "./useReceiptSuggestions";

import { CurrencyContext } from "./CurrencyContext";
import {
  getExpenseEditorCurrencyAmount,
  getExpenseEditorDraftValues,
  getExpenseEditorStoredValues,
} from "#src/lib/expenseEditorCurrency.ts";

export type { ExpenseEditorFormValues };

export interface ExpenseEditorRef {
  setValues: (values: ExpenseEditorFormValues) => void;
}

const logger = getLogger("components", "ExpenseEditor");

interface ExpenseEditorProps {
  mode: ExpenseEditorMode;
  isPrefilled?: boolean;
  title: string;
  onSubmit: (values: ExpenseEditorFormValues) => void | Promise<void>;
  onChange?: (
    previousValues: ExpenseEditorFormValues,
    currentValues: ExpenseEditorFormValues,
  ) => void;
  defaultValues: ExpenseEditorFormValues;
  ref?: React.RefObject<ExpenseEditorRef | null>;
  autoFocus?: boolean;
  goBackFallbackOptions: React.ComponentProps<typeof BackButton>["fallbackOptions"];
  /** Optional callback to view a photo at a given index (for route-based gallery) */
  onViewPhoto?: (index: number) => void;
  activeCalculatorId?: string;
  onOpenCalculator?: (calculatorId: string) => void;
  onCloseCalculator?: () => void;
}

type ExpenseEditorFormApi = AppFormApi<ExpenseEditorFormValues>;

type FieldFocusHandlersFactory = (field: { name: string; handleBlur: () => void }) => {
  onFocus: () => void;
  onBlur: () => void;
};

export function ExpenseEditor({
  mode,
  isPrefilled = false,
  title,
  onSubmit,
  defaultValues,
  onChange,
  ref,
  autoFocus = true,
  goBackFallbackOptions,
  onViewPhoto,
  activeCalculatorId,
  onOpenCalculator,
  onCloseCalculator,
}: ExpenseEditorProps) {
  const { i18n } = useLingui();
  const partyCurrency = use(CurrencyContext);
  const { partyList, setAutoOpenCalculator } = usePartyList();
  const autoOpenCalculator = partyList.autoOpenCalculator ?? false;
  const saveInFlightRef = useRef(false);
  const savedValuesRef = useRef(defaultValues);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = useState(false);

  const unsortedParticipants = useExpenseParticipants({
    paidBy: {
      [defaultValues.paidBy]: 1,
    },
    shares: defaultValues.shares,
  });

  const participants = unsortedParticipants.slice();
  participants.sort((a, b) => a.name.localeCompare(b.name, i18n.locale));

  const formDefaultValues: ExpenseEditorFormValues = getExpenseEditorDraftValues({
    ...defaultValues,
    originalAmount: defaultValues.originalAmount ?? null,
    exchangeRate: defaultValues.exchangeRate ?? null,
    shares:
      defaultValues.shares ||
      participants.reduce<Record<ExpenseUser, { type: "divide" | "exact"; value: number }>>(
        (acc, { id }) => {
          acc[id] = { type: "divide" as const, value: 1 };

          return acc;
        },
        {},
      ),
  });

  const form = useForm({
    defaultValues: formDefaultValues,
    onSubmit: async ({ value }) => {
      if (saveInFlightRef.current) {
        return;
      }

      const submissionValidation = getExpenseEditorValidationResult(
        { ...value, amount: getExpenseEditorCurrencyAmount(value) },
        {
          isDirty: true,
          mode,
        },
      );

      if (submissionValidation.status === "error") {
        setIsValidationDialogOpen(true);

        return;
      }

      if (submissionValidation.status !== "valid" && submissionValidation.status !== "warning") {
        return;
      }

      saveInFlightRef.current = true;

      await Promise.resolve()
        .then(() => onSubmit(getExpenseEditorStoredValues(value, savedValuesRef.current)))
        .finally(() => {
          saveInFlightRef.current = false;
        });
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
  const originalAmount = useStore(form.store, (state) => state.values.originalAmount);
  const exchangeRate = useStore(form.store, (state) => state.values.exchangeRate);
  const currency = originalAmount?.currency ?? partyCurrency;
  const participantAmount = getExpenseEditorCurrencyAmount({ amount, shares, originalAmount });
  const name = useStore(form.store, (state) => state.values.name);
  const paidBy = useStore(form.store, (state) => state.values.paidBy);
  const photos = useStore(form.store, (state) => state.values.photos);
  const isDirty = useStore(form.store, (state) => state.isDirty);

  const validation = getExpenseEditorValidationResult(
    { amount: participantAmount, name, paidBy, shares, originalAmount, exchangeRate },
    { isDirty, isPrefilled, mode },
  );

  const isReceivingUpdatesRef = useRef(false);
  const focusedFieldRef = useRef<keyof ExpenseEditorFormValues | null>(null);
  const previousValuesRef = useRef(form.store.state.values);

  function createFieldFocusHandlers(field: { name: string; handleBlur: () => void }) {
    return {
      onFocus: () => {
        // SAFETY: Only this form's registered field names are passed to createFieldFocusHandlers.
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
        savedValuesRef.current = values;
        values = getExpenseEditorDraftValues(values);
        isReceivingUpdatesRef.current = true;
        const currentFocusedField = focusedFieldRef.current;

        for (const key in values) {
          const isFocused = key === currentFocusedField;

          if (isFocused) {
            // If the field is focused, we don't want to update the value
            continue;
          }

          // SAFETY: keys comes from this form's values object; Object.keys erases the known form-field key union.
          form.setFieldValue(
            key as keyof ExpenseEditorFormValues,
            values[key as keyof ExpenseEditorFormValues],
          );
          // SAFETY: keys comes from this form's values object; Object.keys erases the known form-field key union.
          void form.validateField(key as keyof ExpenseEditorFormValues, "server");
        }

        isReceivingUpdatesRef.current = false;
      },
    }),
    [form],
  );

  useEffect(() => {
    previousValuesRef.current = form.store.state.values;

    const subscription = form.store.subscribe((currentState) => {
      const previousValues = previousValuesRef.current;
      previousValuesRef.current = currentState.values;

      if (
        previousValues.amount !== currentState.values.amount ||
        previousValues.name !== currentState.values.name ||
        previousValues.paidBy !== currentState.values.paidBy ||
        previousValues.shares !== currentState.values.shares
      ) {
        setIsValidationDialogOpen(false);
      }

      if (isReceivingUpdatesRef.current || !onChange) {
        return;
      }

      onChange(
        getExpenseEditorStoredValues(previousValues, savedValuesRef.current),
        getExpenseEditorStoredValues(currentState.values, savedValuesRef.current),
      );
    });

    return () => subscription.unsubscribe();
  }, [form.store, onChange]);

  return (
    <div className="flex min-h-full flex-col">
      <ExpenseEditorHeader
        autoOpenCalculator={autoOpenCalculator}
        formId={formId}
        goBackFallbackOptions={goBackFallbackOptions}
        onToggleAutoOpenCalculator={() => {
          setAutoOpenCalculator(!autoOpenCalculator);
          trackEvent(
            autoOpenCalculator ? "calculator_auto_open_disabled" : "calculator_auto_open_enabled",
          );
        }}
        submitButton={
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) =>
              canSubmit ? (
                <Suspense fallback={null}>
                  <IconButton
                    icon="lucide.check"
                    aria-label={isSubmitting ? t`Submitting...` : t`Save`}
                    type="submit"
                    form={formId}
                    isDisabled={isSubmitting}
                    className="shrink-0"
                  />
                </Suspense>
              ) : null
            }
          </form.Subscribe>
        }
        title={title}
      />

      <CurrencyContext value={currency}>
        <ExpenseEditorValidationStatus
          isOpen={isValidationDialogOpen}
          onOpenChange={setIsValidationDialogOpen}
          validation={validation}
        />
      </CurrencyContext>

      {/* oxlint-disable react-doctor/tanstack-form-on-submit-requires-prevent-default -- preventDefault runs before the duplicate-submit guard and handleSubmit. */}
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();

          if (form.state.isSubmitting || saveInFlightRef.current) {
            return;
          }

          void form.handleSubmit();
        }}
        className="container mt-4 flex flex-col px-4"
      >
        <ExpenseDetailsFields
          activeCalculatorId={activeCalculatorId}
          autoOpenCalculator={autoOpenCalculator}
          createFieldFocusHandlers={createFieldFocusHandlers}
          form={form}
          onCloseCalculator={onCloseCalculator}
          onOpenCalculator={onOpenCalculator}
          onViewPhoto={onViewPhoto}
          participants={participants}
          photos={photos}
          shouldAutoFocus={autoFocus}
        />
        <CurrencyContext value={currency}>
          <ExpenseParticipantsSection
            activeCalculatorId={activeCalculatorId}
            amount={participantAmount}
            autoOpenCalculator={autoOpenCalculator}
            calculatorAttachmentPhotoIds={photos}
            onCloseCalculator={onCloseCalculator}
            onIncludeAllChange={handleIncludeAllChange}
            onOpenCalculator={onOpenCalculator}
            onSharesChange={(shares) => form.setFieldValue("shares", shares)}
            participants={participants}
            shares={shares}
          />
        </CurrencyContext>

        <div className="h-[calc(4rem+var(--calculator-mobile-scroll-allowance,0px))] shrink-0 transition-[height] duration-200 ease-out md:h-16" />
      </form>
      {/* oxlint-enable react-doctor/tanstack-form-on-submit-requires-prevent-default */}
    </div>
  );
}

function ExpenseEditorHeader({
  autoOpenCalculator,
  formId,
  goBackFallbackOptions,
  onToggleAutoOpenCalculator,
  submitButton,
  title,
}: {
  autoOpenCalculator: boolean;
  formId: string;
  goBackFallbackOptions: React.ComponentProps<typeof BackButton>["fallbackOptions"];
  onToggleAutoOpenCalculator: () => void;
  submitButton: React.ReactNode;
  title: string;
}) {
  return (
    <div className="mt-safe container flex h-16 items-center px-2">
      <BackButton fallbackOptions={goBackFallbackOptions} />
      <h1 className="max-h-12 truncate px-4 text-xl font-medium">{title}</h1>
      <div className="flex-1" />
      <MenuTrigger>
        <IconButton icon="lucide.ellipsis-vertical" aria-label={t`Menu`} className="shrink-0" />
        <Popover placement="bottom end">
          <Menu>
            <MenuItem onAction={onToggleAutoOpenCalculator}>
              <Icon icon="lucide.calculator" width={20} height={20} className="mr-3 self-start" />
              <div className="mr-3 flex flex-col">
                <span className="leading-none">
                  <Trans>Auto-open calculator</Trans>
                </span>
                <span className="mt-2 text-sm leading-none opacity-80">
                  <Trans>Open calculator when focusing amount fields</Trans>
                </span>
              </div>
              <Switch
                isSelected={autoOpenCalculator}
                onChange={onToggleAutoOpenCalculator}
                isReadOnly
              />
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      {submitButton}
    </div>
  );
}

function ExpenseDetailsFields({
  activeCalculatorId,
  autoOpenCalculator,
  createFieldFocusHandlers,
  form,
  onCloseCalculator,
  onOpenCalculator,
  onViewPhoto,
  participants,
  photos,
  shouldAutoFocus,
}: {
  activeCalculatorId?: string;
  autoOpenCalculator: boolean;
  createFieldFocusHandlers: FieldFocusHandlersFactory;
  form: ExpenseEditorFormApi;
  onCloseCalculator?: () => void;
  onOpenCalculator?: (calculatorId: string) => void;
  onViewPhoto?: (index: number) => void;
  participants: PartyParticipant[];
  photos: MediaFile["id"][];
  shouldAutoFocus: boolean;
}) {
  return (
    <div className="grid grid-cols-2 items-end gap-x-2 gap-y-4">
      <div className="col-span-2">
        <form.Field name="photos">
          {(field) => (
            <PhotosField
              form={form}
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
            isInvalid={field.state.meta.isTouched && field.state.meta.errors?.length > 0}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- We want to auto focus the title field when creating a new expense
            autoFocus={shouldAutoFocus}
            className="col-span-2"
            data-presence-element-id="title"
            data-presence-offset-top={6}
            data-presence-offset-left={-10}
            {...createFieldFocusHandlers(field)}
          />
        )}
      </form.Field>

      <ExpenseCurrencyFields
        form={form}
        activeCalculatorId={activeCalculatorId}
        autoOpenCalculator={autoOpenCalculator}
        onCloseCalculator={onCloseCalculator}
        onOpenCalculator={onOpenCalculator}
        photos={photos}
        createFieldFocusHandlers={createFieldFocusHandlers}
      />

      <form.Field name="paidBy">
        {(field) => (
          <AppSelect<PartyParticipant>
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
              <SelectItem key={participant.id} value={participant} textValue={participant.name}>
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
  );
}

export function ExpenseParticipantsSection({
  activeCalculatorId,
  amount,
  autoOpenCalculator,
  calculatorAttachmentPhotoIds,
  className,
  enableCalculator = true,
  onCloseCalculator,
  onIncludeAllChange,
  onOpenCalculator,
  onSharesChange,
  participants,
  shares,
}: {
  activeCalculatorId?: string;
  amount: number;
  autoOpenCalculator: boolean;
  calculatorAttachmentPhotoIds: MediaFile["id"][];
  className?: string;
  enableCalculator?: boolean;
  onCloseCalculator?: () => void;
  onIncludeAllChange?: (include: boolean) => void;
  onOpenCalculator?: (calculatorId: string) => void;
  onSharesChange: ParticipantItemProps["onSharesChange"];
  participants: PartyParticipant[];
  shares: ParticipantItemProps["shares"];
}) {
  const shareCount = Object.keys(shares).length;
  const currency = use(CurrencyContext);

  return (
    <div className={cn("mt-4 flex flex-col gap-2", className)}>
      {onIncludeAllChange ? (
        <div className="flex items-center justify-between border-x border-transparent px-3">
          <Checkbox
            isSelected={shareCount === participants.length}
            isIndeterminate={shareCount > 0 && shareCount < participants.length}
            onChange={onIncludeAllChange}
          >
            {t`Include all`}
          </Checkbox>
          <span className="text-accent-600 dark:text-accent-300 text-xs font-medium">
            {currency}
          </span>
        </div>
      ) : null}

      <div className="space-y-2">
        {participants.map((participant) => (
          <ParticipantItem
            key={participant.id}
            participant={participant}
            amount={amount}
            shares={shares}
            activeCalculatorId={activeCalculatorId}
            autoOpenCalculator={autoOpenCalculator}
            calculatorAttachmentPhotoIds={calculatorAttachmentPhotoIds}
            enableCalculator={enableCalculator}
            onCloseCalculator={onCloseCalculator}
            onOpenCalculator={onOpenCalculator}
            onSharesChange={onSharesChange}
          />
        ))}
      </div>
    </div>
  );
}

interface ParticipantItemProps {
  amount: number;
  participant: PartyParticipant;
  shares: ExpenseEditorShares;
  activeCalculatorId?: string;
  autoOpenCalculator?: boolean;
  calculatorAttachmentPhotoIds: MediaFile["id"][];
  enableCalculator?: boolean;
  onCloseCalculator?: () => void;
  onOpenCalculator?: (calculatorId: string) => void;
  onSharesChange: (shares: ExpenseEditorShares) => void;
}

function ParticipantItem({
  amount,
  shares,
  participant,
  activeCalculatorId,
  autoOpenCalculator,
  calculatorAttachmentPhotoIds,
  enableCalculator,
  onCloseCalculator,
  onOpenCalculator,
  onSharesChange,
}: ParticipantItemProps) {
  const participantShare = shares[participant.id];

  function updateShares(shares: ExpenseEditorShares) {
    onSharesChange(shares);
  }

  function onShareTypeChange(value: string) {
    const newShares = {
      ...shares,
    };

    // SAFETY: The radio group contains only divide and exact items; its callback widens their values to strings.
    const newType = value as "divide" | "exact";

    if (newType === "exact") {
      const amountsByParticipantId = calculateParticipantUnitAmounts(amount, shares);

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
  const participantName = participant.name;

  return (
    <div
      data-presence-element-id={`participant-${participant.id}`}
      className="border-accent-500 dark:border-accent-700 dark:bg-accent-900 grid h-10 grid-cols-[minmax(0,1fr)_auto] items-center justify-between rounded-lg border bg-white pr-3"
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
                  icon="lucide.minus"
                  aria-label={t({ message: `Decrease shares for ${participantName}` })}
                  className="h-7 w-7"
                  iconClassName="size-3.5"
                  onPress={onDecrementSharesPress}
                  color="input-like"
                />
                <AppNumberField
                  className="h-7 w-7 shrink-0"
                  inputClassName="h-7 px-0 text-center"
                  value={participantShare.value}
                  maxValue={99}
                  minValue={0}
                  step={1}
                  inputMode="numeric"
                  onFocus={(event) => {
                    // Select all text
                    const input = event.currentTarget;

                    if (input instanceof HTMLInputElement) input.select();
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
                  aria-label={t({ message: `Shares for ${participantName}` })}
                />
                <IconButton
                  icon="lucide.plus"
                  aria-label={t({ message: `Increase shares for ${participantName}` })}
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
                  icon="lucide.split"
                  aria-label={t`Switch to fractional split`}
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

          <div className={enableCalculator ? "pl-8" : undefined}>
            <ParticipantSplitAmountField
              amount={amount}
              shares={shares}
              participantId={participant.id}
              activeCalculatorId={activeCalculatorId}
              autoOpenCalculator={autoOpenCalculator}
              calculatorAttachmentPhotoIds={calculatorAttachmentPhotoIds}
              enableCalculator={enableCalculator}
              onCloseCalculator={onCloseCalculator}
              onOpenCalculator={onOpenCalculator}
              onChange={onExactAmountChange}
              aria-label={t({ message: `Amount for ${participantName}` })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ParticipantSplitAmountFieldProps {
  amount: number;
  shares: ExpenseEditorShares;
  participantId: ExpenseUser;
  activeCalculatorId?: string;
  autoOpenCalculator?: boolean;
  calculatorAttachmentPhotoIds: MediaFile["id"][];
  enableCalculator?: boolean;
  onCloseCalculator?: () => void;
  onOpenCalculator?: (calculatorId: string) => void;
  onChange: (value: number) => void;
  "aria-label"?: string;
}

function ParticipantSplitAmountField({
  amount,
  shares,
  participantId,
  activeCalculatorId,
  autoOpenCalculator,
  calculatorAttachmentPhotoIds,
  enableCalculator = true,
  onCloseCalculator,
  onOpenCalculator,
  onChange,
  "aria-label": ariaLabel,
}: ParticipantSplitAmountFieldProps) {
  const amountsByParticipantId = calculateParticipantUnitAmounts(amount, shares);
  const participantAmount = amountsByParticipantId[participantId];

  return (
    <CurrencyField
      calculator={enableCalculator}
      calculatorId={`share-${participantId}`}
      calculatorAttachmentPhotoIds={calculatorAttachmentPhotoIds}
      activeCalculatorId={activeCalculatorId}
      autoOpenCalculator={autoOpenCalculator}
      calculatorButtonClassName="absolute bottom-0.5 -left-8 h-6 w-6"
      onCloseCalculator={onCloseCalculator}
      onOpenCalculator={onOpenCalculator}
      value={participantAmount / 100}
      minValue={0}
      onChange={onChange}
      className="w-20"
      inputClassName="h-7 px-0 text-right border-t-0 border-x-0 rounded-none border-b"
      onFocus={(event) => {
        // Select all text
        const input = event.currentTarget;
        input.select();
      }}
      inputMode="decimal"
      aria-label={ariaLabel}
      data-presence-proxy-element-id={`participant-${participantId}`}
    />
  );
}

function calculateParticipantUnitAmounts(
  amount: number,
  shares: Record<ExpenseUser, { type: "divide" | "exact"; value: number }>,
) {
  return getExpenseEditorUnitShares(amount, shares);
}

interface PhotosFieldProps {
  form: ExpenseEditorFormApi;
  value: MediaFile["id"][];
  onChange: (updater: Updater<MediaFile["id"][]>) => void;
  onViewPhoto?: (index: number) => void;
}

function PhotosField({ form, value, onChange, onViewPhoto }: PhotosFieldProps) {
  const { party } = useCurrentParty();
  const session = useAppSession();
  const userId = session.data?.user.id;
  const isBoosted = Object.keys(party.boost ?? {}).length > 0;

  const currency =
    useStore(form.store, (state) => state.values.originalAmount?.currency) ?? party.currency;

  return (
    <ReceiptPhotosField
      key={JSON.stringify([party.id, userId, isBoosted, party.currency, currency])}
      form={form}
      value={value}
      onChange={onChange}
      onViewPhoto={onViewPhoto}
      partyId={party.id}
      partyCurrency={party.currency}
      userId={userId}
      isBoosted={isBoosted}
    />
  );
}

function ReceiptPhotosField({
  form,
  value,
  onChange,
  onViewPhoto,
  partyId,
  partyCurrency,
  userId,
  isBoosted,
}: PhotosFieldProps & {
  partyId: string;
  partyCurrency: CurrencyCode;
  userId: string | undefined;
  isBoosted: boolean;
}) {
  const rates = useExchangeRates(partyCurrency);

  const current = useStore(form.store, (state) =>
    getReceiptDraftValues(state.values, partyCurrency),
  );

  const { analyze, result, suggestions, dismiss, scanningPhotoIds } = useReceiptSuggestions({
    partyId,
    userId,
    isBoosted,
    partyCurrency,
    current,
    photoIds: value,
    getValues: () => getReceiptDraftValues(form.state.values, partyCurrency),
    getPhotoIds: () => form.state.values.photos,
  });

  return (
    <>
      <div
        className="no-scrollbar -my-4 flex gap-4 overflow-x-auto py-4"
        onWheel={(e) => {
          // Translate scroll Y to X smoothly
          e.currentTarget.scrollLeft += e.deltaY;
        }}
      >
        {value.length === 0 ? (
          <div className="bg-accent-50 dark:bg-accent-900 dark:text-accent-500 flex h-32 w-32 flex-col items-center justify-center rounded-xl p-4">
            <span className="text-center text-sm">
              <Trans>Upload or capture an image of your receipt</Trans>
            </span>
          </div>
        ) : null}

        {value.map((photoId, index) => (
          <div key={photoId} className="relative isolate shrink-0">
            <Suspense fallback={<Skeleton className="h-32 w-32" />}>
              <CurrentPhoto
                key={photoId}
                photoId={photoId}
                onRemove={() => {
                  onChange((prevPhotos) => prevPhotos.filter((current) => current !== photoId));
                  trackEvent("receipt_attachment_removed");
                }}
                onViewPhoto={onViewPhoto ? () => onViewPhoto(index) : undefined}
              />
            </Suspense>
            {scanningPhotoIds.includes(photoId) ? (
              <div
                aria-hidden="true"
                className="receipt-scan-border pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
              />
            ) : null}
          </div>
        ))}
        <AddPhotoButton
          onPhoto={(photo, images) => {
            onChange((prevPhotos) => [...prevPhotos, ...photo]);
            analyze(images);
          }}
        />
      </div>
      {result && suggestions ? (
        <ReceiptSuggestionsSheet
          key={result.photoId}
          receipt={result.receipt}
          partyCurrency={partyCurrency}
          suggestions={suggestions}
          onDiscard={() => dismiss(false)}
          onAccept={(values) => {
            const applied = applyReceiptSuggestions(form, {
              receipt: result.receipt,
              baseline: result.baseline,
              partyCurrency,
              rates,
              selected: values,
            });

            dismiss(applied);
          }}
        />
      ) : null}
    </>
  );
}

interface AddPhotoButtonProps {
  onPhoto: (photos: MediaFile["id"][], images: ReceiptImage[]) => void;
}

function AddPhotoButton({ onPhoto }: AddPhotoButtonProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { createMediaFile } = useMediaFileActions();

  async function addPhotoFiles(files: Blob[]) {
    if (files.length === 0) {
      return;
    }

    const toastId: string | number = toast.loading(t`Uploading...`);

    try {
      const photos = await Promise.all(
        files.map(async (blob) => {
          const [mediaFileId, handle] = await createMediaFile(
            blob,
            {},
            compressionPresets.balanced,
          );

          const media = handle.doc();

          return {
            photoId: mediaFileId,
            image: `data:${media.metadata.mimeType ?? blob.type};base64,${media.encodedBlob.toString()}`,
          };
        }),
      );

      onPhoto(
        photos.map((photo) => photo.photoId),
        photos,
      );
      trackEvent("receipt_attachments_added");

      toast.dismiss(toastId);
    } catch (error) {
      logger.error("Failed to upload expense attachment", {
        error,
        ...(error instanceof ImageProcessingError ? error.diagnostics : undefined),
      });
      toast.error(getImageUploadErrorMessage(error) ?? t`Failed to upload, please try again`, {
        id: toastId,
      });
    }
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    await addPhotoFiles(Array.from(event.target.files ?? []));

    // Reset the input value to allow the user to add more photos
    event.target.value = "";
  }

  async function openCamera() {
    if (!shouldUseNativeCameraCapture()) {
      cameraInputRef.current?.click();

      return;
    }

    let file: File;

    try {
      file = await getNativeCameraCaptureFile();
    } catch (error) {
      if (!isNativeCameraCancel(error)) {
        logger.error("Failed to capture expense attachment", { error });
        toast.error(t`Failed to access camera`);
      }

      return;
    }

    await addPhotoFiles([file]);
  }

  function openGallery() {
    galleryInputRef.current?.click();
  }

  return (
    <div className="flex h-32 w-max shrink-0 flex-col gap-2">
      <Button
        onPress={() => void openCamera()}
        color="input-like"
        className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
      >
        <Icon icon="lucide.camera" className="h-5 w-5" />
        <Trans>Take photo</Trans>
      </Button>

      <Button
        onPress={openGallery}
        color="input-like"
        className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
      >
        <Icon icon="lucide.image-up" className="h-5 w-5" />
        <Trans>Upload photo</Trans>
      </Button>

      <input
        type="file"
        aria-label={t`Take photo`}
        className="sr-only"
        accept={imageCaptureAccept}
        capture="environment"
        multiple={false}
        onChange={(event) => void onFileChange(event)}
        ref={cameraInputRef}
        hidden={true}
      />

      <input
        type="file"
        aria-label={t`Upload photo`}
        className="sr-only"
        accept={imageUploadAccept}
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
    <div className="relative shrink-0">
      <Button
        color="transparent"
        aria-label={t`View photo`}
        className="h-auto w-auto p-0"
        onContextMenu={(e) => e.preventDefault()}
        onPress={handleViewPhoto}
      >
        <img src={url} className="block h-32 w-32 rounded-xl object-cover" alt="" />
      </Button>
      <Button
        color="input-like"
        className="absolute -top-2 -right-2 z-10 h-auto w-auto rounded-full p-1"
        onPress={onRemove}
        aria-label={t`Remove photo`}
      >
        <Icon icon="lucide.x" className="h-4 w-4" />
      </Button>
    </div>
  );
}
