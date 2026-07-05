import {
  type NumberFieldProps as AriaNumberFieldProps,
  type ValidationResult as AriaValidationResult,
  Text,
  composeRenderProps,
} from "react-aria-components";
import { cn, type ClassName } from "../utils";
import { FieldError, Label } from "./Field";
import { Input, NumberField } from "./TextFieldPrimitives.js";

export interface AppNumberFieldProps extends AriaNumberFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  inputClassName?: ClassName;
  inputMode?: "decimal" | "numeric";
}

export function AppNumberField({
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
        <Text className="text-accent-700 dark:text-accent-50 text-sm" slot="description">
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
    </NumberField>
  );
}
