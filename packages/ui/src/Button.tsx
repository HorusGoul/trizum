import {
  Button as AriaButton,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { Icon } from "./Icon.js";
import { useActionProp, type AsyncAction } from "./useActionProp.js";
import { cn, focusRing } from "./utils.js";
import { fieldSurface } from "./fields/Field.styles.js";

type ButtonColorScheme = "transparent" | "neutral" | "accent" | "input-like";

type ButtonPressArgs = Parameters<NonNullable<AriaButtonProps["onPress"]>>;

const colorSchemes: Record<
  ButtonColorScheme,
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

export function Button({
  className,
  color = "transparent",
  children,
  isPending,
  onPress,
  pressAction,
  ...props
}: AriaButtonProps & {
  color?: ButtonColorScheme;
  pressAction?: AsyncAction<ButtonPressArgs>;
}) {
  const colorStyles = colorSchemes[color];

  const [isActionPending, onPressWithAction] = useActionProp<ButtonPressArgs>({
    action: pressAction,
    onAction: onPress,
  });

  const isButtonPending = isPending || isActionPending;

  return (
    <AriaButton
      className={composeRenderProps(
        className,
        (className, { isPressed, isFocusVisible, isHovered, defaultClassName }) =>
          cn(
            defaultClassName,
            "relative flex h-10 w-full scale-100 cursor-pointer select-none items-center justify-center rounded-full outline-hidden transition-all duration-200 ease-in-out",
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
      {composeRenderProps(children, (children, renderProps) => (
        <>
          <span className={cn("contents", renderProps.isPending && "invisible")}>{children}</span>
          {renderProps.isPending ? (
            <span aria-hidden className="absolute inset-0 flex items-center justify-center">
              <Icon icon="lucide.loader-circle" className="size-4 animate-spin" />
            </span>
          ) : null}
        </>
      ))}
    </AriaButton>
  );
}
