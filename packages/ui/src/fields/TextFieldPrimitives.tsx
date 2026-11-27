import {
  Input as AriaInput,
  type InputProps as AriaInputProps,
  NumberField as AriaNumberField,
  TextArea as AriaTextArea,
  type TextAreaProps as AriaTextAreaProps,
  TextField as AriaTextField,
  composeRenderProps,
} from "react-aria-components";
import { cn } from "../utils.js";
import { fieldFocusRing, fieldSurface } from "./Field.styles.js";

export const TextField = AriaTextField;
export const NumberField = AriaNumberField;

export const Input = ({ className, ...props }: AriaInputProps) => {
  return (
    <AriaInput
      className={composeRenderProps(className, (className) =>
        cn(
          "flex h-10 w-full rounded-2xl px-3.5 py-2 text-sm transition-shadow file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
          fieldSurface,
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          fieldFocusRing,
          "focus-visible:outline-hidden",
          className,
        ),
      )}
      {...props}
    />
  );
};

export const TextArea = ({ className, ...props }: AriaTextAreaProps) => {
  return (
    <AriaTextArea
      className={composeRenderProps(className, (className) =>
        cn(
          "flex min-h-[80px] w-full rounded-2xl px-3.5 py-2.5 text-sm transition-shadow placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
          fieldSurface,
          fieldFocusRing,
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          "focus-visible:outline-hidden",
          className,
        ),
      )}
      {...props}
    />
  );
};
