import {
  Collection as AriaCollection,
  Header as AriaHeader,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  type ListBoxItemProps as AriaListBoxItemProps,
  type ListBoxProps as AriaListBoxProps,
  ListBoxSection as AriaListBoxSection,
  composeRenderProps,
} from "react-aria-components";

import { cn } from "./utils";
import { Icon } from "./Icon";

const ListBoxSection = AriaListBoxSection;

const ListBoxCollection = AriaCollection;

function ListBox<T extends object>({
  className,
  ...props
}: AriaListBoxProps<T>) {
  return (
    <AriaListBox
      className={composeRenderProps(className, (className) =>
        cn(
          className,
          "group overflow-auto rounded-md border bg-accent-900 p-1 text-accent-50 shadow-md outline-none",
          /* Empty */
          "data-[empty]:p-6 data-[empty]:text-center data-[empty]:text-sm",
        ),
      )}
      {...props}
    />
  );
}

const ListBoxItem = <T extends object>({
  className,
  children,
  ...props
}: AriaListBoxItemProps<T>) => {
  return (
    <AriaListBoxItem
      textValue={
        props.textValue || (typeof children === "string" ? children : undefined)
      }
      className={composeRenderProps(className, (className) =>
        cn(
          "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
          /* Disabled */
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          /* Focused */
          "data-[focused]:bg-accent-500 data-[focused]:text-accent-50",
          /* Hovered */
          "data-[hovered]:bg-accent-500 data-[hovered]:text-accent-50",
          /* Selection */
          "data-[selection-mode]:pl-8",
          className,
        ),
      )}
      {...props}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          {renderProps.isSelected && (
            <span className="absolute left-2 flex size-4 items-center justify-center">
              <Icon name="#lucide/check" className="size-4" />
            </span>
          )}
          {children}
        </>
      ))}
    </AriaListBoxItem>
  );
};

function ListBoxHeader({
  className,
  ...props
}: React.ComponentProps<typeof AriaHeader>) {
  return (
    <AriaHeader
      className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
      {...props}
    />
  );
}

export {
  ListBox,
  ListBoxItem,
  ListBoxHeader,
  ListBoxSection,
  ListBoxCollection,
};
