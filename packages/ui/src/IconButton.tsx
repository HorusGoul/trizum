import { Button, composeRenderProps, type ButtonProps } from "react-aria-components";
import { cn, focusRing, type ClassName } from "./utils.js";
import { fieldSurface } from "./fields/Field.styles.js";
import { Icon, type IconProps } from "./Icon.js";
import { useActionProp, type AsyncAction } from "./useActionProp.js";

type IconButtonColorScheme = "transparent" | "neutral" | "accent" | "input-like";

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
    base: "bg-neutral-950/0 dark:bg-white/0",
    focus: "bg-neutral-950/5 dark:bg-white/10",
    pressed: "bg-neutral-950/10 dark:bg-white/15",
  },
  neutral: {
    base: "bg-neutral-950/5 text-neutral-950 dark:bg-white/10 dark:text-neutral-50",
    focus: "bg-neutral-950/10 dark:bg-white/15",
    pressed: "bg-neutral-950/15 dark:bg-white/20",
  },
  accent: {
    base: "bg-accent-500 text-white dark:bg-accent-500 dark:text-white",
    focus: "bg-accent-600 dark:bg-accent-600",
    pressed: "bg-accent-700 dark:bg-accent-700",
  },
  "input-like": {
    base: fieldSurface,
    focus: "bg-neutral-50 dark:bg-white/15",
    pressed: "bg-neutral-100 dark:bg-white/20",
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
      className={composeRenderProps(
        className,
        (className, { isPressed, isFocusVisible, isHovered, defaultClassName }) =>
          cn(
            defaultClassName,
            "flex h-10 w-10 scale-100 cursor-pointer select-none items-center justify-center rounded-full outline-hidden transition-all duration-200 ease-in-out",
            colorStyles.base,
            focusRing,
            (isHovered || isFocusVisible) && colorStyles.focus,
            isPressed && !isButtonPending && ["scale-90", colorStyles.pressed],
            "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
            className,
          ),
      )}
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
