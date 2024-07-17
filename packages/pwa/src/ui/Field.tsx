import {
  FieldError as AriaFieldError,
  type FieldErrorProps as AriaFieldErrorProps,
  Group as AriaGroup,
  type GroupProps as AriaGroupProps,
  Label as AriaLabel,
  type LabelProps as AriaLabelProps,
  Text as AriaText,
  type TextProps as AriaTextProps,
  composeRenderProps,
} from "react-aria-components";
import { cn, cva, type VariantProps } from "./utils";

const Label = ({ className, ...props }: AriaLabelProps) => (
  <AriaLabel
    className={cn(
      "text-sm font-medium leading-none",
      /* Disabled */
      "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
      /* Invalid */
      "group-data-[invalid]:text-danger-500",
      className,
    )}
    {...props}
  />
);

function FormDescription({ className, ...props }: AriaTextProps) {
  return (
    <AriaText
      className={cn("text-sm text-slate-950 dark:text-slate-50", className)}
      {...props}
      slot="description"
    />
  );
}

function FieldError({ className, ...props }: AriaFieldErrorProps) {
  return (
    <AriaFieldError
      className={cn("text-sm font-medium text-danger-500", className)}
      {...props}
    />
  );
}

const fieldGroupVariants = cva({
  variants: {
    variant: {
      default: cn([
        "relative flex h-10 w-full items-center overflow-hidden rounded-md border border-slate-500 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm ring-offset-white dark:ring-offset-slate-900",
        /* Focus Within */
        "data-[focus-within]:outline-none data-[focus-within]:ring-2 data-[focus-within]:ring-ring data-[focus-within]:ring-offset-2",
        /* Disabled */
        "data-[disabled]:opacity-50",
      ]),
      ghost: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface GroupProps
  extends AriaGroupProps,
    VariantProps<typeof fieldGroupVariants> {}

function FieldGroup({ className, variant, ...props }: GroupProps) {
  return (
    <AriaGroup
      className={composeRenderProps(className, (className) =>
        cn(fieldGroupVariants({ variant }), className),
      )}
      {...props}
    />
  );
}

export { Label, FieldGroup, FieldError, FormDescription };
