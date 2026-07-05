import { Button, type ButtonProps } from "react-aria-components";
import { cn, type ClassName } from "./utils";
import { Icon, type IconProps } from "./Icon";
import { useActionProp, type AsyncAction } from "./useActionProp";

type IconButtonColorScheme = "transparent" | "accent" | "input-like";
type IconButtonPressArgs = Parameters<NonNullable<ButtonProps["onPress"]>>;

const colorSchemes: Record<
  IconButtonColorScheme,
  {
    base: string;
    focus: string;
    pressed: string;
  }
> = {
  transparent: {
    base: "bg-accent-950/0 dark:bg-accent-50/0",
    focus: "bg-accent-950/5 dark:bg-accent-50/5",
    pressed: "bg-accent-950/10 dark:bg-accent-50/10",
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
  isPending,
  onPress,
  pressAction,
  ...props
}: Omit<ButtonProps, "children"> & {
  icon: IconProps["icon"];
  iconClassName?: ClassName;
  color?: IconButtonColorScheme;
  pressAction?: AsyncAction<IconButtonPressArgs>;
}) {
  const colorStyles = colorSchemes[color];
  const [isActionPending, onPressWithAction] = useActionProp<IconButtonPressArgs>({
    action: pressAction,
    onAction: onPress,
  });
  const isButtonPending = isPending || isActionPending;

  return (
    <Button
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName, ...state }) =>
        cn(
          defaultClassName,
          "flex h-10 w-10 scale-100 cursor-pointer select-none items-center justify-center rounded-full outline-hidden transition-all duration-200 ease-in-out",
          colorStyles.base,
          (isHovered || isFocusVisible) && colorStyles.focus,
          isPressed && !isButtonPending && ["scale-90", colorStyles.pressed],
          "data-[disabled]:cursor-not-allowed",
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
      isPending={isButtonPending}
      onPress={onPressWithAction}
      {...props}
    >
      <Icon
        icon={isButtonPending ? "lucide.loader-circle" : icon}
        className={cn(iconClassName, isButtonPending && "animate-spin")}
      />
    </Button>
  );
}
