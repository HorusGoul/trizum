import {
  Button as AriaButton,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { Icon } from "./Icon";
import { useActionProp, type AsyncAction } from "./useActionProp";
import { cn } from "./utils";

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
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName, ...state }) =>
        cn(
          defaultClassName,
          "relative flex h-10 w-full scale-100 cursor-pointer select-none items-center justify-center rounded-full outline-none transition-all duration-200 ease-in-out",
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
