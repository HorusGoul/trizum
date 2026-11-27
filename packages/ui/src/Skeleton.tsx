import { cn } from "./utils.js";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "shrink-0 animate-pulse rounded-md bg-neutral-50 dark:bg-neutral-900",
        className,
      )}
    />
  );
}
