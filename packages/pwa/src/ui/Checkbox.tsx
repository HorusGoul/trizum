import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  type CheckboxGroupProps as AriaCheckboxGroupProps,
  type ValidationResult as AriaValidationResult,
  composeRenderProps,
  Text,
  type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";

import { cn } from "./utils";

import { FieldError, Label, labelVariants } from "./Field";
import { Icon } from "./Icon";

const CheckboxGroup = AriaCheckboxGroup;

const Checkbox = ({ className, children, ...props }: AriaCheckboxProps) => (
  <AriaCheckbox
    className={composeRenderProps(className, (className) =>
      cn(
        "group/checkbox flex items-center gap-x-2",
        /* Disabled */
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
        labelVariants,
        className,
      ),
    )}
    {...props}
  >
    {composeRenderProps(children, (children, renderProps) => (
      <>
        <div
          className={cn(
            "ring-offset-background flex size-4 shrink-0 items-center justify-center rounded-sm border border-slate-500 text-current dark:border-slate-700",
            /* Focus Visible */
            "group-data-[focus-visible]/checkbox:ring-ring group-data-[focus-visible]/checkbox:outline-none group-data-[focus-visible]/checkbox:ring-2 group-data-[focus-visible]/checkbox:ring-offset-2",
            /* Selected */
            "group-data-[indeterminate]/checkbox:bg-accent-500 group-data-[selected]/checkbox:bg-accent-500 group-data-[indeterminate]/checkbox:text-accent-50 group-data-[selected]/checkbox:text-accent-50",
            /* Disabled */
            "group-data-[disabled]/checkbox:cursor-not-allowed group-data-[disabled]/checkbox:opacity-50",
            /* Invalid */
            "group-data-[invalid]/checkbox:border-danger-500 group-data-[invalid]/checkbox:group-data-[selected]/checkbox:bg-danger-500 group-data-[invalid]/checkbox:group-data-[selected]/checkbox:text-danger-50",
            /* Resets */
            "focus:outline-none focus-visible:outline-none",
            "transition-transform duration-200 ease-in-out",
            renderProps.isPressed && "scale-90",
          )}
        >
          {renderProps.isIndeterminate ? (
            <Icon name="#lucide/minus" className="size-4" />
          ) : renderProps.isSelected ? (
            <Icon name="#lucide/check" className="size-4" />
          ) : null}
        </div>
        {children}
      </>
    ))}
  </AriaCheckbox>
);

interface JollyCheckboxGroupProps extends AriaCheckboxGroupProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
}

function JollyCheckboxGroup({
  label,
  description,
  errorMessage,
  className,
  children,
  ...props
}: JollyCheckboxGroupProps) {
  return (
    <CheckboxGroup
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className),
      )}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>
          <Label>{label}</Label>
          {children}
          {description && (
            <Text className="text-muted-foreground text-sm" slot="description">
              {description}
            </Text>
          )}
          <FieldError>{errorMessage}</FieldError>
        </>
      ))}
    </CheckboxGroup>
  );
}

export { Checkbox, CheckboxGroup, JollyCheckboxGroup };
export type { JollyCheckboxGroupProps };
