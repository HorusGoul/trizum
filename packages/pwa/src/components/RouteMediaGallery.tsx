import { Modal, ModalOverlay } from "react-aria-components";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import MediaGallery, {
  type MediaGalleryItem,
} from "#src/components/MediaGallery.tsx";

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

  // Track drag progress for background opacity animation
  const [dragProgress, setDragProgress] = useState(0);
  const handleDragProgress = useCallback((progress: number) => {
    setDragProgress(progress);
  }, []);

  // Calculate background opacity and blur based on drag progress
  const backgroundOpacity = 0.25 * (1 - dragProgress);
  const backdropBlur = `blur(${(1 - dragProgress) * 8}px)`;

  return (
    <ModalOverlay
      isOpen={isOpen}
      className={({ isEntering, isExiting }) =>
        `absolute left-0 top-0 isolate z-10 h-full w-full ${isEntering ? "duration-300 ease-out animate-in fade-in" : ""} ${isExiting ? "duration-200 ease-in animate-out fade-out" : ""} `
      }
      style={{
        backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity})`,
        backdropFilter: backdropBlur,
        WebkitBackdropFilter: backdropBlur,
      }}
    >
      <Modal className="h-full w-full">
        {isOpen && photoIds.length > 0 && (
          <Suspense fallback={null}>
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
  // Build items by rendering hidden resolver components
  const [resolvedUrls, setResolvedUrls] = useState<string[]>([]);

  // When all URLs are resolved, render the gallery
  if (resolvedUrls.length === photoIds.length) {
    const galleryItems: MediaGalleryItem[] = resolvedUrls.map((url) => ({
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

  // Render resolvers for each photo
  return (
    <>
      {photoIds.map((photoId, idx) => (
        <PhotoUrlResolver
          key={photoId}
          photoId={photoId}
          onResolved={(url) => {
            setResolvedUrls((prev) => {
              const next = [...prev];
              next[idx] = url;
              return next;
            });
          }}
        />
      ))}
    </>
  );
}

interface PhotoUrlResolverProps {
  photoId: string;
  onResolved: (url: string) => void;
}

function PhotoUrlResolver({ photoId, onResolved }: PhotoUrlResolverProps) {
  const { url } = useMediaFile(photoId);

  useEffect(() => {
    onResolved(url);
  }, [url, onResolved]);

  return null;
}
