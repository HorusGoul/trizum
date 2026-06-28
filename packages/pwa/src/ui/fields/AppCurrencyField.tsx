import * as React from "react";
import {
  type TextFieldProps as AriaTextFieldProps,
  type ValidationResult as AriaValidationResult,
  Text,
  composeRenderProps,
} from "react-aria-components";
import { cn, type ClassName } from "../utils";
import { FieldError, Label } from "./Field";
import { getCurrencyDecimalPrecision } from "./currencyPrecision.js";
import { clampCurrencyFieldValue, sanitizeCurrencyFieldInput } from "./currencyFieldValues.js";
import { Input, TextField } from "./TextFieldPrimitives.js";

interface AppCurrencyFieldProps extends Omit<AriaTextFieldProps, "value" | "onChange"> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  value?: number;
  onChange?: (value: number) => void;
  inputClassName?: ClassName;
  currency?: string;
  minValue?: number;
}

function getSanitizedSelectionPosition(
  value: string,
  selectionPosition: number,
  decimalPrecision: number,
) {
  const sanitizedValue = sanitizeCurrencyFieldInput(value, decimalPrecision);
  const sanitizedPrefix = sanitizeCurrencyFieldInput(
    value.substring(0, selectionPosition),
    decimalPrecision,
  );

  return Math.min(sanitizedPrefix.length, sanitizedValue.length);
}

export function AppCurrencyField({
  label,
  description,
  errorMessage,
  className,
  value,
  onChange,
  inputClassName,
  currency,
  minValue,
  ...props
}: AppCurrencyFieldProps) {
  const [internalValue, setInternalValue] = React.useState(() =>
    value === undefined ? "" : clampCurrencyFieldValue(value, minValue).toString(),
  );

  const parsedInternalValue = parseFloat(internalValue || "0");
  const parsedValue =
    value === undefined ? parsedInternalValue : clampCurrencyFieldValue(value, minValue);

  if (value !== undefined && parsedInternalValue !== parsedValue) {
    setInternalValue(parsedValue.toString());
  }

  const decimalPrecision = getCurrencyDecimalPrecision(currency);

  return (
    <TextField
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className),
      )}
      value={internalValue}
      onInput={(event) => {
        const initialValue = event.currentTarget.value;
        const selectionStart = event.currentTarget.selectionStart || 0;
        const selectionEnd = event.currentTarget.selectionEnd || 0;
        const sanitizedValue = sanitizeCurrencyFieldInput(initialValue, decimalPrecision);

        event.currentTarget.value = sanitizedValue;
        event.currentTarget.selectionStart = getSanitizedSelectionPosition(
          initialValue,
          selectionStart,
          decimalPrecision,
        );
        event.currentTarget.selectionEnd = getSanitizedSelectionPosition(
          initialValue,
          selectionEnd,
          decimalPrecision,
        );
      }}
      onChange={(value) => {
        const sanitizedValue = sanitizeCurrencyFieldInput(value, decimalPrecision);

        setInternalValue(sanitizedValue);

        const trimmedValue = sanitizedValue.trim();
        if (trimmedValue === "" || trimmedValue === ".") {
          onChange?.(clampCurrencyFieldValue(0, minValue));
        } else {
          const parsed = parseFloat(trimmedValue);
          if (!isNaN(parsed)) {
            onChange?.(clampCurrencyFieldValue(parsed, minValue));
          }
        }
      }}
      {...props}
    >
      {label ? <Label>{label}</Label> : null}
      <Input inputMode="decimal" className={cn(inputClassName)} />
      {description && (
        <Text className="text-sm text-accent-700 dark:text-accent-50" slot="description">
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}
