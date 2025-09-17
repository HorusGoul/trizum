import {
  DateField as AriaDateField,
  DateInput as AriaDateInput,
  type DateInputProps as AriaDateInputProps,
  DateSegment as AriaDateSegment,
  type DateSegmentProps as AriaDateSegmentProps,
  TimeField as AriaTimeField,
  composeRenderProps,
} from "react-aria-components";

import { cn, type VariantProps } from "./utils";

import { fieldGroupVariants } from "./Field";

const DateField = AriaDateField;

const TimeField = AriaTimeField;

function DateSegment({ className, ...props }: AriaDateSegmentProps) {
  return (
    <AriaDateSegment
      className={composeRenderProps(className, (className) =>
        cn(
          "inline rounded p-0.5 caret-transparent outline outline-0 type-literal:px-0",
          /* Placeholder */
          "data-[placeholder]:text-accent-700 dark:data-[placeholder]:text-accent-50",
          /* Disabled */
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          /* Focused */
          "data-[focused]:bg-accent-500 data-[focused]:text-accent-50",
          /* Invalid */
          "data-[invalid]:data-[focused]:bg-danger-500 data-[invalid]:data-[focused]:data-[placeholder]:text-danger-50 data-[invalid]:data-[focused]:text-danger-50 data-[invalid]:data-[placeholder]:text-danger-500 data-[invalid]:text-danger-500",
          className,
        ),
      )}
      {...props}
    />
  );
}

interface DateInputProps
  extends AriaDateInputProps,
    VariantProps<typeof fieldGroupVariants> {}

function DateInput({
  className,
  variant = "default",
  ...props
}: Omit<DateInputProps, "children">) {
  return (
    <AriaDateInput
      className={composeRenderProps(className, (className) =>
        cn(fieldGroupVariants({ variant }), "text-sm", className),
      )}
      {...props}
    >
      {(segment) => <DateSegment segment={segment} />}
    </AriaDateInput>
  );
}

export { DateField, DateSegment, DateInput, TimeField };
export type { DateInputProps };
