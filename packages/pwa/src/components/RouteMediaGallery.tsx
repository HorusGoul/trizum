import { useAppData } from "#src/lib/data/useAppData.ts";
import { MediaContentView } from "#src/lib/data/views.ts";
import type { MediaEntity } from "#src/lib/data/entities.ts";
import { Modal, ModalOverlay } from "react-aria-components";
import { Suspense, useState, useRef } from "react";
import { useMediaFileObjectUrls } from "#src/hooks/useMediaFile.ts";
import MediaGallery, { MediaGalleryImage } from "@trizum/ui/MediaGallery";
import { useRequiredView } from "#src/lib/data/hooks.ts";

export interface RouteMediaGalleryProps {
  /** List of photo IDs to display in the gallery */
  photoIds: string[];
  /** Current gallery index from search params */
  galleryIndex: number | undefined;
  /** Called when the gallery index changes (for navigation) */
  onIndexChange: (index: number) => void;
  /** Called when the gallery should close */
  onClose: () => void;
}

/**
 * A media gallery component designed to be used with route search params.
 * Handles photo URL resolution and provides animated backdrop with drag feedback.
 */
export function RouteMediaGallery({
  photoIds,
  galleryIndex,
  onIndexChange,
  onClose,
}: RouteMediaGalleryProps) {
  const isOpen = galleryIndex !== undefined && galleryIndex >= 0;
  const [lastIndex, setLastIndex] = useState(galleryIndex);

  if (isOpen && galleryIndex !== lastIndex) setLastIndex(galleryIndex);
  const displayedIndex = isOpen ? galleryIndex : lastIndex;
  const selectedPhotoId = displayedIndex === undefined ? undefined : photoIds[displayedIndex];

  // Track drag progress for background opacity animation
  const overlayRef = useRef<HTMLDivElement>(null);

  function setDragProgress(progress: number) {
    const overlay = overlayRef.current;

    if (!overlay) return;
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${0.25 * (1 - progress)})`;
    overlay.style.backdropFilter = `blur(${8 * (1 - progress)}px)`;
    overlay.style.setProperty("-webkit-backdrop-filter", `blur(${8 * (1 - progress)}px)`);
  }

  function handleDragProgress(progress: number) {
    setDragProgress(progress);
  }

  return (
    <ModalOverlay
      ref={overlayRef}
      data-media-gallery-overlay=""
      isOpen={isOpen}
      className={({ isEntering, isExiting }) =>
        `fixed inset-0 isolate z-50 ${isEntering ? "animate-in fade-in duration-300 ease-out" : ""} ${isExiting ? "animate-out fade-out duration-200 ease-out" : ""} `
      }
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.25)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <Modal className="h-full w-full">
        {displayedIndex !== undefined && selectedPhotoId && (
          <MediaGallery
            isOpen={isOpen}
            getItemKey={(index) => photoIds[index]}
            itemCount={photoIds.length}
            index={displayedIndex}
            renderItem={(index) => <RouteMediaGalleryImage photoId={photoIds[index]} />}
            onChange={onIndexChange}
            onClose={onClose}
            onDragProgress={handleDragProgress}
          />
        )}
      </Modal>
    </ModalOverlay>
  );
}

function RouteMediaGalleryImage({ photoId }: { photoId: string }) {
  const data = useAppData();

  const mediaFile = useRequiredView(
    MediaContentView,
    data.entityRef<MediaEntity>("Media", photoId, MediaContentView),
  );

  const [url] = useMediaFileObjectUrls([mediaFile]);

  return (
    <Suspense fallback={null}>
      <MediaGalleryImage items={[{ src: url }]} index={0} />
    </Suspense>
  );
}
