import {
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { Icon } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

const refreshThreshold = 72;
const maxPullDistance = 96;

export function PullToRefresh({
  children,
  refreshAction,
  scrollElementRef,
}: {
  children: ReactNode;
  refreshAction: () => Promise<unknown>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pullDistanceRef = useRef(0);
  const [pullDistance, setPullDistanceState] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function setPullDistance(value: number) {
    pullDistanceRef.current = value;
    setPullDistanceState(value);
  }

  function isScrolledToTop() {
    return (scrollElementRef.current?.scrollTop ?? 0) <= 0;
  }

  async function refresh() {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      await refreshAction();
    } finally {
      setIsRefreshing(false);
    }
  }

  function onTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (isRefreshing || !isScrolledToTop()) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    const touch = event.touches[0];

    if (!start || !touch) {
      return;
    }

    const xDistance = touch.clientX - start.x;
    const yDistance = touch.clientY - start.y;

    if (Math.abs(xDistance) > Math.abs(yDistance)) {
      setPullDistance(0);
      return;
    }

    if (yDistance <= 0) {
      setPullDistance(0);
      return;
    }

    if (!isScrolledToTop()) {
      touchStartRef.current = null;
      setPullDistance(0);
      return;
    }

    event.preventDefault();
    setPullDistance(Math.min(yDistance * 0.55, maxPullDistance));
  }

  function onTouchEnd() {
    const shouldRefresh = pullDistanceRef.current >= refreshThreshold;

    touchStartRef.current = null;
    setPullDistance(0);

    if (shouldRefresh) {
      void refresh().catch(() => undefined);
    }
  }

  function onTouchCancel() {
    touchStartRef.current = null;
    setPullDistance(0);
  }

  const indicatorProgress = isRefreshing ? 1 : Math.min(pullDistance / refreshThreshold, 1);
  const indicatorHeight = isRefreshing ? 56 : pullDistance;

  return (
    <div
      className="flex min-h-full flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        aria-hidden={true}
        className="flex flex-shrink-0 items-end justify-center overflow-hidden transition-all duration-150 ease-out"
        style={{ height: indicatorHeight }}
      >
        <div
          className={cn(
            "mb-3 flex size-10 items-center justify-center rounded-full border border-accent-200 bg-white text-accent-600 shadow-sm transition-all dark:border-accent-700 dark:bg-accent-900 dark:text-accent-200",
            indicatorHeight > 0 ? "opacity-100" : "opacity-0",
          )}
          style={{ transform: `scale(${0.85 + indicatorProgress * 0.15})` }}
        >
          <Icon
            icon={isRefreshing ? "lucide.loader-circle" : "lucide.refresh-cw"}
            width={20}
            height={20}
            className={cn(isRefreshing && "animate-spin")}
          />
        </div>
      </div>

      {children}
    </div>
  );
}
