import { Button, type ButtonProps } from "react-aria-components";
import { cn, type ClassName } from "./utils";
import { Icon, type IconProps } from "./Icon";

type IconButtonColorScheme = "transparent" | "accent" | "input-like";

const colorSchemes: Record<
  IconButtonColorScheme,
  {
    base: string;
    focus: string;
    pressed: string;
  }
> = {
  transparent: {
    base: "bg-accent-950 bg-opacity-0 dark:bg-accent-50 dark:bg-opacity-0",
    focus: "bg-opacity-5 dark:bg-opacity-5",
    pressed: "bg-opacity-10 dark:bg-opacity-10",
  },
  accent: {
    base: "text-accent-50 bg-accent-500 dark:bg-accent-500",
    focus: "bg-accent-600 dark:bg-accent-400",
    pressed: "bg-accent-700 dark:bg-accent-300",
  },
  "input-like": {
    base: "border border-accent-500 bg-white ring-offset-white dark:border-accent-700 dark:bg-accent-900 dark:ring-offset-accent-900",
    focus: "ring-accent-500 dark:ring-accent-400",
    pressed: "ring-accent-700 dark:ring-accent-300",
  },
};

export function IconButton({
  className,
  icon,
  color = "transparent",
  iconClassName,
  ...props
}: Omit<ButtonProps, "children"> & {
  icon: IconProps["name"];
  iconClassName?: ClassName;
  color?: IconButtonColorScheme;
}) {
  const colorStyles = colorSchemes[color];

  return (
    <Button
      className={({
        isPressed,
        isFocusVisible,
        isHovered,
        defaultClassName,
        ...state
      }) =>
        cn(
          defaultClassName,
          "flex h-10 w-10 scale-100 items-center justify-center rounded-full outline-none transition-all duration-200 ease-in-out",
          colorStyles.base,
          (isHovered || isFocusVisible) && colorStyles.focus,
          isPressed && ["scale-90", colorStyles.pressed],
          typeof className === "function"
            ? className({
                isPressed,
                isFocusVisible,
                isHovered,
                defaultClassName,
                ...state,
              })
            : className,
        )
      }
      {...props}
    >
      <Icon name={icon} className={cn(iconClassName)} />
    </Button>
  );
}
