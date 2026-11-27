import {
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps,
  composeRenderProps,
} from "react-aria-components";
import { useOptimistic } from "react";

import { cn } from "./utils.js";
import { useActionProp, type AsyncAction } from "./useActionProp.js";

const Switch = ({
  changeAction,
  children,
  className,
  isDisabled,
  isSelected,
  onChange,
  ...props
}: AriaSwitchProps & { changeAction?: AsyncAction<[boolean]> }) => {
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(isSelected);

  const [isPending, onChangeWithAction] = useActionProp<[boolean]>({
    action: changeAction
      ? (nextSelected) => {
          if (isSelected !== undefined) {
            setOptimisticSelected(nextSelected);
          }

          return changeAction(nextSelected);
        }
      : undefined,
    onAction: onChange,
  });

  return (
    <AriaSwitch
      className={composeRenderProps(className, (className) =>
        cn(
          "group inline-flex cursor-pointer select-none items-center gap-2 text-sm font-medium leading-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70 data-[pending]:opacity-70",
          className,
        ),
      )}
      data-pending={isPending || undefined}
      isDisabled={isDisabled || isPending}
      isSelected={isSelected === undefined ? undefined : optimisticSelected}
      onChange={onChangeWithAction}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>
          <div
            className={cn(
              "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
              /* Focus Visible */
              "group-data-[focus-visible]:outline-solid group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-accent-500 dark:group-data-[focus-visible]:outline-accent-400",
              /* Disabled */
              "group-data-[disabled]:cursor-not-allowed group-data-[disabled]:opacity-50",
              /* Selected */
              "bg-neutral-950/15 group-data-[selected]:bg-accent-500 dark:bg-white/20",
              /* Readonly */
              "group-data-[readonly]:cursor-default",
              /* Resets */
              "focus-visible:outline-hidden",
            )}
          >
            <div
              className={cn(
                "pointer-events-none block size-5 rounded-full bg-white shadow-raised ring-0 transition-transform",
                /* Selected */
                "translate-x-0 group-data-[selected]:translate-x-5",
                isPending && "animate-pulse",
              )}
            />
          </div>
          {children}
        </>
      ))}
    </AriaSwitch>
  );
};

export { Switch };
