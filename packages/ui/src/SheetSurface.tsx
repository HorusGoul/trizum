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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <motion.div
        aria-hidden="true"
        data-sheet-surface=""
        className="shadow-overlay pointer-events-none absolute inset-x-0 top-0 rounded-t-[2rem] bg-neutral-100 dark:bg-neutral-900"
        style={{ bottom }}
      />
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[2rem] text-neutral-950 dark:text-neutral-50",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
