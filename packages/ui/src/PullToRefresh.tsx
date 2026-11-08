import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  LazyMotion,
  animate,
  domAnimation,
  m as motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import { Icon } from "./Icon.js";
import { cn } from "./utils.js";
import { cancelIdleCallback, requestIdleCallback } from "./requestIdleCallback.js";

const refreshThreshold = 72;
const maxPullDistance = 96;
const refreshingIndicatorHeight = 64;

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
  refreshAction: () => Promise<void>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}) {
  const reducedMotion = useReducedMotion();
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

  useEffect(() => {
    refreshActionRef.current = refreshAction;
  }, [refreshAction]);

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
      ...(reducedMotion ? { duration: 0.1 } : indicatorSpring),
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

    await Promise.resolve()
      .then(() => refreshActionRef.current())
      .finally(scheduleRefreshFinish);
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
    if (event.touches.length !== 1 || isRefreshingRef.current || !isScrolledToTop()) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    const currentDistance = pullDistance.get();
    stopPullAnimation();
    touchStartRef.current = { x: touch.clientX, y: touch.clientY - currentDistance / 0.55 };
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) {
      if (touchStartRef.current && !isRefreshingRef.current) {
        touchStartRef.current = null;
        animatePullDistance(0);
      }

      return;
    }

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

    if (event.cancelable) {
      event.preventDefault();
    }

    const distance = yDistance * 0.55;
    setPullDistance(
      distance <= refreshThreshold
        ? distance
        : refreshThreshold +
            (maxPullDistance - refreshThreshold) *
              (1 - Math.exp(-(distance - refreshThreshold) / (maxPullDistance - refreshThreshold))),
    );
  }

  function onTouchEnd() {
    if (!touchStartRef.current || isRefreshingRef.current) return;

    const shouldRefresh = pullDistance.get() >= refreshThreshold;

    touchStartRef.current = null;

    if (shouldRefresh) {
      void refresh().catch(() => undefined);

      return;
    }

    animatePullDistance(0);
  }

  function onTouchCancel() {
    if (!touchStartRef.current || isRefreshingRef.current) return;
    touchStartRef.current = null;
    animatePullDistance(0);
  }

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    // eslint-disable-next-line react-doctor/client-passive-event-listeners -- Pull-to-refresh must cancel top-edge rubber-band overscroll after the vertical pull gesture is recognized.
    root.addEventListener("touchmove", onTouchMove, { passive: false });
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
          className="flex shrink-0 items-end justify-center overflow-hidden"
          style={{ height: pullDistance }}
        >
          <motion.div
            className="border-accent-200 text-accent-600 dark:border-accent-700 dark:bg-accent-900 dark:text-accent-200 mb-3 flex size-10 items-center justify-center rounded-full border bg-white shadow-xs"
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
