import { useEffect, useLayoutEffect, type RefObject } from "react";

const scrollCache = new Map<string, number>();

interface UseScrollRestorationOptions {
  cacheKey: string;
  scrollElementRef: RefObject<HTMLElement | null>;
}

export function useScrollRestoration({
  cacheKey,
  scrollElementRef,
}: UseScrollRestorationOptions) {
  useEffect(() => {
    const scrollElement = scrollElementRef.current;

    if (!scrollElement) {
      return;
    }

    const cachedScrollTop = scrollCache.get(cacheKey);

    if (cachedScrollTop === undefined) {
      return;
    }

    const rAF = window.requestAnimationFrame(() => {
      scrollElement.scrollTop = cachedScrollTop;
    });

    return () => {
      cancelAnimationFrame(rAF);
    };
  }, [cacheKey, scrollElementRef]);

  useLayoutEffect(() => {
    const scrollElement = scrollElementRef.current;

    if (!scrollElement) {
      return;
    }

    return () => {
      scrollCache.set(cacheKey, scrollElement.scrollTop);
    };
  }, [cacheKey, scrollElementRef]);
}
