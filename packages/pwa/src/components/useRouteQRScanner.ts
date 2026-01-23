import { useCallback } from "react";

export interface UseRouteQRScannerOptions {
  /** Whether scanner is active from route search params */
  scanning: boolean | undefined;
  /** Navigate function to update search params */
  navigate: (options: {
    search: { scanning?: boolean };
    replace?: boolean;
  }) => void;
  /** Function to navigate back (e.g., history.back) */
  goBack: () => void;
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
  navigate,
  goBack,
}: UseRouteQRScannerOptions): UseRouteQRScannerReturn {
  const isOpen = scanning === true;

  const openScanner = useCallback(() => {
    navigate({ search: { scanning: true } });
  }, [navigate]);

  const closeScanner = useCallback(() => {
    goBack();
  }, [goBack]);

  return {
    isOpen,
    openScanner,
    closeScanner,
  };
}
