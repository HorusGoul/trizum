export function getPresenceBubblePosition(element: HTMLElement, overlayElement: HTMLElement) {
  const elementRect = element.getBoundingClientRect();
  const overlayRect = overlayElement.getBoundingClientRect();
  const offsetTop = Number(element.dataset?.presenceOffsetTop ?? 0);
  const offsetLeft = Number(element.dataset?.presenceOffsetLeft ?? 0);

  return {
    top: elementRect.top - overlayRect.top + offsetTop,
    left: elementRect.right - overlayRect.left + offsetLeft,
  };
}

export function getPresenceElementIdFromTarget(target: HTMLElement | null): string | null {
  if (!target) {
    return null;
  }

  const presenceElementId =
    target.dataset?.presenceElementId ?? target.dataset?.presenceProxyElementId;

  if (presenceElementId) {
    return presenceElementId;
  }

  return getPresenceElementIdFromTarget(target.parentElement);
}
