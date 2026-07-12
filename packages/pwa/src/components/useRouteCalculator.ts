import { shouldReplaceNavigation } from "#src/lib/navigationHistory.ts";
import type { ParsedLocation, RouterHistory } from "@tanstack/react-router";

const CALCULATOR_HISTORY_STATE_KEY = "__trizum_calculator";

type CalculatorHistoryState = ParsedLocation["state"] & {
  [CALCULATOR_HISTORY_STATE_KEY]?: boolean;
};

type CalculatorNavigateOptions = {
  search: { calculator?: string };
  replace?: boolean;
  resetScroll?: boolean;
  state?: (state: ParsedLocation["state"]) => CalculatorHistoryState;
};

export interface UseRouteCalculatorOptions {
  calculatorId: string | undefined;
  currentLocation: Pick<ParsedLocation, "href" | "state">;
  buildLocation: (options: CalculatorNavigateOptions) => Pick<ParsedLocation, "href">;
  navigate: (options: CalculatorNavigateOptions) => void;
  history: Pick<RouterHistory, "go">;
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

function markCalculatorHistoryState(state: ParsedLocation["state"]): CalculatorHistoryState {
  return {
    ...state,
    [CALCULATOR_HISTORY_STATE_KEY]: true,
  };
}

function isCalculatorHistoryState(state: ParsedLocation["state"]) {
  return (state as CalculatorHistoryState)[CALCULATOR_HISTORY_STATE_KEY] === true;
}

function canCloseCalculatorWithHistoryBack(state: ParsedLocation["state"]) {
  return (
    isCalculatorHistoryState(state) &&
    (!Number.isFinite(state.__TSR_index) || state.__TSR_index > 0)
  );
}

export function useRouteCalculator({
  calculatorId,
  currentLocation,
  buildLocation,
  navigate,
  history,
}: UseRouteCalculatorOptions): UseRouteCalculatorReturn {
  function openCalculator(nextCalculatorId: string) {
    const options: CalculatorNavigateOptions = {
      search: { calculator: nextCalculatorId },
      resetScroll: false,
      state: markCalculatorHistoryState,
    };

    navigate({
      ...options,
      replace:
        calculatorId !== undefined ||
        shouldReplaceNavigation(currentLocation.href, buildLocation(options).href),
    });
  }

  function closeCalculator() {
    const restoreScroll = captureWindowScrollRestoration();

    if (canCloseCalculatorWithHistoryBack(currentLocation.state)) {
      history.go(-1);
    } else {
      navigate({
        search: { calculator: undefined },
        replace: true,
        resetScroll: false,
      });
    }

    restoreScroll();
  }

  return {
    activeCalculatorId: calculatorId,
    openCalculator,
    closeCalculator,
  };
}
