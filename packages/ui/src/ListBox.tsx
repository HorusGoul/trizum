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

import { cn } from "./utils.js";
import { Icon } from "./Icon.js";

const ListBoxSection = AriaListBoxSection;

const ListBoxCollection = AriaCollection;

function ListBox<T extends object>({ className, ...props }: AriaListBoxProps<T>) {
  return (
    <AriaListBox
      className={composeRenderProps(className, (className) =>
        cn(
          className,
          "group overflow-auto rounded-3xl bg-white p-2 text-neutral-950 shadow-surface outline-hidden dark:bg-neutral-900 dark:text-neutral-50",
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
      className={composeRenderProps(className, (className) =>
        cn(
          "relative flex w-full cursor-default select-none items-center rounded-2xl px-3 py-2.5 text-sm outline-hidden transition-colors",
          /* Disabled */
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          /* Focused */
          "data-[focused]:bg-neutral-950/5 dark:data-[focused]:bg-white/10",
          /* Hovered */
          "data-[hovered]:bg-neutral-950/5 dark:data-[hovered]:bg-white/10",
          /* Pressed */
          "data-[pressed]:bg-neutral-950/10 dark:data-[pressed]:bg-white/15",
          /* Selection */
          "data-[selection-mode]:pr-10 data-[selected]:font-medium",
          className,
        ),
      )}
      {...props}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          {renderProps.isSelected && (
            <span className="text-accent-500 dark:text-accent-400 absolute right-3 flex size-4 items-center justify-center">
              <Icon icon="lucide.check" className="size-4" />
            </span>
          )}
          {children}
        </>
      ))}
    </AriaListBoxItem>
  );
};

function ListBoxHeader({ className, ...props }: React.ComponentProps<typeof AriaHeader>) {
  return (
    <AriaHeader
      className={cn(
        "px-3 pt-2.5 pb-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400",
        className,
      )}
      {...props}
    />
  );
}

export { ListBox, ListBoxItem, ListBoxHeader, ListBoxSection, ListBoxCollection };
