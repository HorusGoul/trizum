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

import { cn } from "./utils";

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

interface AppNumberFieldProps extends AriaNumberFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
}

function AppNumberField({
  label,
  description,
  errorMessage,
  className,
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
      <Input />
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

export { Input, TextField, AppTextField, AppNumberField, TextArea };
export type { AppTextFieldProps };
