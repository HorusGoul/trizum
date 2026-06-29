import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  LazyMotion,
  animate,
  domAnimation,
  m as motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";
import { Icon } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";
import { cancelIdleCallback, requestIdleCallback } from "#src/lib/requestIdleCallback.ts";

const refreshThreshold = 72;
const maxPullDistance = 96;
const refreshingIndicatorHeight = 56;
const indicatorSpring = {
  type: "spring",
  stiffness: 420,
  damping: 36,
} as const;

export function PullToRefresh({
  children,
  refreshAction,
  scrollElementRef,
}: {
  children: ReactNode;
  refreshAction: () => Promise<unknown>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const refreshActionRef = useRef(refreshAction);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pullAnimationRef = useRef<AnimationPlaybackControls | null>(null);
  const finishRefreshIdleCallbackRef = useRef<number | null>(null);
  const finishRefreshFrameRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);
  const pullDistance = useMotionValue(0);
  const indicatorScale = useTransform(pullDistance, [0, refreshThreshold], [0.85, 1], {
    clamp: true,
  });
  const indicatorOpacity = useTransform(pullDistance, [0, 1], [0, 1], {
    clamp: true,
  });
  const iconRotate = useTransform(pullDistance, [0, refreshThreshold], [0, 180], {
    clamp: true,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  refreshActionRef.current = refreshAction;

  function stopPullAnimation() {
    pullAnimationRef.current?.stop();
    pullAnimationRef.current = null;
  }

  function setPullDistance(value: number) {
    stopPullAnimation();
    pullDistance.set(value);
  }

  function animatePullDistance(value: number, onComplete?: () => void) {
    stopPullAnimation();
    const animation = animate(pullDistance, value, {
      ...indicatorSpring,
      onComplete: () => {
        if (pullAnimationRef.current === animation) {
          pullAnimationRef.current = null;
        }

        onComplete?.();
      },
    });

    pullAnimationRef.current = animation;
  }

  function isScrolledToTop() {
    return (scrollElementRef.current?.scrollTop ?? 0) <= 0;
  }

  async function refresh() {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    animatePullDistance(refreshingIndicatorHeight);

    try {
      await refreshActionRef.current();
    } finally {
      scheduleRefreshFinish();
    }
  }

  function clearScheduledRefreshFinish() {
    if (finishRefreshIdleCallbackRef.current !== null) {
      cancelIdleCallback(finishRefreshIdleCallbackRef.current);
      finishRefreshIdleCallbackRef.current = null;
    }

    if (finishRefreshFrameRef.current !== null) {
      cancelAnimationFrame(finishRefreshFrameRef.current);
      finishRefreshFrameRef.current = null;
    }
  }

  function scheduleRefreshFinish() {
    clearScheduledRefreshFinish();

    finishRefreshIdleCallbackRef.current = requestIdleCallback(() => {
      finishRefreshIdleCallbackRef.current = null;
      finishRefreshFrameRef.current = requestAnimationFrame(() => {
        finishRefreshFrameRef.current = null;
        animatePullDistance(0, () => {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        });
      });
    });
  }

  function onTouchStart(event: TouchEvent) {
    if (isRefreshingRef.current || !isScrolledToTop()) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchMove(event: TouchEvent) {
    const start = touchStartRef.current;
    const touch = event.touches[0];

    if (!start || !touch) {
      return;
    }

    const xDistance = touch.clientX - start.x;
    const yDistance = touch.clientY - start.y;

    if (Math.abs(xDistance) > Math.abs(yDistance)) {
      touchStartRef.current = null;
      animatePullDistance(0);
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

    setPullDistance(Math.min(yDistance * 0.55, maxPullDistance));
  }

  function onTouchEnd() {
    const shouldRefresh = pullDistance.get() >= refreshThreshold;

    touchStartRef.current = null;

    if (shouldRefresh) {
      void refresh().catch(() => undefined);
      return;
    }

    animatePullDistance(0);
  }

  function onTouchCancel() {
    touchStartRef.current = null;
    animatePullDistance(0);
  }

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchCancel);
    };
  });

  return (
    <LazyMotion features={domAnimation}>
      <motion.div ref={rootRef} className="flex min-h-full flex-col">
        <motion.div
          aria-hidden={true}
          className="flex flex-shrink-0 items-end justify-center overflow-hidden"
          style={{ height: pullDistance }}
        >
          <motion.div
            className="mb-3 flex size-10 items-center justify-center rounded-full border border-accent-200 bg-white text-accent-600 shadow-sm dark:border-accent-700 dark:bg-accent-900 dark:text-accent-200"
            style={{
              opacity: indicatorOpacity,
              scale: indicatorScale,
            }}
          >
            <motion.span className="flex" style={{ rotate: isRefreshing ? 0 : iconRotate }}>
              <Icon
                icon={isRefreshing ? "lucide.loader-circle" : "lucide.refresh-cw"}
                width={20}
                height={20}
                className={cn(isRefreshing && "animate-spin")}
              />
            </motion.span>
          </motion.div>
        </motion.div>

        {children}
      </motion.div>
    </LazyMotion>
  );
}
