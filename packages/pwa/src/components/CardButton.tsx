import { Button, type ButtonProps } from "react-aria-components";
import { cn } from "#src/ui/utils.js";

/** @renders {Button} */
export function CardButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      className={({ isPressed, isFocusVisible, isHovered }) =>
        cn(
          "flex w-full scale-100 items-start gap-4 rounded-xl border border-accent-200 bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-800 dark:bg-accent-900",
          (isHovered || isFocusVisible) &&
            "shadow-md dark:border-accent-700 dark:bg-accent-800 dark:shadow-none",
          isPressed &&
            "scale-95 bg-opacity-90 shadow-lg dark:bg-accent-700 dark:shadow-none",
          className,
        )
      }
      {...props}
    >
      {children}
    </Button>
  );
}
