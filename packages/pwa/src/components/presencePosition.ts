export interface PresenceBubblePosition {
  top: number;
  left: number;
}

export function getPresenceBubblePosition(
  element: HTMLElement,
  overlayElement: HTMLElement,
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

export function getPresenceElementIdFromTarget(target: Element | null): string | null {
  if (!target) {
    return null;
  }

  const dataset = "dataset" in target ? (target.dataset as DOMStringMap) : undefined;
  const presenceElementId = dataset?.presenceElementId ?? dataset?.presenceProxyElementId;

  if (presenceElementId) {
    return presenceElementId;
  }

  return getPresenceElementIdFromTarget(target.parentElement);
}
