import { cn, type ClassName } from "#src/ui/utils.ts";
import { use, useCallback, useEffect, useRef } from "react";
import { useGesture } from "@use-gesture/react";
import { motion, useMotionValue } from "framer-motion";
import type { IconProps } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { t } from "@lingui/macro";

export type MediaGalleryItem = {
  src: string;
};

export interface MediaGalleryProps {
  items: MediaGalleryItem[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}

export default function MediaGallery({
  items,
  index,
  onClose,
  onChange,
}: MediaGalleryProps) {
  const dataSource = useAsyncMediaGalleryItems(items);
  const maxIndex = dataSource.length - 1;

  const goToPrevious = useCallback(() => {
    let nextIndex = index - 1;

    if (nextIndex < 0) {
      nextIndex = maxIndex;
    }

    onChange(nextIndex);
  }, [onChange, index, maxIndex]);

  const goToNext = useCallback(() => {
    let nextIndex = index + 1;

    if (nextIndex > maxIndex) {
      nextIndex = 0;
    }

    onChange(nextIndex);
  }, [onChange, index, maxIndex]);

  const showNavigation = items.length > 1;

  const currentItem = dataSource[index];

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  const viewportRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useGesture(
    {
      // Update x and y values based on drag gesture
      onDrag: ({ offset: [offsetX, offsetY], pinching, cancel }) => {
        if (pinching) return cancel();

        x.set(offsetX);
        y.set(offsetY);
      },
      onPinch: ({ offset: [s] }) => {
        scale.set(s);

        // TODO: when zooming, the image should be centered on the pinch point
      },
    },
    {
      target: ref,
      pinch: {
        scaleBounds: { min: 0.5, max: 4 },
        rubberband: true,
      },
      drag: {
        from: () => [x.get(), y.get()],
        rubberband: false,
        bounds: () => {
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

  useEffect(() => {
    x.set(0);
    y.set(0);
    scale.set(1);
  }, [index, x, y, scale]);

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full touch-none overflow-hidden"
    >
      <div className="flex h-full w-full select-none items-center justify-center [-webkit-user-drag:_none]">
        <motion.div ref={ref} className="relative" style={{ x, y, scale }}>
          <div className="absolute inset-0" />
          <img
            src={currentItem.src}
            alt=""
            className="pointer-events-none select-none [-webkit-user-drag:_none]"
          />
        </motion.div>
      </div>

      <GalleryButton
        className="right-4 top-4"
        label={t`Close`}
        icon="#lucide/x"
        onClick={onClose}
      />

      {showNavigation && (
        <>
          <GalleryButton
            className="left-4 top-1/2 -translate-y-1/2 transform"
            label={t`Previous`}
            icon="#lucide/arrow-left"
            onClick={goToPrevious}
          />

          <GalleryButton
            className="right-4 top-1/2 -translate-y-1/2 transform"
            label={t`Next`}
            icon="#lucide/arrow-right"
            onClick={goToNext}
          />
        </>
      )}
    </div>
  );
}

interface GalleryButtonProps {
  className?: ClassName;
  label: string;
  onClick: () => void;
  icon: IconProps["name"];
}

function GalleryButton({
  className,
  label,
  onClick,
  icon,
}: GalleryButtonProps) {
  return (
    <IconButton
      className={cn("text-surface-0 absolute drop-shadow-lg", className)}
      onPress={onClick}
      aria-label={label}
      icon={icon}
    />
  );
}

const itemCacheBySrc = new Map<string, MediaGalleryItem>();
const itemPromiseCacheBySrc = new Map<string, Promise<MediaGalleryItem>>();

// Make use of Suspense throw promise to load the item

function loadMediaGalleryItem(originalItem: MediaGalleryItem) {
  const { src } = originalItem;

  const cachedItem = itemCacheBySrc.get(src);

  if (cachedItem) {
    return cachedItem;
  }

  if (itemPromiseCacheBySrc.has(src)) {
    return use(itemPromiseCacheBySrc.get(src) as Promise<MediaGalleryItem>);
  }

  const promise = new Promise<MediaGalleryItem>((resolve, reject) => {
    const image = new Image();
    image.src = src;
    image.onload = () => {
      const completeItem = {
        ...originalItem,
        width: image.width,
        height: image.height,
      };

      itemCacheBySrc.set(src, completeItem);
      resolve(completeItem);
    };
    image.onerror = () => {
      reject(new Error(`Failed to load image ${src}`));
    };
  });

  itemPromiseCacheBySrc.set(src, promise);
  return use(promise);
}

function useAsyncMediaGalleryItems(items: MediaGalleryItem[]) {
  return items.map(loadMediaGalleryItem);
}
