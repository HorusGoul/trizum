import type { MenuProps, MenuItemProps } from "react-aria-components";
import { Menu as AriaMenu, MenuItem as AriaMenuItem } from "react-aria-components";
import { useActionProp, type AsyncAction } from "./useActionProp.js";
import { cn } from "./utils.js";

export function Menu<T extends object>({ className, ...props }: MenuProps<T>) {
  return (
    <AriaMenu
      className={cn(
        "min-w-40 overflow-hidden rounded-3xl bg-white p-2 text-neutral-950 shadow-overlay outline-hidden dark:bg-neutral-800 dark:text-neutral-50",
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
          "flex cursor-pointer select-none items-center rounded-2xl bg-neutral-950/0 px-3 py-3 outline-hidden transition-all dark:bg-white/0",
          (isFocusVisible || isHovered) && "bg-neutral-950/5 dark:bg-white/10",
          isPressed && !isPending && "bg-neutral-950/10 dark:bg-white/15",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        )
      }
      isDisabled={isDisabled || isPending}
      onAction={runAction}
      {...props}
    />
  );
}
