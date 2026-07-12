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
import { Input, TextField } from "./TextFieldPrimitives.js";

interface AppCurrencyFieldProps extends Omit<AriaTextFieldProps, "value" | "onChange"> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  value?: number;
  onChange?: (value: number) => void;
  inputClassName?: ClassName;
  inputEndAdornment?: React.ReactNode;
  currency?: string;
}

export function AppCurrencyField({
  label,
  description,
  errorMessage,
  className,
  value,
  onChange,
  inputClassName,
  inputEndAdornment,
  inputMode,
  currency,
  ...props
}: AppCurrencyFieldProps) {
  const [internalValue, setInternalValue] = React.useState(() => value?.toString() || "");

  const parsedInternalValue = parseFloat(internalValue || "0");
  const parsedValue = parseFloat(value?.toString() || "0");

  if (parsedInternalValue !== parsedValue) {
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

        let newValue = initialValue.replace(/,/g, ".");
        newValue = newValue.replace(/[^0-9.]/g, "");

        const lastDotIndex = newValue.lastIndexOf(".");
        let withoutDots = "";
        let removedBeforeCursor = 0;

        for (let i = 0; i < newValue.length; i++) {
          if (newValue[i] === ".") {
            if (i === lastDotIndex) {
              withoutDots += ".";
            } else if (i < selectionStart) {
              removedBeforeCursor++;
            }
          } else {
            withoutDots += newValue[i];
          }
        }

        if (lastDotIndex !== -1) {
          const decimalPart = withoutDots.substring(lastDotIndex + 1);
          if (decimalPart.length > decimalPrecision) {
            withoutDots = withoutDots.substring(0, lastDotIndex + 1 + decimalPrecision);
          }
        }

        event.currentTarget.value = withoutDots;

        const newSelectionStart = Math.max(0, selectionStart - removedBeforeCursor);
        const newSelectionEnd = Math.max(0, selectionEnd - removedBeforeCursor);

        event.currentTarget.selectionStart = Math.min(newSelectionStart, withoutDots.length);
        event.currentTarget.selectionEnd = Math.min(newSelectionEnd, withoutDots.length);
      }}
      onChange={(value) => {
        setInternalValue(value);

        const trimmedValue = value.trim();
        if (trimmedValue === "" || trimmedValue === ".") {
          onChange?.(0);
        } else {
          const parsed = parseFloat(trimmedValue);
          if (!isNaN(parsed)) {
            onChange?.(parsed);
          }
        }
      }}
      {...props}
    >
      {label ? <Label>{label}</Label> : null}
      {inputEndAdornment ? (
        <div className="relative">
          <Input inputMode={inputMode ?? "decimal"} className={cn(inputClassName)} />
          {inputEndAdornment}
        </div>
      ) : (
        <Input inputMode={inputMode ?? "decimal"} className={cn(inputClassName)} />
      )}
      {description && (
        <Text className="text-accent-700 dark:text-accent-50 text-sm" slot="description">
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}
