import {
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  type ValidationResult as AriaValidationResult,
  Text,
} from "react-aria-components";
import { cn } from "#src/ui/utils.js";
import { FieldError, Label } from "#src/ui/Field.js";
import { EmojiPicker } from "#src/components/EmojiPicker.js";

const TextField = AriaTextField;

interface AppEmojiFieldProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  visuallyHideLabel?: boolean;
}

/** @renders {TextField} */
export function AppEmojiField({
  label,
  description,
  errorMessage,
  visuallyHideLabel,
  value,
  defaultValue,
  onChange,
  className,
  ...props
}: AppEmojiFieldProps) {
  return (
    <TextField
      className={cn("group flex flex-col gap-2", className)}
      {...props}
    >
      {label ? (
        <Label className={cn(visuallyHideLabel && "w-0 opacity-0")}>
          {label}
        </Label>
      ) : null}
      <EmojiPicker
        aria-label={label}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
      />
      {description && (
        <Text
          className="text-sm text-accent-700 dark:text-accent-50"
          slot="description"
        >
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}

export type { AppEmojiFieldProps };
