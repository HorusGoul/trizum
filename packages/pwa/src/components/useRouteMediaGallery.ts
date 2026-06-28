import { closeRouteState, navigateWithoutDuplicateEntry } from "#src/lib/navigationHistory.ts";
import type { ParsedLocation, RouterHistory } from "@tanstack/react-router";

export interface UseRouteMediaGalleryOptions {
  /** Current media index from route search params */
  mediaIndex: number | undefined;
  currentLocation: Pick<ParsedLocation, "href" | "state">;
  buildLocation: (options: {
    search: { media?: number };
    replace?: boolean;
  }) => Pick<ParsedLocation, "href">;
  /** Navigate function from useNavigate({ from: Route.fullPath }) */
  navigate: (options: { search: { media?: number }; replace?: boolean }) => void;
  history: Pick<RouterHistory, "go">;
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
  currentLocation,
  buildLocation,
  navigate,
  history,
}: UseRouteMediaGalleryOptions): UseRouteMediaGalleryReturn {
  const galleryIndex = mediaIndex;
  const isOpen = galleryIndex !== undefined && galleryIndex >= 0;

  function openGallery(index: number) {
    navigateWithoutDuplicateEntry(currentLocation, buildLocation, navigate, {
      search: { media: index },
    });
  }

  function closeGallery() {
    closeRouteState(currentLocation, history, () => {
      navigate({
        search: { media: undefined },
        replace: true,
      });
    });
  }

  function onIndexChange(index: number) {
    navigate({ search: { media: index }, replace: true });
  }

  return {
    galleryIndex,
    isOpen,
    openGallery,
    closeGallery,
    onIndexChange,
  };
}
