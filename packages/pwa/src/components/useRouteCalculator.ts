import { navigateWithoutDuplicateEntry } from "#src/lib/navigationHistory.ts";
import type { ParsedLocation } from "@tanstack/react-router";

export interface UseRouteCalculatorOptions {
  calculatorId: string | undefined;
  currentLocation: Pick<ParsedLocation, "href" | "state">;
  buildLocation: (options: {
    search: { calculator?: string };
    replace?: boolean;
    resetScroll?: boolean;
  }) => Pick<ParsedLocation, "href">;
  navigate: (options: {
    search: { calculator?: string };
    replace?: boolean;
    resetScroll?: boolean;
  }) => void;
}

export interface UseRouteCalculatorReturn {
  activeCalculatorId: string | undefined;
  openCalculator: (calculatorId: string) => void;
  closeCalculator: () => void;
}

function captureWindowScrollRestoration() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return () => {
    window.requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
      window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
    });
    window.setTimeout(() => window.scrollTo(scrollX, scrollY), 50);
  };
}

export function useRouteCalculator({
  calculatorId,
  currentLocation,
  buildLocation,
  navigate,
}: UseRouteCalculatorOptions): UseRouteCalculatorReturn {
  function openCalculator(nextCalculatorId: string) {
    navigateWithoutDuplicateEntry(currentLocation, buildLocation, navigate, {
      search: { calculator: nextCalculatorId },
      resetScroll: false,
    });
  }

  function closeCalculator() {
    const restoreScroll = captureWindowScrollRestoration();

    navigate({
      search: { calculator: undefined },
      replace: true,
      resetScroll: false,
    });
    restoreScroll();
  }

  return {
    activeCalculatorId: calculatorId,
    openCalculator,
    closeCalculator,
  };
}
