import type { ReactNode } from "react";
import {
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps,
  composeRenderProps,
} from "react-aria-components";
import { cn } from "./utils.js";

interface SwitchFieldProps extends Omit<AriaSwitchProps, "children"> {
  label: ReactNode;
  description?: ReactNode;
}

export function SwitchField({ label, description, className, ...props }: SwitchFieldProps) {
  return (
    <AriaSwitch
      className={composeRenderProps(className, (className) =>
        cn(
          "group flex cursor-pointer select-none items-center justify-between gap-4",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
          className,
        ),
      )}
      {...props}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <span className="text-sm text-neutral-600 dark:text-neutral-400">{description}</span>
        )}
      </div>
      <div
        className={cn(
          "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
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
          )}
        />
      </div>
    </AriaSwitch>
  );
}
