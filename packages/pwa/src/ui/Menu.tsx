import type { MenuProps, MenuItemProps } from "react-aria-components";
import { Menu as AriaMenu, MenuItem as AriaMenuItem } from "react-aria-components";
import { useActionProp, type AsyncAction } from "./useActionProp";
import { cn } from "./utils";

export function Menu<T extends object>({ className, ...props }: MenuProps<T>) {
  return (
    <AriaMenu
      className={cn(
        "min-w-40 overflow-hidden rounded-xl bg-white shadow-lg focus-visible:outline-hidden dark:bg-accent-900 dark:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function MenuItem<T extends object>({
  className,
  isDisabled,
  menuAction,
  onAction,
  ...props
}: MenuItemProps<T> & { menuAction?: AsyncAction }) {
  const [isPending, runAction] = useActionProp({
    action: menuAction,
    onAction,
  });

  return (
    <AriaMenuItem
      className={({ defaultClassName, isPressed, isHovered, isFocusVisible }) =>
        cn(
          defaultClassName,
          className,
          "flex cursor-pointer select-none items-center bg-accent-900/0 px-4 py-4 outline-hidden transition-all dark:bg-accent-50/0",
          (isFocusVisible || isHovered) && "bg-accent-900/5 dark:bg-accent-50/5",
          isPressed && !isPending && "bg-accent-900/10 dark:bg-accent-50/10",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        )
      }
      isDisabled={isDisabled || isPending}
      onAction={runAction}
      {...props}
    />
  );
}
