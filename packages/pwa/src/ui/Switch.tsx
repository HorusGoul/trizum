import {
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps,
  composeRenderProps,
} from "react-aria-components";
import { useOptimistic } from "react";

import { cn } from "./utils";
import { useActionProp, type AsyncAction } from "./useActionProp";

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
              "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
              /* Focus Visible */
              "group-data-[focus-visible]:ring-ring group-data-[focus-visible]:outline-none group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-offset-2 group-data-[focus-visible]:ring-offset-accent-50",
              /* Disabled */
              "group-data-[disabled]:cursor-not-allowed group-data-[disabled]:opacity-50",
              /* Selected */
              "bg-accent-800 group-data-[selected]:bg-accent-500",
              /* Readonly */
              "group-data-[readonly]:cursor-default",
              /* Resets */
              "focus-visible:outline-none",
            )}
          >
            <div
              className={cn(
                "pointer-events-none block size-5 rounded-full bg-accent-50 shadow-lg ring-0 transition-transform",
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
