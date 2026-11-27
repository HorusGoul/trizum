import { cn } from "./utils.js";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "shrink-0 animate-pulse rounded-lg bg-neutral-950/5 dark:bg-white/10",
        className,
      )}
    />
  );
}
