import { closeRouteState, navigateWithoutDuplicateEntry } from "#src/lib/navigationHistory.ts";
import type { ParsedLocation, RouterHistory } from "@tanstack/react-router";

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
  history: Pick<RouterHistory, "go">;
}

export interface UseRouteCalculatorReturn {
  activeCalculatorId: string | undefined;
  openCalculator: (calculatorId: string) => void;
  closeCalculator: () => void;
}

export function useRouteCalculator({
  calculatorId,
  currentLocation,
  buildLocation,
  navigate,
  history,
}: UseRouteCalculatorOptions): UseRouteCalculatorReturn {
  function openCalculator(nextCalculatorId: string) {
    navigateWithoutDuplicateEntry(currentLocation, buildLocation, navigate, {
      search: { calculator: nextCalculatorId },
      resetScroll: false,
    });
  }

  function closeCalculator() {
    closeRouteState(currentLocation, history, () => {
      navigate({
        search: { calculator: undefined },
        replace: true,
        resetScroll: false,
      });
    });
  }

  return {
    activeCalculatorId: calculatorId,
    openCalculator,
    closeCalculator,
  };
}
