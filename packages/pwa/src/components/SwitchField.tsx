import type { ReactNode } from "react";
import {
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps,
  composeRenderProps,
} from "react-aria-components";
import { cn } from "#src/ui/utils.js";

interface SwitchFieldProps extends Omit<AriaSwitchProps, "children"> {
  label: ReactNode;
  description?: ReactNode;
}

export function SwitchField({
  label,
  description,
  className,
  ...props
}: SwitchFieldProps) {
  return (
    <AriaSwitch
      className={composeRenderProps(className, (className) =>
        cn(
          "group flex cursor-pointer items-center justify-between gap-4",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
          className,
        ),
      )}
      {...props}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <span className="text-sm text-accent-500">{description}</span>
        )}
      </div>
      <div
        className={cn(
          "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
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
          )}
        />
      </div>
    </AriaSwitch>
  );
}
