import * as React from "react";
import { cn } from "./utils.js";

export function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 min-h-4 font-medium tracking-tight text-pretty wrap-break-word",
        className,
      )}
      {...props}
    />
  );
}
