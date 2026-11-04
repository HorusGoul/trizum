export interface PresenceBubblePosition {
  top: number;
  left: number;
}

interface PresenceAnchor {
  dataset?: Partial<DOMStringMap>;
  getBoundingClientRect(): Pick<DOMRectReadOnly, "right" | "top">;
}

interface PresenceOverlay {
  getBoundingClientRect(): Pick<DOMRectReadOnly, "left" | "top">;
}

export interface PresenceTarget {
  dataset?: Partial<DOMStringMap>;
  parentElement: PresenceTarget | null;
}

export function getPresenceBubblePosition(
  element: PresenceAnchor,
  overlayElement: PresenceOverlay,
): PresenceBubblePosition {
  const elementRect = element.getBoundingClientRect();
  const overlayRect = overlayElement.getBoundingClientRect();
  const offsetTop = Number(element.dataset?.presenceOffsetTop ?? 0);
  const offsetLeft = Number(element.dataset?.presenceOffsetLeft ?? 0);

  return {
    top: elementRect.top - overlayRect.top + offsetTop,
    left: elementRect.right - overlayRect.left + offsetLeft,
  };
}

export function arePresenceBubblePositionsEqual(
  first: PresenceBubblePosition | null,
  second: PresenceBubblePosition | null,
) {
  if (first === second) {
    return true;
  }

  if (!first || !second) {
    return false;
  }

  return first.top === second.top && first.left === second.left;
}

export function getPresenceElementIdFromTarget(target: PresenceTarget | null): string | null {
  if (!target) {
    return null;
  }

  const dataset = target.dataset;
  const presenceElementId = dataset?.presenceElementId ?? dataset?.presenceProxyElementId;

  if (presenceElementId) {
    return presenceElementId;
  }

  return getPresenceElementIdFromTarget(target.parentElement);
}
