import * as React from "react";

import { cn, cva, type VariantProps } from "./utils.js";

const alertVariants = cva({
  base: "relative w-full rounded-2xl px-4 py-3.5 text-sm grid has-[>svg]:grid-cols-[16px_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  variants: {
    variant: {
      default: "bg-white text-neutral-950 shadow-surface dark:bg-neutral-900 dark:text-neutral-50",
      info: "bg-white text-neutral-950 shadow-surface dark:bg-neutral-900 dark:text-neutral-50 [&>svg]:text-neutral-500 dark:[&>svg]:text-neutral-400 [&_[data-slot=alert-description]]:text-neutral-600 dark:[&_[data-slot=alert-description]]:text-neutral-400",
      destructive:
        "bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-200 [&>svg]:text-current [&_[data-slot=alert-description]]:text-danger-700 dark:[&_[data-slot=alert-description]]:text-danger-200",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Alert };

export { AlertDescription } from "./AlertDescription.js";

export { AlertTitle } from "./AlertTitle.js";
