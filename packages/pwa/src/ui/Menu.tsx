import type { MenuProps, MenuItemProps } from "react-aria-components";
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
} from "react-aria-components";
import { cn } from "./utils";

export function Menu<T extends object>({ className, ...props }: MenuProps<T>) {
  return (
    <AriaMenu
      className={cn(
        "min-w-40 overflow-hidden rounded-xl border border-accent-500 bg-white shadow-md focus-visible:outline-none dark:border-accent-700 dark:bg-accent-900",
        className,
      )}
      {...props}
    />
  );
}

export function MenuItem<T extends object>({
  className,
  ...props
}: MenuItemProps<T>) {
  return (
    <AriaMenuItem
      className={({ defaultClassName, isPressed, isHovered, isFocusVisible }) =>
        cn(
          defaultClassName,
          className,
          "flex items-center bg-accent-900 bg-opacity-0 px-4 py-4 outline-none transition-all dark:bg-accent-50 dark:bg-opacity-0",
          (isFocusVisible || isHovered) && "bg-opacity-5 dark:bg-opacity-5",
          isPressed && "bg-opacity-10 dark:bg-opacity-10",
        )
      }
      {...props}
    />
  );
}
