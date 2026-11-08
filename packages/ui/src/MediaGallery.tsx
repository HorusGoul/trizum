import { useLingui } from "@lingui/react/macro";
import { cn, type ClassName } from "./utils.js";
import { Suspense, use, useEffect, useEffectEvent, useRef } from "react";
import { useGesture } from "@use-gesture/react";
import {
  LazyMotion,
  animate,
  domAnimation,
  m,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import type { IconProps } from "./Icon.js";
import { IconButton } from "./IconButton.js";
import {
  calculateMediaGalleryPinchTransform,
  type MediaGalleryPoint,
} from "./mediaGalleryPinch.js";
import { mediaGalleryItemLoader, type MediaGalleryItem } from "./mediaGalleryItemLoader.js";

export type { MediaGalleryItem } from "./mediaGalleryItemLoader.js";

interface MediaGalleryCommonProps {
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
  onDragProgress?: (progress: number) => void;
  showCloseButton?: boolean;
}

export type MediaGalleryProps = MediaGalleryCommonProps &
  (
    | {
        items: MediaGalleryItem[];
        itemCount?: never;
        renderItem?: never;
      }
    | {
        getItemKey: (index: number) => React.Key;
        items?: never;
        itemCount: number;
        renderItem: (index: number) => React.ReactNode;
      }
  );

const CLOSE_THRESHOLD = 150;

export default function MediaGallery(props: MediaGalleryProps) {
  const { t } = useLingui();
  const { index, onClose, onChange, onDragProgress, showCloseButton = true } = props;
  const itemCount = props.items !== undefined ? props.items.length : props.itemCount;

  const currentItemKey =
    props.items !== undefined ? props.items[index]?.src : props.getItemKey(index);

  const maxIndex = itemCount - 1;

  function goToPrevious() {
    let nextIndex = index - 1;

    if (nextIndex < 0) {
      nextIndex = maxIndex;
    }

    onDragProgress?.(0);
    onChange(nextIndex);
  }

  function goToNext() {
    let nextIndex = index + 1;

    if (nextIndex > maxIndex) {
      nextIndex = 0;
    }

    onDragProgress?.(0);
    onChange(nextIndex);
  }

  const showNavigation = itemCount > 1;

  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  const viewportRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const previousPinchOriginRef = useRef<MediaGalleryPoint | null>(null);

  // Keep dismissal feedback active through the drag and its snap-back animation.
  const isDismissalMotionRef = useRef(false);

  function getLocalPinchOrigin([originX, originY]: MediaGalleryPoint) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return null;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const localOriginX = originX - viewportRect.left - viewportRect.width / 2;
    const localOriginY = originY - viewportRect.top - viewportRect.height / 2;

    if (!Number.isFinite(localOriginX) || !Number.isFinite(localOriginY)) {
      return null;
    }

    return [localOriginX, localOriginY] as const;
  }

  function zoomAroundOrigin(nextScale: number, origin: MediaGalleryPoint) {
    const currentScale = scale.get();
    const nextOrigin = getLocalPinchOrigin(origin);

    if (!nextOrigin || currentScale <= 0) {
      scale.set(nextScale);
      previousPinchOriginRef.current = nextOrigin;

      return;
    }

    const transform = calculateMediaGalleryPinchTransform({
      currentPosition: [x.get(), y.get()],
      currentScale,
      previousOrigin: previousPinchOriginRef.current ?? nextOrigin,
      nextOrigin,
      nextScale,
    });

    x.set(transform.x);
    y.set(transform.y);
    scale.set(transform.scale);
    previousPinchOriginRef.current = nextOrigin;
  }

  useGesture(
    {
      onDragStart: () => {
        x.stop();
        y.stop();
        scale.stop();
        // Determine if this is a closing drag (only when not zoomed)
        const currentScale = scale.get();
        isDismissalMotionRef.current = currentScale <= 1;
      },
      onDrag: ({ offset: [offsetX, offsetY], pinching, cancel }) => {
        if (pinching) return cancel();

        // If we're in closing drag mode, track the upward movement
        if (isDismissalMotionRef.current) {
          // Only allow vertical movement for closing gesture
          y.set(offsetY);
        } else {
          // Normal pan behavior when zoomed
          x.set(offsetX);
          y.set(offsetY);
        }
      },
      onDragEnd: ({
        offset: [, offsetY],
        velocity: [, velocityY],
        direction: [, directionY],
        canceled,
      }) => {
        const releaseVelocity = velocityY * directionY * 1000;

        if (isDismissalMotionRef.current) {
          // Check if we crossed the threshold (dragged far enough in either direction)
          if (
            !canceled &&
            (Math.abs(offsetY) >= CLOSE_THRESHOLD ||
              (Math.abs(offsetY) > 10 &&
                Math.abs(releaseVelocity) > 500 &&
                Math.sign(offsetY) === Math.sign(releaseVelocity)))
          ) {
            onClose();
          } else {
            // Animate back to center with spring effect
            void animate(
              y,
              0,
              reducedMotion
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 400, damping: 30, velocity: releaseVelocity },
            );
          }
        }
      },
      onPinchStart: ({ origin }) => {
        x.stop();
        y.stop();
        scale.stop();
        isDismissalMotionRef.current = false;
        previousPinchOriginRef.current = getLocalPinchOrigin(origin);
        onDragProgress?.(0);
      },
      onPinch: ({ offset: [s], origin }) => {
        zoomAroundOrigin(s, origin);
      },
      onPinchEnd: ({ offset: [s] }) => {
        previousPinchOriginRef.current = null;

        if (s < 1 || s > 4) {
          void animate(
            scale,
            Math.max(1, Math.min(4, s)),
            reducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 400, damping: 30 },
          );
        }

        if (s <= 1) {
          void animate(
            x,
            0,
            reducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 400, damping: 30 },
          );
          void animate(
            y,
            0,
            reducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 400, damping: 30 },
          );
        }
      },
    },
    {
      target: ref,
      pinch: {
        from: () => [scale.get(), 0],
        scaleBounds: { min: 0.5, max: 4 },
        rubberband: true,
      },
      drag: {
        from: () => [x.get(), y.get()],
        rubberband: false,
        bounds: () => {
          // Check scale directly - when at normal scale (not zoomed), allow free vertical drag
          const currentScale = scale.get();

          if (currentScale <= 1) {
            return { left: 0, right: 0, top: -Infinity, bottom: Infinity };
          }

          const viewport = viewportRef.current;
          const element = ref.current;

          if (!viewport || !element) {
            return { left: 0, right: 0, top: 0, bottom: 0 };
          }

          const viewportRect = viewport.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();

          const width =
            elementRect.width > viewportRect.width
              ? elementRect.width - viewportRect.width
              : viewportRect.width - elementRect.width;

          const height =
            elementRect.height > viewportRect.height
              ? elementRect.height - viewportRect.height
              : viewportRect.height - elementRect.height;

          const left = -(width / 2);
          const right = width / 2;
          const top = -(height / 2);
          const bottom = height / 2;

          return { left, right, top, bottom };
        },
      },
    },
  );

  useMotionValueEvent(y, "change", (value) => {
    if (isDismissalMotionRef.current) {
      onDragProgress?.(Math.min(1, Math.abs(value) / CLOSE_THRESHOLD));
    }
  });

  const resetDragProgress = useEffectEvent(() => onDragProgress?.(0));

  useEffect(() => {
    resetDragProgress();
    isDismissalMotionRef.current = false;
    x.stop();
    y.stop();
    scale.stop();
    x.set(0);
    y.set(0);
    scale.set(1);
    previousPinchOriginRef.current = null;
  }, [index, x, y, scale]);

  return (
    <LazyMotion features={domAnimation}>
      <div ref={viewportRef} className="relative h-full w-full touch-none overflow-hidden">
        <div className="flex h-full w-full items-center justify-center select-none [-webkit-user-drag:_none]">
          <m.div ref={ref} className="relative" style={{ x, y, scale }}>
            <div className="absolute inset-0" />
            <Suspense key={currentItemKey} fallback={null}>
              {props.items ? (
                <MediaGalleryImage items={props.items} index={index} />
              ) : (
                props.renderItem(index)
              )}
            </Suspense>
          </m.div>
        </div>

        {showCloseButton ? (
          <GalleryButton
            className="right-safe-offset-4 top-safe-offset-4"
            label={t({ id: "ui.mediaGallery.close", message: "Close" })}
            icon="lucide.x"
            onClick={onClose}
          />
        ) : null}

        {showNavigation && (
          <>
            <GalleryButton
              className="left-safe-offset-4 top-1/2 -translate-y-1/2 transform"
              label={t({ id: "ui.mediaGallery.previous", message: "Previous" })}
              icon="lucide.arrow-left"
              onClick={goToPrevious}
            />

            <GalleryButton
              className="right-safe-offset-4 top-1/2 -translate-y-1/2 transform"
              label={t({ id: "ui.mediaGallery.next", message: "Next" })}
              icon="lucide.arrow-right"
              onClick={goToNext}
            />
          </>
        )}
      </div>
    </LazyMotion>
  );
}

export function MediaGalleryImage({ items, index }: { items: MediaGalleryItem[]; index: number }) {
  const item = use(mediaGalleryItemLoader.read(items, index));

  return (
    <img
      data-media-gallery-image=""
      src={item.src}
      alt=""
      className="pointer-events-none select-none [-webkit-user-drag:_none]"
    />
  );
}

interface GalleryButtonProps {
  className?: ClassName;
  label: string;
  onClick: () => void;
  icon: IconProps["icon"];
}

function GalleryButton({ className, label, onClick, icon }: GalleryButtonProps) {
  return (
    <IconButton
      className={cn("text-surface-0 absolute drop-shadow-lg", className)}
      onPress={onClick}
      aria-label={label}
      icon={icon}
    />
  );
}
