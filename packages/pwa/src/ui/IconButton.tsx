import { Button, type ButtonProps } from "react-aria-components";
import { cn } from "./utils";
import { Icon, type IconProps } from "./Icon";

type IconButtonColorScheme = "transparent" | "accent";

const colorSchemes: Record<
  IconButtonColorScheme,
  {
    base: string;
    focus: string;
    pressed: string;
  }
> = {
  transparent: {
    base: "bg-slate-950 bg-opacity-0 dark:bg-slate-50 dark:bg-opacity-0",
    focus: "bg-opacity-5 dark:bg-opacity-5",
    pressed: "bg-opacity-10 dark:bg-opacity-10",
  },
  accent: {
    base: "text-slate-50 bg-accent-500 dark:bg-accent-500",
    focus: "bg-accent-600 dark:bg-accent-400",
    pressed: "bg-accent-700 dark:bg-accent-300",
  },
};

export function IconButton({
  className,
  icon,
  color = "transparent",
  ...props
}: Omit<ButtonProps, "children"> & {
  icon: IconProps["name"];
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
      <Icon name={icon} />
    </Button>
  );
}
