import { Modal, ModalOverlay } from "react-aria-components";
import { Suspense, useState } from "react";
import { useMediaFileObjectUrls } from "#src/hooks/useMediaFile.ts";
import MediaGallery, { MediaGalleryImage } from "#src/components/MediaGallery.tsx";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import type { MediaFile } from "#src/models/media.ts";

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
  const selectedPhotoId = galleryIndex === undefined ? undefined : photoIds[galleryIndex];

  // Track drag progress for background opacity animation
  const [dragProgress, setDragProgress] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDragProgress(0);
    }
  }

  function handleDragProgress(progress: number) {
    setDragProgress(progress);
  }

  // Calculate background opacity and blur based on drag progress
  const backgroundOpacity = 0.25 * (1 - dragProgress);
  const backdropBlur = `blur(${(1 - dragProgress) * 8}px)`;

  return (
    <ModalOverlay
      data-media-gallery-overlay=""
      isOpen={isOpen}
      className={({ isEntering, isExiting }) =>
        `fixed inset-0 isolate z-50 ${isEntering ? "animate-in fade-in duration-300 ease-out" : ""} ${isExiting ? "animate-out fade-out duration-200 ease-in" : ""} `
      }
      style={{
        backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity})`,
        backdropFilter: backdropBlur,
        WebkitBackdropFilter: backdropBlur,
      }}
    >
      <Modal className="h-full w-full">
        {isOpen && selectedPhotoId && (
          <MediaGallery
            getItemKey={(index) => photoIds[index]}
            itemCount={photoIds.length}
            index={galleryIndex}
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
  const [mediaFile] = useSuspenseDocument<MediaFile>(photoId as MediaFile["id"], {
    required: true,
  });
  const [url] = useMediaFileObjectUrls([mediaFile]);

  return (
    <Suspense fallback={null}>
      <MediaGalleryImage items={[{ src: url }]} index={0} />
    </Suspense>
  );
}
