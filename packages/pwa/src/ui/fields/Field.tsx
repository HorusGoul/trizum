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
import { type VariantProps, cn } from "../utils";
import { fieldGroupVariants, labelVariants } from "./Field.styles";

const Label = ({ className, ...props }: AriaLabelProps) => (
  <AriaLabel className={cn(labelVariants, className)} {...props} />
);

function FormDescription({ className, ...props }: AriaTextProps) {
  return (
    <AriaText
      className={cn("text-sm text-accent-950 dark:text-accent-50", className)}
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
