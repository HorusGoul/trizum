import { Modal, ModalOverlay } from "react-aria-components";
import { Suspense, useState } from "react";
import { useMediaFileObjectUrls } from "#src/hooks/useMediaFile.ts";
import MediaGallery, { type MediaGalleryItem } from "#src/components/MediaGallery.tsx";
import { useMultipleSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
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

  function handleDragProgress(progress: number) {
    setDragProgress(progress);
  }

  // Calculate background opacity and blur based on drag progress
  const backgroundOpacity = 0.25 * (1 - dragProgress);
  const backdropBlur = `blur(${(1 - dragProgress) * 8}px)`;

  return (
    <ModalOverlay
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
          <Suspense key={`${galleryIndex}:${selectedPhotoId}`} fallback={null}>
            <GalleryItemsResolver
              photoIds={photoIds}
              index={galleryIndex}
              onChange={onIndexChange}
              onClose={onClose}
              onDragProgress={handleDragProgress}
            />
          </Suspense>
        )}
      </Modal>
    </ModalOverlay>
  );
}

interface GalleryItemsResolverProps {
  photoIds: string[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
  onDragProgress: (progress: number) => void;
}

// This component renders children for each photo to resolve URLs
function GalleryItemsResolver({
  photoIds,
  index,
  onChange,
  onClose,
  onDragProgress,
}: GalleryItemsResolverProps) {
  const mediaFileIds = photoIds as MediaFile["id"][];
  const mediaFiles = useMultipleSuspenseDocument<MediaFile>(mediaFileIds, {
    required: true as const,
  }).map(({ doc }) => doc);
  const urls = useMediaFileObjectUrls(mediaFiles);
  const galleryItems: MediaGalleryItem[] = urls.map((url) => ({
    src: url,
  }));

  return (
    <MediaGallery
      index={index}
      items={galleryItems}
      onChange={onChange}
      onClose={onClose}
      onDragProgress={onDragProgress}
    />
  );
}
