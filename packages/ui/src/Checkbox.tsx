import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  type CheckboxGroupProps as AriaCheckboxGroupProps,
  type ValidationResult as AriaValidationResult,
  composeRenderProps,
  Text,
  type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";
import { useOptimistic } from "react";

import { cn } from "./utils.js";
import { useActionProp, type AsyncAction } from "./useActionProp.js";

import { FieldError, Label } from "./fields/Field.js";
import { labelVariants } from "./fields/Field.styles.js";
import { Icon } from "./Icon.js";

const CheckboxGroup = AriaCheckboxGroup;

const Checkbox = ({
  changeAction,
  className,
  children,
  isDisabled,
  isSelected,
  onChange,
  ...props
}: AriaCheckboxProps & { changeAction?: AsyncAction<[boolean]> }) => {
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(isSelected);

  const [isPending, onChangeWithAction] = useActionProp<[boolean]>({
    action: changeAction
      ? (nextSelected) => {
          if (isSelected !== undefined) {
            setOptimisticSelected(nextSelected);
          }

          return changeAction(nextSelected);
        }
      : undefined,
    onAction: onChange,
  });

  return (
    <AriaCheckbox
      className={composeRenderProps(className, (className) =>
        cn(
          "group/checkbox flex cursor-pointer select-none items-center gap-x-2",
          /* Disabled */
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70 data-[pending]:opacity-70",
          labelVariants,
          className,
        ),
      )}
      data-pending={isPending || undefined}
      isDisabled={isDisabled || isPending}
      isSelected={isSelected === undefined ? undefined : optimisticSelected}
      onChange={onChangeWithAction}
      {...props}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          <div
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-lg bg-neutral-950/5 text-current inset-ring-2 inset-ring-neutral-950/15 dark:bg-white/10 dark:inset-ring-white/20",
              /* Focus Visible */
              "group-data-[focus-visible]/checkbox:outline-solid group-data-[focus-visible]/checkbox:outline-2 group-data-[focus-visible]/checkbox:outline-offset-2 group-data-[focus-visible]/checkbox:outline-accent-500 dark:group-data-[focus-visible]/checkbox:outline-accent-400",
              /* Selected */
              "group-data-[indeterminate]/checkbox:bg-accent-500 group-data-[selected]/checkbox:bg-accent-500 group-data-[indeterminate]/checkbox:text-white group-data-[selected]/checkbox:text-white group-data-[indeterminate]/checkbox:inset-ring-0 group-data-[selected]/checkbox:inset-ring-0",
              /* Disabled */
              "group-data-[disabled]/checkbox:cursor-not-allowed group-data-[disabled]/checkbox:opacity-50",
              /* Invalid */
              "group-data-[invalid]/checkbox:inset-ring-danger-500 dark:group-data-[invalid]/checkbox:inset-ring-danger-400 group-data-[invalid]/checkbox:group-data-[selected]/checkbox:bg-danger-500 group-data-[invalid]/checkbox:group-data-[selected]/checkbox:text-white",
              /* Resets */
              "focus:outline-hidden focus-visible:outline-hidden",
              "transition-transform duration-200 ease-in-out",
              renderProps.isPressed && !isPending && "scale-90",
              isPending && "animate-pulse",
            )}
          >
            {renderProps.isIndeterminate ? (
              <Icon icon="lucide.minus" className="size-3.5" />
            ) : renderProps.isSelected ? (
              <Icon icon="lucide.check" className="size-3.5" />
            ) : null}
          </div>
          {children}
        </>
      ))}
    </AriaCheckbox>
  );
};

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
            <Text className="text-sm text-neutral-600 dark:text-neutral-400" slot="description">
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
