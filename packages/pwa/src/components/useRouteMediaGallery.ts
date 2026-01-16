import { useCallback } from "react";

export interface UseRouteMediaGalleryOptions {
  /** Current media index from route search params */
  mediaIndex: number | undefined;
  /** Navigate function from useNavigate({ from: Route.fullPath }) */
  navigate: (options: { search: { media: number }; replace?: boolean }) => void;
  /** Function to navigate back (e.g., history.back) */
  goBack: () => void;
}

export interface UseRouteMediaGalleryReturn {
  /** Current gallery index */
  galleryIndex: number | undefined;
  /** Whether the gallery is open */
  isOpen: boolean;
  /** Open the gallery at a specific index */
  openGallery: (index: number) => void;
  /** Close the gallery (navigates back) */
  closeGallery: () => void;
  /** Change the current index (with replace) */
  onIndexChange: (index: number) => void;
}

/**
 * Hook to manage route-based media gallery state.
 * Handles navigation for opening/closing/changing gallery index.
 */
export function useRouteMediaGallery({
  mediaIndex,
  navigate,
  goBack,
}: UseRouteMediaGalleryOptions): UseRouteMediaGalleryReturn {
  const galleryIndex = mediaIndex;
  const isOpen = galleryIndex !== undefined && galleryIndex >= 0;

  const openGallery = useCallback(
    (index: number) => {
      navigate({ search: { media: index } });
    },
    [navigate],
  );

  const closeGallery = useCallback(() => {
    goBack();
  }, [goBack]);

  const onIndexChange = useCallback(
    (index: number) => {
      navigate({ search: { media: index }, replace: true });
    },
    [navigate],
  );

  return {
    galleryIndex,
    isOpen,
    openGallery,
    closeGallery,
    onIndexChange,
  };
}
