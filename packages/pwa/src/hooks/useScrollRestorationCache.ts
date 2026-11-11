import { useState } from "react";

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
  const [entry, setEntry] = useState(() => ({ key, value: getOrCreateCache(key) }));

  if (entry.key !== key) {
    const next = { key, value: getOrCreateCache(key) };
    setEntry(next);

    return next.value;
  }

  return entry.value;
}
