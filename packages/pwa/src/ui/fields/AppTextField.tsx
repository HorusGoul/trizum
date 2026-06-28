import {
  type TextFieldProps as AriaTextFieldProps,
  type ValidationResult as AriaValidationResult,
  Text,
  composeRenderProps,
} from "react-aria-components";
import { cn } from "../utils";
import { FieldError, Label } from "./Field";
import { Input, TextArea, TextField } from "./TextFieldPrimitives.js";

export interface AppTextFieldProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  textArea?: boolean;
}

export function AppTextField({
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
        <Text className="text-sm text-accent-700 dark:text-accent-50" slot="description">
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}
