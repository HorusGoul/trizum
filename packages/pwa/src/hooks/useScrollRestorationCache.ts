import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import { useMemo } from "react";

interface ScrollRestorationCache {
  initialOffset: number;
  initialMeasurementsCache: VirtualItem[];
}

const cache = new Map<string, ScrollRestorationCache>();

function getOrCreateCache(key: string) {
  let instance = cache.get(key);

  if (!instance) {
    instance = {
      initialOffset: 0,
      initialMeasurementsCache: [],
    };
    cache.set(key, instance);
  }

  function onChange(virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>) {
    if (!instance) {
      return;
    }

    if (!virtualizer.isScrolling) {
      instance.initialMeasurementsCache = virtualizer.measurementsCache;
      instance.initialOffset = virtualizer.scrollOffset ?? 0;
    }
  }

  return {
    ...instance,
    onChange,
  };
}

export function useScrollRestorationCache(key: string) {
  return useMemo(() => getOrCreateCache(key), [key]);
}
