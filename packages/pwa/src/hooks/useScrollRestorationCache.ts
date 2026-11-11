import { useState } from "react";

interface ScrollRestorationCache {
  initialScrollTop: number;
  initialRowHeights: ReadonlyMap<string, number>;
  setRowHeights: (heights: Map<string, number>) => void;
  setScrollTop: (scrollTop: number) => void;
}

const cache = new Map<string, { scrollTop: number; rowHeights: Map<string, number> }>();

function getOrCreateCache(key: string): ScrollRestorationCache {
  let saved = cache.get(key);

  if (!saved) {
    saved = { scrollTop: 0, rowHeights: new Map() };
    cache.set(key, saved);
  }

  const state = saved;
  const initialScrollTop = state.scrollTop;
  const initialRowHeights = state.rowHeights;

  function setScrollTop(scrollTop: number) {
    state.scrollTop = scrollTop;
  }

  function setRowHeights(heights: Map<string, number>) {
    state.rowHeights = heights;
  }

  return {
    initialScrollTop,
    initialRowHeights,
    setScrollTop,
    setRowHeights,
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
