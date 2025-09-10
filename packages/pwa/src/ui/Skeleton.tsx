import { cn } from "#src/ui/utils.ts";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "flex-shrink-0 animate-pulse rounded-md bg-accent-50 dark:bg-accent-950",
        className,
      )}
    />
  );
}
