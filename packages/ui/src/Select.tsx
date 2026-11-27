import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  ListBox as AriaListBox,
  type ListBoxProps as AriaListBoxProps,
  type PopoverProps as AriaPopoverProps,
  Select as AriaSelect,
  type SelectProps as AriaSelectProps,
  SelectValue as AriaSelectValue,
  type SelectValueProps as AriaSelectValueProps,
  type ValidationResult as AriaValidationResult,
  composeRenderProps,
  Text,
} from "react-aria-components";

import { cn } from "./utils.js";
import { fieldSurface } from "./fields/Field.styles.js";

import { FieldError, Label } from "./fields/Field.js";
import { ListBoxCollection, ListBoxHeader, ListBoxItem, ListBoxSection } from "./ListBox.js";
import { Popover } from "./Popover.js";
import { Icon } from "./Icon.js";

const Select = AriaSelect;

const SelectItem = ListBoxItem;

const SelectHeader = ListBoxHeader;

const SelectSection = ListBoxSection;

const SelectCollection = ListBoxCollection;

const SelectValue = <T extends object>({ className, ...props }: AriaSelectValueProps<T>) => (
  <AriaSelectValue
    className={composeRenderProps(className, (className) =>
      cn(
        "min-w-0 flex-1 line-clamp-1 data-[placeholder]:text-neutral-400 dark:data-[placeholder]:text-neutral-500",
        /* Description */
        "[&>[slot=description]]:hidden",
        className,
      ),
    )}
    {...props}
  />
);

const SelectTrigger = ({ className, children, ...props }: AriaButtonProps) => (
  <AriaButton
    className={composeRenderProps(className, (className) =>
      cn(
        "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-start text-sm transition-shadow",
        fieldSurface,
        /* Disabled */
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        /* Focused */
        "data-[focus-visible]:outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent-500 dark:data-[focus-visible]:ring-accent-400",
        /* Open */
        "data-[pressed]:ring-2 data-[pressed]:ring-accent-500 dark:data-[pressed]:ring-accent-400",
        /* Invalid */
        "group-data-[invalid]:ring-2 group-data-[invalid]:ring-danger-500 dark:group-data-[invalid]:ring-danger-400",
        /* Resets */
        "focus-visible:outline-hidden",
        className,
      ),
    )}
    {...props}
  >
    {composeRenderProps(children, (children) => (
      <>
        {children}
        <Icon
          icon="lucide.chevron-down"
          className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500"
        />
      </>
    ))}
  </AriaButton>
);

const SelectPopover = ({ className, ...props }: AriaPopoverProps) => (
  <Popover
    className={composeRenderProps(className, (className) =>
      cn("w-[var(--trigger-width)]", className),
    )}
    {...props}
  />
);

const SelectListBox = <T extends object>({ className, ...props }: AriaListBoxProps<T>) => (
  <AriaListBox
    className={composeRenderProps(className, (className) =>
      cn("max-h-[inherit] overflow-auto rounded-[inherit] p-2 outline-hidden", className),
    )}
    {...props}
  />
);

interface AppSelectProps<T extends object> extends Omit<AriaSelectProps<T>, "children"> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
  items?: Iterable<T>;
  children: React.ReactNode | ((item: T) => React.ReactNode);
}

function AppSelect<T extends object>({
  label,
  description,
  errorMessage,
  children,
  className,
  items,
  ...props
}: AppSelectProps<T>) {
  return (
    <Select
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className),
      )}
      {...props}
    >
      <Label>{label}</Label>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      {description && (
        <Text className="text-sm text-neutral-600 dark:text-neutral-400" slot="description">
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
      <SelectPopover>
        <SelectListBox items={items}>{children}</SelectListBox>
      </SelectPopover>
    </Select>
  );
}

export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectItem,
  SelectPopover,
  SelectHeader,
  SelectListBox,
  SelectSection,
  SelectCollection,
  AppSelect,
};

export type { AppSelectProps };
