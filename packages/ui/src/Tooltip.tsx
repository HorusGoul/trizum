import {
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  composeRenderProps,
  type TooltipProps as AriaTooltipProps,
} from "react-aria-components";

import { cn } from "./utils.js";

const TooltipTrigger = AriaTooltipTrigger;

const Tooltip = ({ className, offset = 4, ...props }: AriaTooltipProps) => (
  <AriaTooltip
    offset={offset}
    className={composeRenderProps(className, (className) =>
      cn(
        "z-50 overflow-hidden rounded-2xl bg-white px-3 py-1.5 text-sm text-neutral-950 shadow-overlay animate-in fade-in-0 dark:bg-neutral-800 dark:text-neutral-50",
        /* Entering */
        "data-[entering]:zoom-in-95",
        /* Exiting */
        "data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95",
        /* Placement */
        "data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
        className,
      ),
    )}
    {...props}
  />
);

export { Tooltip, TooltipTrigger };
