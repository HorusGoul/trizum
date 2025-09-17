import * as React from "react";
import {
  Input as AriaInput,
  type InputProps as AriaInputProps,
  TextArea as AriaTextArea,
  type TextAreaProps as AriaTextAreaProps,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  type NumberFieldProps as AriaNumberFieldProps,
  type ValidationResult as AriaValidationResult,
  composeRenderProps,
  NumberField as AriaNumberField,
  Text,
} from "react-aria-components";

import { cn, type ClassName } from "./utils";

import { FieldError, Label } from "./Field";

const TextField = AriaTextField;
const NumberField = AriaNumberField;

const Input = ({ className, ...props }: AriaInputProps) => {
  return (
    <AriaInput
      className={composeRenderProps(className, (className) =>
        cn(
          "flex h-10 w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm ring-offset-slate-900 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:ring-offset-slate-900 dark:placeholder:text-slate-50",
          /* Disabled */
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          /* Focused */
          "data-[focused]:ring-ring data-[focused]:outline-none data-[focused]:ring-2 data-[focused]:ring-offset-2",
          /* Resets */
          "focus-visible:outline-none",
          className,
        ),
      )}
      {...props}
    />
  );
};

const TextArea = ({ className, ...props }: AriaTextAreaProps) => {
  return (
    <AriaTextArea
      className={composeRenderProps(className, (className) =>
        cn(
          "flex min-h-[80px] w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm ring-offset-slate-900 placeholder:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:ring-offset-slate-900 dark:placeholder:text-slate-50",
          /* Focused */
          "data-[focused]:ring-ring data-[focused]:outline-none data-[focused]:ring-2 data-[focused]:ring-offset-2",
          /* Disabled */
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          /* Resets */
          "focus-visible:outline-none",
          className,
        ),
      )}
      {...props}
    />
  );
};

interface AppTextFieldProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  textArea?: boolean;
}

function AppTextField({
  label,
  description,
  errorMessage,
  textArea,
  className,
  ...props
}: AppTextFieldProps) {
  return (
    <TextField
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className),
      )}
      {...props}
    >
      {label ? <Label>{label}</Label> : null}
      {textArea ? <TextArea /> : <Input />}
      {description && (
        <Text
          className="text-sm text-slate-700 dark:text-slate-50"
          slot="description"
        >
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}

export interface AppNumberFieldProps extends AriaNumberFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  inputClassName?: ClassName;
  inputMode?: "decimal" | "numeric";
}

function AppNumberField({
  label,
  description,
  errorMessage,
  className,
  inputClassName,
  inputMode = "decimal",
  ...props
}: AppNumberFieldProps) {
  return (
    <NumberField
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className),
      )}
      {...props}
    >
      {label ? <Label>{label}</Label> : null}
      <Input className={cn(inputClassName)} inputMode={inputMode} />
      {description && (
        <Text
          className="text-sm text-slate-700 dark:text-slate-50"
          slot="description"
        >
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
    </NumberField>
  );
}

interface AppCurrencyFieldProps
  extends Omit<AriaTextFieldProps, "value" | "onChange"> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  value?: number;
  onChange?: (value: number) => void;
  inputClassName?: ClassName;
  currency?: string;
}

function AppCurrencyField({
  label,
  description,
  errorMessage,
  className,
  value,
  onChange,
  inputClassName,
  currency,
  ...props
}: AppCurrencyFieldProps) {
  const [internalValue, setInternalValue] = React.useState(
    () => value?.toString() || "",
  );

  const parsedInternalValue = parseFloat(internalValue || "0");
  const parsedValue = parseFloat(value?.toString() || "0");

  if (parsedInternalValue !== parsedValue) {
    setInternalValue(parsedValue.toString());
  }

  const decimalPrecision =
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    })
      .formatToParts(1.23456789)
      .find((part) => part.type === "fraction")?.value.length ?? 2;

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

        // Replace all commas with dots
        let newValue = initialValue.replace(/,/g, ".");

        // Replace all non-numeric characters with empty string
        newValue = newValue.replace(/[^0-9.]/g, "");

        // Find the last dot and remove all others
        const lastDotIndex = newValue.lastIndexOf(".");
        let withoutDots = "";
        let removedBeforeCursor = 0;

        for (let i = 0; i < newValue.length; i++) {
          if (newValue[i] === ".") {
            if (i === lastDotIndex) {
              withoutDots += ".";
            } else {
              // Track how many characters we've removed before the cursor
              if (i < selectionStart) {
                removedBeforeCursor++;
              }
            }
          } else {
            withoutDots += newValue[i];
          }
        }

        // Enforce decimal precision limit
        if (lastDotIndex !== -1) {
          const decimalPart = withoutDots.substring(lastDotIndex + 1);
          if (decimalPart.length > decimalPrecision) {
            withoutDots = withoutDots.substring(
              0,
              lastDotIndex + 1 + decimalPrecision,
            );
          }
        }

        event.currentTarget.value = withoutDots;

        // Adjust selection positions
        const newSelectionStart = Math.max(
          0,
          selectionStart - removedBeforeCursor,
        );
        const newSelectionEnd = Math.max(0, selectionEnd - removedBeforeCursor);

        // Ensure selection doesn't exceed the new value length
        event.currentTarget.selectionStart = Math.min(
          newSelectionStart,
          withoutDots.length,
        );
        event.currentTarget.selectionEnd = Math.min(
          newSelectionEnd,
          withoutDots.length,
        );
      }}
      onChange={(value) => {
        setInternalValue(value);

        // Only call onChange with valid numbers
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
      <Input inputMode="decimal" className={cn(inputClassName)} />
      {description && (
        <Text
          className="text-sm text-slate-700 dark:text-slate-50"
          slot="description"
        >
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}

export {
  Input,
  TextField,
  AppTextField,
  AppNumberField,
  TextArea,
  AppCurrencyField,
};
export type { AppTextFieldProps };
