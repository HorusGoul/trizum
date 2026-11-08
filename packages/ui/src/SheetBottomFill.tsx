import { motion, useTransform } from "motion/react";
import { Sheet } from "react-modal-sheet";

/** Keeps the bottom edge covered while the sheet overdrags above its top snap point. */
export function SheetBottomFill() {
  const { y } = Sheet.useContext();
  const height = useTransform(y, (value) => Math.max(0, -value));

  return (
    <motion.div
      aria-hidden="true"
      className="from-accent-50/95 to-accent-50/95 dark:from-accent-900 dark:to-accent-900 pointer-events-none absolute inset-x-0 bottom-0 z-[2] mx-auto w-full max-w-xl bg-linear-to-b"
      style={{ height }}
    />
  );
}
