import { Button, type ButtonProps } from "react-aria-components";
import { cn } from "./utils.js";

export function CardButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      className={({ isPressed, isFocusVisible, isHovered }) =>
        cn(
          "flex w-full scale-100 items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-start outline-hidden transition-all duration-200 ease-in-out dark:border-neutral-800 dark:bg-neutral-900",
          (isHovered || isFocusVisible) &&
            "shadow-md dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-none",
          isPressed && "scale-95 bg-white/90 shadow-lg dark:bg-neutral-700/90 dark:shadow-none",
          className,
        )
      }
      {...props}
    >
      {children}
    </Button>
  );
}
