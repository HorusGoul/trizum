import { Button, type ButtonProps } from "react-aria-components";
import { cn } from "./utils";
import { Icon, type IconProps } from "./Icon";

export function IconButton({
  className,
  icon,
  ...props
}: Omit<ButtonProps, "children"> & {
  icon: IconProps["name"];
}) {
  return (
    <Button
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          className,
          "flex h-10 w-10 scale-100 items-center justify-center rounded-full bg-slate-950 bg-opacity-0 outline-none transition-all duration-200 ease-in-out dark:bg-slate-50 dark:bg-opacity-0",
          (isHovered || isFocusVisible) && "bg-opacity-5 dark:bg-opacity-5",
          isPressed && "scale-110 bg-opacity-10 dark:bg-opacity-10",
        )
      }
      {...props}
    >
      <Icon name={icon} />
    </Button>
  );
}
