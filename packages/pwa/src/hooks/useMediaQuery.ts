import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, fallbackValue = false) {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onStoreChange);

      return () => {
        mediaQuery.removeEventListener("change", onStoreChange);
      };
    },
    () => {
      if (typeof window === "undefined") {
        return fallbackValue;
      }

      return window.matchMedia(query).matches;
    },
    () => fallbackValue,
  );
}
