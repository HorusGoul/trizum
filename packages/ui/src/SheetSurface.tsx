import type { ReactNode } from "react";
import { motion, useTransform } from "motion/react";
import { Sheet } from "react-modal-sheet";
import { cn, type ClassName } from "./utils.js";

/** Stretches the sheet's decoration during overdrag without changing content or snap measurements. */
export function SheetSurface({
  children,
  contentClassName,
}: {
  children: ReactNode;
  contentClassName?: ClassName;
}) {
  const { y } = Sheet.useContext();
  const bottom = useTransform(y, (value) => Math.min(0, value));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col p-px">
      <motion.div
        aria-hidden="true"
        data-sheet-surface=""
        className="border-accent-200/80 to-accent-50/95 dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900 pointer-events-none absolute inset-x-0 top-0 rounded-t-[1.75rem] border bg-gradient-to-b from-white via-white shadow-[0_-10px_40px_rgba(15,23,42,0.24)] dark:shadow-none"
        style={{ bottom }}
      />
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[calc(1.75rem-1px)]",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
