import { closeRouteState, navigateWithoutDuplicateEntry } from "#src/lib/navigationHistory.ts";
import type { ParsedLocation, RouterHistory } from "@tanstack/react-router";

export interface UseRouteQRScannerOptions {
  /** Whether scanner is active from route search params */
  scanning: boolean | undefined;
  currentLocation: Pick<ParsedLocation, "href" | "state">;
  buildLocation: (options: {
    search: { scanning?: boolean };
    replace?: boolean;
  }) => Pick<ParsedLocation, "href">;
  /** Navigate function to update search params */
  navigate: (options: { search: { scanning?: boolean }; replace?: boolean }) => void;
  history: Pick<RouterHistory, "go">;
}

export interface UseRouteQRScannerReturn {
  /** Whether the scanner is open */
  isOpen: boolean;
  /** Open the scanner */
  openScanner: () => void;
  /** Close the scanner (navigates back) */
  closeScanner: () => void;
}

/**
 * Hook to manage route-based QR scanner state.
 * Handles navigation for opening/closing the scanner.
 */
export function useRouteQRScanner({
  scanning,
  currentLocation,
  buildLocation,
  navigate,
  history,
}: UseRouteQRScannerOptions): UseRouteQRScannerReturn {
  const isOpen = scanning === true;

  function openScanner() {
    navigateWithoutDuplicateEntry(currentLocation, buildLocation, navigate, {
      search: { scanning: true },
    });
  }

  function closeScanner() {
    closeRouteState(currentLocation, history, () => {
      navigate({
        search: { scanning: undefined },
        replace: true,
      });
    });
  }

  return {
    isOpen,
    openScanner,
    closeScanner,
  };
}
