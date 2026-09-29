import * as React from "react";

import { cn, cva, type VariantProps } from "./utils";

const alertVariants = cva({
  base: "relative w-full rounded-lg border border-accent-200 dark:border-accent-700 px-4 py-3 text-sm grid has-[>svg]:grid-cols-[16px_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  variants: {
    variant: {
      default: "bg-white text-accent-950 dark:bg-accent-900 dark:text-accent-50",
      destructive:
        "border-danger-500 bg-danger-50 text-danger-700 dark:border-danger-700 dark:bg-danger-950/40 dark:text-danger-200 [&>svg]:text-current [&_[data-slot=alert-description]]:text-danger-700 dark:[&_[data-slot=alert-description]]:text-danger-200",
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
