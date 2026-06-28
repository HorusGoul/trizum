import { useMemo } from "react";

interface ScrollRestorationCache {
  initialScrollTop: number;
  setScrollTop: (scrollTop: number) => void;
}

const cache = new Map<string, number>();

function getOrCreateCache(key: string): ScrollRestorationCache {
  const initialScrollTop = cache.get(key) ?? 0;

  function setScrollTop(scrollTop: number) {
    cache.set(key, scrollTop);
  }

  return {
    initialScrollTop,
    setScrollTop,
  };
}

export function useScrollRestorationCache(key: string) {
  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- FIXME: address existing React Doctor diagnostics.
  return useMemo(() => getOrCreateCache(key), [key]);
}
