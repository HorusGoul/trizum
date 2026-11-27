import {
  Dialog as AriaDialog,
  type DialogProps as AriaDialogProps,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
  type PopoverProps as AriaPopoverProps,
  composeRenderProps,
} from "react-aria-components";

import { cn } from "./utils.js";

const PopoverTrigger = AriaDialogTrigger;

const Popover = ({ className, offset = 4, ...props }: AriaPopoverProps) => (
  <AriaPopover
    offset={offset}
    className={composeRenderProps(className, (className) =>
      cn(
        "z-50 rounded-md border border-neutral-500 bg-white text-neutral-900 shadow-md outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50",
        /* Entering */
        "data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95",
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

function PopoverDialog({ className, ...props }: AriaDialogProps) {
  return <AriaDialog className={cn("p-4 outline outline-0", className)} {...props} />;
}

export { Popover, PopoverTrigger, PopoverDialog };
