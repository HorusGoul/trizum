import {
  Button as AriaButton,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { Icon } from "./Icon.js";
import { useActionProp, type AsyncAction } from "./useActionProp.js";
import { cn } from "./utils.js";

type ButtonColorScheme = "transparent" | "accent" | "input-like";

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
