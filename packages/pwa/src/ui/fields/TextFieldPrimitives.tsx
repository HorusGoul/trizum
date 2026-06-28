import {
  Input as AriaInput,
  type InputProps as AriaInputProps,
  NumberField as AriaNumberField,
  TextArea as AriaTextArea,
  type TextAreaProps as AriaTextAreaProps,
  TextField as AriaTextField,
  composeRenderProps,
} from "react-aria-components";
import { cn } from "../utils";

export const TextField = AriaTextField;
export const NumberField = AriaNumberField;

export const Input = ({ className, ...props }: AriaInputProps) => {
  return (
    <AriaInput
      className={composeRenderProps(className, (className) =>
        cn(
          "flex h-10 w-full rounded-md border border-accent-500 bg-white px-3 py-2 text-sm ring-offset-accent-900 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-accent-700 dark:border-accent-700 dark:bg-accent-900 dark:ring-offset-accent-900 dark:placeholder:text-accent-50",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          "data-[focused]:ring-ring data-[focused]:outline-none data-[focused]:ring-2 data-[focused]:ring-offset-2",
          "focus-visible:outline-none",
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
          "flex min-h-[80px] w-full rounded-md border border-accent-500 bg-white px-3 py-2 text-sm ring-offset-accent-900 placeholder:text-accent-700 dark:border-accent-700 dark:bg-accent-900 dark:ring-offset-accent-900 dark:placeholder:text-accent-50",
          "data-[focused]:ring-ring data-[focused]:outline-none data-[focused]:ring-2 data-[focused]:ring-offset-2",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          "focus-visible:outline-none",
          className,
        ),
      )}
      {...props}
    />
  );
};
