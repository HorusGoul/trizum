import { Button, composeRenderProps, type ButtonProps } from "react-aria-components";
import { cn, type ClassName } from "./utils.js";
import { Icon, type IconProps } from "./Icon.js";
import { useActionProp, type AsyncAction } from "./useActionProp.js";

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
    base: "bg-neutral-950/0 dark:bg-neutral-50/0",
    focus: "bg-neutral-950/5 dark:bg-neutral-50/5",
    pressed: "bg-neutral-950/10 dark:bg-neutral-50/10",
  },
  accent: {
    base: "text-neutral-50 bg-neutral-500 dark:bg-neutral-500",
    focus: "bg-neutral-600 dark:bg-neutral-400",
    pressed: "bg-neutral-700 dark:bg-neutral-300",
  },
  "input-like": {
    base: "border border-neutral-500 bg-white ring-offset-white dark:border-neutral-700 dark:bg-neutral-900 dark:ring-offset-neutral-900",
    focus: "ring-neutral-500 dark:ring-neutral-400",
    pressed: "ring-neutral-700 dark:ring-neutral-300",
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
            (isHovered || isFocusVisible) && colorStyles.focus,
            isPressed && !isButtonPending && ["scale-90", colorStyles.pressed],
            "data-[disabled]:cursor-not-allowed",
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
