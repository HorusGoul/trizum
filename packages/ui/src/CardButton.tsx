import { Button, type ButtonProps } from "react-aria-components";
import { cn, focusRing } from "./utils.js";

export function CardButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      className={({ isPressed, isFocusVisible, isHovered }) =>
        cn(
          "flex w-full scale-100 items-start gap-4 rounded-3xl bg-white p-4 text-start text-neutral-950 shadow-surface outline-hidden transition-all duration-200 ease-in-out dark:bg-neutral-900 dark:text-neutral-50",
          focusRing,
          (isHovered || isFocusVisible) && "bg-neutral-50 dark:bg-neutral-800",
          isPressed && "scale-95 bg-neutral-100 dark:bg-neutral-800",
          className,
        )
      }
      {...props}
    >
      {children}
    </Button>
  );
}
