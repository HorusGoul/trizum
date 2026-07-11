import { t } from "@lingui/core/macro";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sheet } from "react-modal-sheet";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { useMediaFileObjectUrls } from "#src/hooks/useMediaFile.ts";
import { useMultipleSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import MediaGallery, { type MediaGalleryItem } from "#src/components/MediaGallery.tsx";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { cn } from "#src/ui/utils.ts";
import { suppressCalculatorAutoOpen } from "./calculatorAutoOpenSuppression.ts";
import type { CalculatorSelectionRange } from "#src/hooks/useCalculatorMode.ts";
import type { MediaFile } from "#src/models/media.ts";

const DRAG_THRESHOLD = 20; // Minimum pixels to trigger a cursor move
const TAP_THRESHOLD = 5; // Maximum movement to consider it a tap (not drag)
const DESKTOP_POPOVER_MARGIN = 8;
const DESKTOP_POPOVER_ESTIMATED_HEIGHT = 360;
const MOBILE_SHEET_TWEEN_CONFIG = { duration: 0.2, ease: "easeOut" } as const;
const MOBILE_FIELD_VISIBILITY_MARGIN = 12;
const MOBILE_SCROLL_ALLOWANCE_ANIMATION_MS = MOBILE_SHEET_TWEEN_CONFIG.duration * 1000;
const MOBILE_SCROLL_RESTORE_TIMEOUT_MS = 650;
const MOBILE_SCROLL_RESTORE_TOLERANCE = 2;
const MOBILE_ATTACHMENT_TOOLBAR_HEIGHT_STYLE = "calc(var(--safe-area-inset-top, 0px) + 4rem)";
const MOBILE_SCROLL_ALLOWANCE_PROPERTY = "--calculator-mobile-scroll-allowance";
const EMPTY_ATTACHMENT_PHOTO_IDS: MediaFile["id"][] = [];
const currencyPreviewFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyPreviewFormatter(currency: string) {
  const cachedFormatter = currencyPreviewFormatterCache.get(currency);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "code",
  });

  currencyPreviewFormatterCache.set(currency, formatter);
  return formatter;
}

function getExpressionCharacterKey(expression: string, index: number) {
  return expression.slice(0, index + 1);
}

interface CalculatorToolbarProps {
  expression: string;
  cursorPosition: number;
  selectionRange: CalculatorSelectionRange | null;
  onInsert: (text: string) => void;
  onBackspace: () => void;
  onMoveCursor: (direction: "left" | "right") => void;
  onSetCursorPosition: (position: number) => void;
  onCommit: () => void;
  onClear: () => void;
  onDismiss: () => void;
  attachmentPhotoIds?: MediaFile["id"][];
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  presenceElementId?: string;
  previewValue: number | null;
  currency?: string;
  dismissOnOutsideInteraction?: boolean;
  fieldLabel?: string;
  closeRequestId?: number;
}

type CalculatorCallbacks = Pick<
  CalculatorToolbarProps,
  | "onInsert"
  | "onBackspace"
  | "onMoveCursor"
  | "onSetCursorPosition"
  | "onCommit"
  | "onClear"
  | "onDismiss"
>;

type CalculatorLayout = {
  isLargeScreen: boolean;
  popoverPosition: {
    top: number;
    left: number;
    width: number;
  } | null;
};

type WindowScrollPosition = {
  left: number;
  top: number;
};

function blurActiveElement() {
  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement && activeElement !== document.body) {
    activeElement.blur();
  }
}

function blurCalculatorFocus() {
  blurActiveElement();
  window.requestAnimationFrame(blurActiveElement);
}

function removeMobileScrollAllowance() {
  document.documentElement.style.removeProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY);
}

function getCurrentWindowScrollPosition(): WindowScrollPosition | null {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    left: window.scrollX,
    top: window.scrollY,
  };
}

function getCalculatorLayout(
  fieldContainerRef: React.RefObject<HTMLDivElement | null>,
): CalculatorLayout {
  if (typeof window === "undefined") {
    return {
      isLargeScreen: false,
      popoverPosition: null,
    };
  }

  const isLargeScreen = window.matchMedia("(min-width: 768px)").matches;

  if (!isLargeScreen || !fieldContainerRef.current) {
    return {
      isLargeScreen,
      popoverPosition: null,
    };
  }

  const rect = fieldContainerRef.current.getBoundingClientRect();
  const width = Math.max(rect.width, 280);
  const maxTop = Math.max(
    DESKTOP_POPOVER_MARGIN,
    window.innerHeight - DESKTOP_POPOVER_ESTIMATED_HEIGHT - DESKTOP_POPOVER_MARGIN,
  );
  const maxLeft = Math.max(
    DESKTOP_POPOVER_MARGIN,
    window.innerWidth - width - DESKTOP_POPOVER_MARGIN,
  );

  return {
    isLargeScreen: true,
    popoverPosition: {
      top: Math.max(DESKTOP_POPOVER_MARGIN, Math.min(rect.bottom + DESKTOP_POPOVER_MARGIN, maxTop)),
      left: Math.max(DESKTOP_POPOVER_MARGIN, Math.min(rect.left, maxLeft)),
      width,
    },
  };
}

function areCalculatorLayoutsEqual(previous: CalculatorLayout, next: CalculatorLayout) {
  return (
    previous.isLargeScreen === next.isLargeScreen &&
    previous.popoverPosition?.top === next.popoverPosition?.top &&
    previous.popoverPosition?.left === next.popoverPosition?.left &&
    previous.popoverPosition?.width === next.popoverPosition?.width
  );
}

function useCalculatorCallbacks(callbacks: CalculatorCallbacks) {
  const callbacksRef = useRef(callbacks);

  useLayoutEffect(() => {
    callbacksRef.current = callbacks;
  });

  return callbacksRef;
}

function useCalculatorPopoverPosition(fieldContainerRef: React.RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<CalculatorLayout>(() =>
    getCalculatorLayout(fieldContainerRef),
  );

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    function updatePosition() {
      const nextLayout = getCalculatorLayout(fieldContainerRef);
      setLayout((currentLayout) =>
        areCalculatorLayoutsEqual(currentLayout, nextLayout) ? currentLayout : nextLayout,
      );
    }

    updatePosition();
    mediaQuery.addEventListener("change", updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      mediaQuery.removeEventListener("change", updatePosition);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [fieldContainerRef]);

  return layout;
}

function useExpressionCursorScroll({
  charRefs,
  cursorPosition,
  expression,
  expressionContentRef,
  expressionScrollRef,
  scrollOffsetRef,
}: {
  charRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  cursorPosition: number;
  expression: string;
  expressionContentRef: React.RefObject<HTMLSpanElement | null>;
  expressionScrollRef: React.RefObject<HTMLSpanElement | null>;
  scrollOffsetRef: React.RefObject<number>;
}) {
  useLayoutEffect(() => {
    const scrollContainer = expressionScrollRef.current;
    const contentEl = expressionContentRef.current;
    if (!scrollContainer || !contentEl || !expression) {
      scrollOffsetRef.current = 0;
      if (contentEl) {
        contentEl.style.transform = "translateX(0px)";
      }
      return;
    }

    let cursorX: number;
    if (cursorPosition === 0 && charRefs.current[0]) {
      cursorX = charRefs.current[0].offsetLeft;
    } else if (cursorPosition === expression.length && charRefs.current[cursorPosition - 1]) {
      const lastChar = charRefs.current[cursorPosition - 1]!;
      cursorX = lastChar.offsetLeft + lastChar.offsetWidth;
    } else if (charRefs.current[cursorPosition]) {
      cursorX = charRefs.current[cursorPosition].offsetLeft;
    } else {
      return;
    }

    const containerWidth = scrollContainer.clientWidth;
    const contentWidth = contentEl.scrollWidth;
    const padding = 20;
    const scrollOffset = scrollOffsetRef.current;

    if (contentWidth <= containerWidth) {
      scrollOffsetRef.current = 0;
      contentEl.style.transform = "translateX(0px)";
      return;
    }

    const visibleStart = scrollOffset;
    const visibleEnd = scrollOffset + containerWidth;
    let newOffset = scrollOffset;

    if (cursorX < visibleStart + padding) {
      newOffset = Math.max(0, cursorX - padding);
    } else if (cursorX > visibleEnd - padding) {
      newOffset = Math.min(contentWidth - containerWidth, cursorX - containerWidth + padding);
    }

    if (newOffset !== scrollOffset) {
      scrollOffsetRef.current = newOffset;
      contentEl.style.transform = `translateX(-${newOffset}px)`;
    }
  }, [
    charRefs,
    cursorPosition,
    expression,
    expressionContentRef,
    expressionScrollRef,
    scrollOffsetRef,
  ]);
}

function useExpressionPointerGestures({
  callbacksRef,
  charRefs,
  dragAccumulatorRef,
  expression,
  expressionRef,
  pointerStartRef,
}: {
  callbacksRef: React.RefObject<CalculatorCallbacks>;
  charRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  dragAccumulatorRef: React.RefObject<number>;
  expression: string;
  expressionRef: React.RefObject<HTMLDivElement | null>;
  pointerStartRef: React.RefObject<{ x: number; totalMovement: number } | null>;
}) {
  useEffect(() => {
    const expressionEl = expressionRef.current;
    if (!expressionEl) return;

    function handlePointerDown(e: PointerEvent) {
      pointerStartRef.current = { x: e.clientX, totalMovement: 0 };
      dragAccumulatorRef.current = 0;
      expressionEl!.setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e: PointerEvent) {
      if (!pointerStartRef.current) return;

      const deltaX = e.clientX - pointerStartRef.current.x;
      pointerStartRef.current.totalMovement += Math.abs(deltaX);
      const newAccumulator = dragAccumulatorRef.current + deltaX;

      if (Math.abs(newAccumulator) >= DRAG_THRESHOLD) {
        const direction = newAccumulator > 0 ? "right" : "left";
        callbacksRef.current.onMoveCursor(direction);
        dragAccumulatorRef.current = 0;
      } else {
        dragAccumulatorRef.current = newAccumulator;
      }
      pointerStartRef.current.x = e.clientX;
    }

    function handlePointerUp(e: PointerEvent) {
      if (pointerStartRef.current && pointerStartRef.current.totalMovement < TAP_THRESHOLD) {
        const clickX = e.clientX;
        let bestPosition = 0;
        let bestDistance = Infinity;

        for (let i = 0; i <= expression.length; i++) {
          let posX: number;

          if (i === 0 && charRefs.current[0]) {
            posX = charRefs.current[0].getBoundingClientRect().left;
          } else if (i === expression.length && charRefs.current[i - 1]) {
            posX = charRefs.current[i - 1]!.getBoundingClientRect().right;
          } else if (charRefs.current[i]) {
            posX = charRefs.current[i]!.getBoundingClientRect().left;
          } else {
            continue;
          }

          const distance = Math.abs(clickX - posX);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestPosition = i;
          }
        }

        callbacksRef.current.onSetCursorPosition(bestPosition);
      }

      pointerStartRef.current = null;
      dragAccumulatorRef.current = 0;
      if (expressionEl!.hasPointerCapture(e.pointerId)) {
        expressionEl!.releasePointerCapture(e.pointerId);
      }
    }

    function handlePointerCancel(e: PointerEvent) {
      pointerStartRef.current = null;
      dragAccumulatorRef.current = 0;
      if (expressionEl!.hasPointerCapture(e.pointerId)) {
        expressionEl!.releasePointerCapture(e.pointerId);
      }
    }

    expressionEl.addEventListener("pointerdown", handlePointerDown);
    expressionEl.addEventListener("pointermove", handlePointerMove);
    expressionEl.addEventListener("pointerup", handlePointerUp);
    expressionEl.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      expressionEl.removeEventListener("pointerdown", handlePointerDown);
      expressionEl.removeEventListener("pointermove", handlePointerMove);
      expressionEl.removeEventListener("pointerup", handlePointerUp);
      expressionEl.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [callbacksRef, charRefs, dragAccumulatorRef, expression, expressionRef, pointerStartRef]);
}

function useCalculatorDismiss({
  additionalInsideRef,
  callbacksRef,
  enabled,
  fieldContainerRef,
  toolbarRef,
}: {
  additionalInsideRef?: React.RefObject<HTMLElement | null>;
  callbacksRef: React.RefObject<CalculatorCallbacks>;
  enabled: boolean;
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
}) {
  const suppressNextDocumentClickRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function isOutside(target: Node | null) {
      if (!target) return false;

      const inToolbar = toolbarRef.current?.contains(target);
      const inField = fieldContainerRef.current?.contains(target);
      const inAdditionalElement = additionalInsideRef?.current?.contains(target);

      return !inToolbar && !inField && !inAdditionalElement;
    }

    function handlePointerDown(e: PointerEvent) {
      if (isOutside(e.target as Node | null)) {
        suppressNextDocumentClickRef.current = true;
        suppressCalculatorAutoOpen();
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        blurActiveElement();
        callbacksRef.current.onDismiss();
      }
    }

    function handleClick(e: MouseEvent) {
      if (!suppressNextDocumentClickRef.current) {
        return;
      }

      suppressNextDocumentClickRef.current = false;
      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();
    }

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [additionalInsideRef, callbacksRef, enabled, fieldContainerRef, toolbarRef]);
}

function useCalculatorKeyboard({
  callbacksRef,
  fieldContainerRef,
  toolbarRef,
}: {
  callbacksRef: React.RefObject<CalculatorCallbacks>;
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditableTarget =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const isCalculatorTarget =
        target &&
        (fieldContainerRef.current?.contains(target) || toolbarRef.current?.contains(target));

      if (isEditableTarget && !isCalculatorTarget) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        callbacksRef.current.onInsert(e.key);
        return;
      }

      switch (e.key) {
        case "+":
        case "-":
        case "*":
        case "/":
        case ".":
        case "(":
        case ")":
          e.preventDefault();
          callbacksRef.current.onInsert(e.key);
          break;
        case "Backspace":
          e.preventDefault();
          callbacksRef.current.onBackspace();
          break;
        case "Delete":
          e.preventDefault();
          callbacksRef.current.onClear();
          break;
        case "Enter":
        case "=":
          e.preventDefault();
          callbacksRef.current.onCommit();
          break;
        case "Escape":
          e.preventDefault();
          callbacksRef.current.onDismiss();
          break;
        case "ArrowLeft":
          e.preventDefault();
          callbacksRef.current.onMoveCursor("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          callbacksRef.current.onMoveCursor("right");
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [callbacksRef, fieldContainerRef, toolbarRef]);
}

function useMobileCalculatorScroll({
  fieldContainerRef,
  isLargeScreen,
  toolbarRef,
}: {
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  isLargeScreen: boolean;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [initialWindowScroll] = useState(() => getCurrentWindowScrollPosition());
  const initialWindowScrollRef = useRef<WindowScrollPosition | null>(initialWindowScroll);
  const scrollFieldAboveMobileSheetRef = useRef<
    (behavior: ScrollBehavior, attempts?: number) => void
  >(() => {});

  function setMobileScrollAllowance(height: number, options?: { animate?: boolean }) {
    if (typeof document === "undefined" || isLargeScreen) {
      return;
    }

    const allowanceHeight = Math.max(0, height);
    const root = document.documentElement;

    if (options?.animate && !root.style.getPropertyValue(MOBILE_SCROLL_ALLOWANCE_PROPERTY)) {
      root.style.setProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY, "0px");
    }

    if (options?.animate) {
      window.requestAnimationFrame(() => {
        root.style.setProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY, `${allowanceHeight}px`);
      });
    } else {
      root.style.setProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY, `${allowanceHeight}px`);
    }
  }

  function scrollFieldAboveMobileSheet(behavior: ScrollBehavior, attempts = 0) {
    if (typeof window === "undefined" || isLargeScreen) {
      return;
    }

    const fieldElement = fieldContainerRef.current;
    const sheetElement = toolbarRef.current;
    if (!fieldElement || !sheetElement) {
      if (attempts < 2) {
        window.requestAnimationFrame(() =>
          scrollFieldAboveMobileSheetRef.current(behavior, attempts + 1),
        );
      }
      return;
    }

    const sheetHeight = sheetElement.offsetHeight;
    if (sheetHeight <= 0) {
      if (attempts < 2) {
        window.requestAnimationFrame(() =>
          scrollFieldAboveMobileSheetRef.current(behavior, attempts + 1),
        );
      }
      return;
    }

    setMobileScrollAllowance(sheetHeight, { animate: attempts === 0 });

    const fieldRect = fieldElement.getBoundingClientRect();
    const sheetTop = window.innerHeight - sheetHeight;
    const targetFieldBottom = sheetTop - MOBILE_FIELD_VISIBILITY_MARGIN;

    if (fieldRect.bottom > targetFieldBottom) {
      window.scrollTo({
        left: window.scrollX,
        top: window.scrollY + fieldRect.bottom - targetFieldBottom,
        behavior,
      });
    }

    if (attempts < 4) {
      window.setTimeout(
        () => scrollFieldAboveMobileSheetRef.current(behavior, attempts + 1),
        MOBILE_SCROLL_ALLOWANCE_ANIMATION_MS / 4,
      );
    }
  }

  useLayoutEffect(() => {
    scrollFieldAboveMobileSheetRef.current = scrollFieldAboveMobileSheet;
  });

  function collapseMobileScrollAllowance() {
    if (isLargeScreen) {
      return;
    }

    document.documentElement.style.setProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY, "0px");
  }

  function restoreInitialWindowScroll(behavior: ScrollBehavior) {
    const scrollPosition = initialWindowScrollRef.current;
    if (typeof window === "undefined" || !scrollPosition || isLargeScreen) {
      return;
    }

    collapseMobileScrollAllowance();
    window.scrollTo({
      left: scrollPosition.left,
      top: scrollPosition.top,
      behavior,
    });
  }

  function waitForInitialWindowScroll() {
    const targetScrollPosition = initialWindowScrollRef.current;
    if (typeof window === "undefined" || !targetScrollPosition) {
      return Promise.resolve();
    }
    const { left, top } = targetScrollPosition;

    return new Promise<void>((resolve) => {
      const deadline = performance.now() + MOBILE_SCROLL_RESTORE_TIMEOUT_MS;

      function checkScrollPosition() {
        const isRestored =
          Math.abs(window.scrollX - left) <= MOBILE_SCROLL_RESTORE_TOLERANCE &&
          Math.abs(window.scrollY - top) <= MOBILE_SCROLL_RESTORE_TOLERANCE;

        if (isRestored || performance.now() >= deadline) {
          resolve();
          return;
        }

        window.requestAnimationFrame(checkScrollPosition);
      }

      checkScrollPosition();
    });
  }

  async function finishInitialWindowScrollRestore() {
    restoreInitialWindowScroll("smooth");
    await waitForInitialWindowScroll();
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && initialWindowScroll) {
        document.documentElement.style.setProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY, "0px");
        window.scrollTo({
          left: initialWindowScroll.left,
          top: initialWindowScroll.top,
          behavior: "smooth",
        });
        window.setTimeout(
          () => document.documentElement.style.removeProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY),
          MOBILE_SCROLL_RESTORE_TIMEOUT_MS,
        );
        return;
      }

      document.documentElement.style.removeProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY);
    };
  }, [initialWindowScroll]);

  useEffect(() => {
    if (!isLargeScreen) {
      return;
    }

    document.documentElement.style.removeProperty(MOBILE_SCROLL_ALLOWANCE_PROPERTY);
  }, [isLargeScreen]);

  return {
    finishInitialWindowScrollRestore,
    removeMobileScrollAllowance,
    restoreInitialWindowScroll,
    scrollFieldAboveMobileSheet,
  };
}

function useElementHeight(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const maybeElement = ref.current;
    if (!maybeElement) {
      return;
    }
    const element = maybeElement;

    function updateHeight() {
      setHeight(element.offsetHeight);
    }

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => window.removeEventListener("resize", updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, [enabled, ref]);

  return enabled ? height : 0;
}

function formatCalculatorPreviewValue(value: number, currency?: string): string {
  if (!currency) {
    return value.toString();
  }

  try {
    const formatter = getCurrencyPreviewFormatter(currency);
    const parts = formatter.formatToParts(1.23456789);
    const fractionPart = parts.find((part) => part.type === "fraction");
    const decimals = fractionPart?.value.length ?? 2;

    return value.toFixed(decimals);
  } catch {
    return value.toString();
  }
}

export function CalculatorToolbar({
  expression,
  cursorPosition,
  selectionRange,
  onInsert,
  onBackspace,
  onMoveCursor,
  onSetCursorPosition,
  onCommit,
  onClear,
  onDismiss,
  attachmentPhotoIds = EMPTY_ATTACHMENT_PHOTO_IDS,
  fieldContainerRef,
  presenceElementId,
  previewValue,
  currency,
  dismissOnOutsideInteraction = true,
  fieldLabel,
  closeRequestId = 0,
}: CalculatorToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const attachmentLayerRef = useRef<HTMLDivElement>(null);
  const expressionRef = useRef<HTMLDivElement>(null);
  const expressionScrollRef = useRef<HTMLSpanElement>(null);
  const expressionContentRef = useRef<HTMLSpanElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pointerStartRef = useRef<{ x: number; totalMovement: number } | null>(null);
  const dragAccumulatorRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const closeRequestIdRef = useRef<number | undefined>(undefined);
  const pendingMobileCloseActionRef = useRef<"commit" | "dismiss" | null>(null);
  const mobileCloseFallbackTimeoutRef = useRef<number | null>(null);
  const finishMobileCloseRef = useRef<() => Promise<void> | void>(() => {});
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(true);
  const callbacksRef = useCalculatorCallbacks({
    onInsert,
    onBackspace,
    onMoveCursor,
    onSetCursorPosition,
    onCommit,
    onClear,
    onDismiss,
  });
  const { isLargeScreen, popoverPosition } = useCalculatorPopoverPosition(fieldContainerRef);
  const mobileSheetHeight = useElementHeight(toolbarRef, !isLargeScreen);
  const {
    finishInitialWindowScrollRestore,
    removeMobileScrollAllowance,
    restoreInitialWindowScroll,
    scrollFieldAboveMobileSheet,
  } = useMobileCalculatorScroll({
    fieldContainerRef,
    isLargeScreen,
    toolbarRef,
  });

  function finishClose(action: "commit" | "dismiss") {
    if (action === "commit") {
      callbacksRef.current.onCommit();
      return;
    }

    callbacksRef.current.onDismiss();
  }

  function clearMobileCloseFallback() {
    if (mobileCloseFallbackTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(mobileCloseFallbackTimeoutRef.current);
    mobileCloseFallbackTimeoutRef.current = null;
  }

  function scheduleMobileCloseFallback() {
    clearMobileCloseFallback();
    mobileCloseFallbackTimeoutRef.current = window.setTimeout(() => {
      void finishMobileCloseRef.current();
    }, MOBILE_SCROLL_ALLOWANCE_ANIMATION_MS + 100);
  }

  function requestClose(action: "commit" | "dismiss") {
    if (action === "dismiss" && !isLargeScreen) {
      suppressCalculatorAutoOpen();
    }
    blurCalculatorFocus();

    if (!isLargeScreen) {
      if (!pendingMobileCloseActionRef.current) {
        pendingMobileCloseActionRef.current = action;
      }
      setIsMobileSheetOpen(false);
      scheduleMobileCloseFallback();
      return;
    }

    finishClose(action);
  }

  async function finishMobileClose() {
    const action = pendingMobileCloseActionRef.current;
    if (!action) {
      return;
    }

    clearMobileCloseFallback();
    pendingMobileCloseActionRef.current = null;
    await finishInitialWindowScrollRestore();
    removeMobileScrollAllowance();
    finishClose(action);
  }

  useLayoutEffect(() => {
    finishMobileCloseRef.current = finishMobileClose;
  });

  const interactionCallbacksRef = useCalculatorCallbacks({
    onInsert,
    onBackspace,
    onMoveCursor,
    onSetCursorPosition,
    onCommit: () => requestClose("commit"),
    onClear,
    onDismiss: () => requestClose("dismiss"),
  });

  useExpressionCursorScroll({
    charRefs,
    cursorPosition,
    expression,
    expressionContentRef,
    expressionScrollRef,
    scrollOffsetRef,
  });
  useExpressionPointerGestures({
    callbacksRef: interactionCallbacksRef,
    charRefs,
    dragAccumulatorRef,
    expression,
    expressionRef,
    pointerStartRef,
  });
  useCalculatorDismiss({
    additionalInsideRef: attachmentLayerRef,
    callbacksRef: interactionCallbacksRef,
    enabled: dismissOnOutsideInteraction,
    fieldContainerRef,
    toolbarRef,
  });
  useCalculatorKeyboard({ callbacksRef: interactionCallbacksRef, fieldContainerRef, toolbarRef });

  useEffect(() => clearMobileCloseFallback, []);

  /* eslint-disable react-doctor/no-event-handler, react-doctor/no-pass-live-state-to-parent -- Route/back closes arrive as state after render, and the sheet needs to animate before the field route is finalized. */
  useEffect(() => {
    const previousCloseRequestId = closeRequestIdRef.current;
    closeRequestIdRef.current = closeRequestId;

    if (closeRequestId !== previousCloseRequestId && previousCloseRequestId !== undefined) {
      requestClose("dismiss");
    }
  });
  /* eslint-enable react-doctor/no-event-handler, react-doctor/no-pass-live-state-to-parent */

  if (isLargeScreen && !popoverPosition) {
    return null;
  }

  const calculatorContent = (
    <CalculatorContent
      charRefs={charRefs}
      currency={currency}
      cursorPosition={cursorPosition}
      expression={expression}
      expressionContentRef={expressionContentRef}
      expressionRef={expressionRef}
      expressionScrollRef={expressionScrollRef}
      fieldLabel={fieldLabel}
      isLargeScreen={isLargeScreen}
      onBackspace={onBackspace}
      onClear={onClear}
      onCommit={() => requestClose("commit")}
      onInsert={onInsert}
      previewValue={previewValue}
      selectionRange={selectionRange}
    />
  );

  if (!isLargeScreen) {
    return (
      <Sheet
        detent="content"
        disableScrollLocking
        isOpen={isMobileSheetOpen}
        onClose={() => requestClose("dismiss")}
        onCloseStart={() => restoreInitialWindowScroll("smooth")}
        onCloseEnd={() => {
          void finishMobileClose();
        }}
        onOpenStart={() => scrollFieldAboveMobileSheet("smooth")}
        style={{ zIndex: 50 }}
        tweenConfig={MOBILE_SHEET_TWEEN_CONFIG}
        unstyled
      >
        <CalculatorMobileAttachmentLayer
          layerRef={attachmentLayerRef}
          photoIds={attachmentPhotoIds}
          sheetHeight={mobileSheetHeight}
        />
        <Sheet.Container
          ref={toolbarRef}
          role="application"
          aria-label={t`Calculator`}
          data-presence-proxy-element-id={presenceElementId}
          className="border-accent-200/80 to-accent-50/95 pb-safe dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900 w-full max-w-xl overflow-hidden rounded-t-[1.75rem] border bg-gradient-to-b from-white via-white shadow-[0_-10px_40px_rgba(15,23,42,0.24)] dark:shadow-none"
        >
          {calculatorContent}
        </Sheet.Container>
      </Sheet>
    );
  }

  const desktopPopoverPosition = popoverPosition;
  if (!desktopPopoverPosition) {
    return null;
  }

  return createPortal(
    <div
      ref={toolbarRef}
      role="application"
      aria-label={t`Calculator`}
      data-presence-proxy-element-id={presenceElementId}
      className="border-accent-300 dark:border-accent-700 dark:bg-accent-900 fixed z-50 overflow-y-auto rounded-lg border bg-white shadow-lg"
      style={{
        top: desktopPopoverPosition.top,
        left: desktopPopoverPosition.left,
        width: desktopPopoverPosition.width,
        maxHeight: `calc(100vh - ${DESKTOP_POPOVER_MARGIN * 2}px)`,
      }}
    >
      {calculatorContent}
    </div>,
    document.body,
  );
}

function CalculatorMobileAttachmentLayer({
  layerRef,
  photoIds,
  sheetHeight,
}: {
  layerRef: React.RefObject<HTMLDivElement | null>;
  photoIds: MediaFile["id"][];
  sheetHeight: number;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { yProgress } = Sheet.useContext();

  if (photoIds.length === 0) {
    return null;
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        ref={layerRef}
        data-calculator-attachment-layer
        className="pointer-events-none fixed inset-0 z-[1] md:hidden"
        style={{ opacity: yProgress }}
      >
        <Suspense fallback={null}>
          <CalculatorMobileAttachmentContent
            photoIds={photoIds}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            sheetHeight={sheetHeight}
          />
        </Suspense>
      </m.div>
    </LazyMotion>
  );
}

function CalculatorMobileAttachmentContent({
  photoIds,
  selectedIndex,
  setSelectedIndex,
  sheetHeight,
}: {
  photoIds: MediaFile["id"][];
  selectedIndex: number | null;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number | null>>;
  sheetHeight: number;
}) {
  const mediaFiles = useMultipleSuspenseDocument<MediaFile>(photoIds, {
    required: true as const,
  }).map(({ doc }) => doc);
  const urls = useMediaFileObjectUrls(mediaFiles);
  const galleryItems: MediaGalleryItem[] = urls.map((url) => ({ src: url }));
  const activeIndex =
    selectedIndex !== null && selectedIndex < galleryItems.length ? selectedIndex : null;

  return (
    <>
      <m.div
        data-calculator-attachment-toolbar=""
        className="pt-safe border-accent-200/80 dark:border-accent-800 dark:bg-accent-950 pointer-events-auto absolute inset-x-0 top-0 z-10 bg-white shadow-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ height: MOBILE_ATTACHMENT_TOOLBAR_HEIGHT_STYLE }}
        transition={MOBILE_SHEET_TWEEN_CONFIG}
      >
        <div
          role="toolbar"
          aria-label={t`Attachments`}
          className="border-accent-200/80 px-safe-or-4 dark:border-accent-800 flex h-16 items-center gap-2 border-b"
        >
          <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-2">
            {photoIds.map((photoId, index) => (
              <CalculatorMobileAttachmentButton
                key={photoId}
                index={index}
                isActive={activeIndex === index}
                onSelect={setSelectedIndex}
                url={urls[index]}
              />
            ))}
          </div>

          {activeIndex !== null ? (
            <IconButton
              icon="lucide.x"
              aria-label={t`Close attachment preview`}
              className="h-10 w-10 shrink-0"
              iconClassName="size-5"
              onPress={() => setSelectedIndex(null)}
            />
          ) : null}
        </div>
      </m.div>

      <AnimatePresence>
        {activeIndex !== null ? (
          <m.section
            aria-label={t`Attachment preview`}
            className="bg-accent-950/85 pointer-events-auto absolute inset-x-0 z-0 overflow-hidden backdrop-blur-sm"
            style={{
              top: MOBILE_ATTACHMENT_TOOLBAR_HEIGHT_STYLE,
              bottom: 0,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={MOBILE_SHEET_TWEEN_CONFIG}
          >
            <div
              className="absolute inset-x-0 top-0 overflow-hidden"
              style={{ bottom: Math.max(0, sheetHeight) }}
            >
              <MediaGallery
                index={activeIndex}
                items={galleryItems}
                onChange={setSelectedIndex}
                onClose={() => setSelectedIndex(null)}
                showCloseButton={false}
              />
            </div>
          </m.section>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function CalculatorMobileAttachmentButton({
  index,
  isActive,
  onSelect,
  url,
}: {
  index: number;
  isActive: boolean;
  onSelect: React.Dispatch<React.SetStateAction<number | null>>;
  url: string;
}) {
  const attachmentNumber = index + 1;

  return (
    <Button
      color="transparent"
      aria-label={
        attachmentNumber === 1
          ? t({ id: "View attachment 1", message: "View attachment 1" })
          : attachmentNumber === 2
            ? t({ id: "View attachment 2", message: "View attachment 2" })
            : attachmentNumber === 3
              ? t({ id: "View attachment 3", message: "View attachment 3" })
              : t({ id: "View attachment", message: "View attachment" })
      }
      onPress={() => onSelect(index)}
      className={cn(
        "border-accent-200 bg-accent-50 dark:bg-accent-900 h-12 w-12 shrink-0 overflow-hidden rounded-lg border p-0 dark:border-accent-700",
        isActive && "ring-accent-500 dark:ring-accent-400 ring-2 ring-inset",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute overflow-hidden",
          isActive ? "inset-[3px] rounded-[0.35rem]" : "inset-px rounded-[0.45rem]",
        )}
      >
        <img src={url} alt="" className="block h-full w-full object-cover" />
      </span>
    </Button>
  );
}

function CalculatorContent({
  charRefs,
  currency,
  cursorPosition,
  expression,
  expressionContentRef,
  expressionRef,
  expressionScrollRef,
  fieldLabel,
  isLargeScreen,
  onBackspace,
  onClear,
  onCommit,
  onInsert,
  previewValue,
  selectionRange,
}: Pick<
  CalculatorToolbarProps,
  | "currency"
  | "cursorPosition"
  | "expression"
  | "fieldLabel"
  | "onBackspace"
  | "onClear"
  | "onCommit"
  | "onInsert"
  | "previewValue"
  | "selectionRange"
> & {
  charRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  expressionContentRef: React.RefObject<HTMLSpanElement | null>;
  expressionRef: React.RefObject<HTMLDivElement | null>;
  expressionScrollRef: React.RefObject<HTMLSpanElement | null>;
  isLargeScreen: boolean;
}) {
  const header = (
    <>
      {!isLargeScreen ? (
        <div className="flex justify-center">
          <span
            aria-hidden="true"
            className="bg-accent-200 dark:bg-accent-700 h-1.5 w-12 rounded-full"
          />
        </div>
      ) : null}

      <div className="flex min-h-8 items-center gap-2 px-1">
        {fieldLabel ? (
          <span
            className="text-accent-700 dark:text-accent-200 min-w-0 flex-1 truncate text-sm font-medium"
            title={fieldLabel}
          >
            {fieldLabel}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <CalculatorPreview
          currency={currency}
          expression={expression}
          previewValue={previewValue}
        />
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2">
      {isLargeScreen ? (
        <div>{header}</div>
      ) : (
        <Sheet.Header
          data-calculator-sheet-drag-handle=""
          className="cursor-grab touch-none active:cursor-grabbing"
        >
          <div className="flex flex-col gap-3 pt-1 pb-1">{header}</div>
        </Sheet.Header>
      )}
      <CalculatorExpressionDisplay
        charRefs={charRefs}
        cursorPosition={cursorPosition}
        expression={expression}
        expressionContentRef={expressionContentRef}
        expressionRef={expressionRef}
        expressionScrollRef={expressionScrollRef}
        selectionRange={selectionRange}
      />
      {isLargeScreen ? (
        <CalculatorKeypad
          onBackspace={onBackspace}
          onClear={onClear}
          onCommit={onCommit}
          onInsert={onInsert}
        />
      ) : (
        <Sheet.Content disableDrag disableScroll>
          <CalculatorKeypad
            onBackspace={onBackspace}
            onClear={onClear}
            onCommit={onCommit}
            onInsert={onInsert}
          />
        </Sheet.Content>
      )}
    </div>
  );
}

function CalculatorPreview({
  currency,
  expression,
  previewValue,
}: {
  currency?: string;
  expression: string;
  previewValue: number | null;
}) {
  return (
    <div className="flex h-8 min-w-0 shrink-0 items-center justify-end">
      {previewValue !== null && expression ? (
        <span className="text-accent-600 dark:text-accent-400 text-sm font-medium">
          = {formatCalculatorPreviewValue(previewValue, currency)}
        </span>
      ) : null}
    </div>
  );
}

function CalculatorExpressionDisplay({
  charRefs,
  cursorPosition,
  expression,
  expressionContentRef,
  expressionRef,
  expressionScrollRef,
  selectionRange,
}: {
  charRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  cursorPosition: number;
  expression: string;
  expressionContentRef: React.RefObject<HTMLSpanElement | null>;
  expressionRef: React.RefObject<HTMLDivElement | null>;
  expressionScrollRef: React.RefObject<HTMLSpanElement | null>;
  selectionRange: CalculatorSelectionRange | null;
}) {
  const setCharRef = (index: number) => (el: HTMLSpanElement | null) => {
    charRefs.current[index] = el;
  };
  const activeSelectionRange =
    selectionRange && selectionRange.start !== selectionRange.end
      ? {
          start: Math.max(0, Math.min(selectionRange.start, selectionRange.end, expression.length)),
          end: Math.max(
            0,
            Math.min(Math.max(selectionRange.start, selectionRange.end), expression.length),
          ),
        }
      : null;

  return (
    <div
      ref={expressionRef}
      className="border-accent-400 bg-accent-50 dark:border-accent-600 dark:bg-accent-800 flex cursor-text touch-none items-center overflow-hidden rounded-md border px-3 py-2 select-none"
    >
      <span
        ref={expressionScrollRef}
        className="min-w-0 flex-1 text-right font-mono text-xl font-medium whitespace-nowrap"
        aria-live="polite"
        aria-label={t`Calculator expression`}
      >
        {!expression ? (
          <span className="animate-blink">|</span>
        ) : (
          <span ref={expressionContentRef} className="relative inline-flex">
            {expression.split("").map((char, index) => (
              <span
                key={getExpressionCharacterKey(expression, index)}
                ref={setCharRef(index)}
                className={cn(
                  "relative",
                  activeSelectionRange &&
                    index >= activeSelectionRange.start &&
                    index < activeSelectionRange.end &&
                    "bg-accent-300 text-accent-950 dark:bg-accent-700 dark:text-accent-50",
                )}
              >
                {!activeSelectionRange && index === cursorPosition ? (
                  <span className="animate-blink absolute top-0 left-0 h-full w-0">
                    <span className="absolute -translate-x-1/2">|</span>
                  </span>
                ) : null}
                {char}
              </span>
            ))}
            {!activeSelectionRange && cursorPosition === expression.length ? (
              <span className="animate-blink absolute top-0 right-0 h-full w-0">
                <span className="absolute -translate-x-1/2">|</span>
              </span>
            ) : null}
          </span>
        )}
      </span>
    </div>
  );
}

function CalculatorKeypad({
  onBackspace,
  onClear,
  onCommit,
  onInsert,
}: Pick<CalculatorToolbarProps, "onBackspace" | "onClear" | "onCommit" | "onInsert">) {
  const utilityButtonClassName = "h-12 touch-manipulation rounded-xl text-lg font-medium";
  const digitButtonClassName = "h-12 touch-manipulation rounded-xl text-xl font-medium";

  return (
    <div className="grid grid-cols-4 gap-1.5">
      <Button
        color="input-like"
        aria-label={t`Clear all`}
        onPress={onClear}
        className={utilityButtonClassName}
      >
        AC
      </Button>
      <Button
        color="input-like"
        aria-label={t`Open parenthesis`}
        onPress={() => onInsert("(")}
        className={utilityButtonClassName}
      >
        (
      </Button>
      <Button
        color="input-like"
        aria-label={t`Close parenthesis`}
        onPress={() => onInsert(")")}
        className={utilityButtonClassName}
      >
        )
      </Button>
      <Button
        color="accent"
        aria-label={t`Divide`}
        onPress={() => onInsert("/")}
        className={utilityButtonClassName}
      >
        ÷
      </Button>

      {["7", "8", "9"].map((digit) => (
        <Button
          key={digit}
          color="input-like"
          aria-label={digit}
          onPress={() => onInsert(digit)}
          className={digitButtonClassName}
        >
          {digit}
        </Button>
      ))}
      <Button
        color="accent"
        aria-label={t`Multiply`}
        onPress={() => onInsert("*")}
        className={utilityButtonClassName}
      >
        ×
      </Button>

      {["4", "5", "6"].map((digit) => (
        <Button
          key={digit}
          color="input-like"
          aria-label={digit}
          onPress={() => onInsert(digit)}
          className={digitButtonClassName}
        >
          {digit}
        </Button>
      ))}
      <Button
        color="accent"
        aria-label={t`Subtract`}
        onPress={() => onInsert("-")}
        className={utilityButtonClassName}
      >
        −
      </Button>

      {["1", "2", "3"].map((digit) => (
        <Button
          key={digit}
          color="input-like"
          aria-label={digit}
          onPress={() => onInsert(digit)}
          className={digitButtonClassName}
        >
          {digit}
        </Button>
      ))}
      <Button
        color="accent"
        aria-label={t`Add`}
        onPress={() => onInsert("+")}
        className={utilityButtonClassName}
      >
        +
      </Button>

      <Button
        color="input-like"
        aria-label="0"
        onPress={() => onInsert("0")}
        className={digitButtonClassName}
      >
        0
      </Button>
      <Button
        color="input-like"
        aria-label={t`Decimal point`}
        onPress={() => onInsert(".")}
        className={digitButtonClassName}
      >
        .
      </Button>
      <Button
        color="input-like"
        aria-label={t`Backspace`}
        onPress={onBackspace}
        className={utilityButtonClassName}
      >
        <Icon icon="lucide.delete" className="size-5" />
      </Button>
      <Button
        color="accent"
        aria-label={t`Calculate result`}
        onPress={onCommit}
        className={utilityButtonClassName}
      >
        =
      </Button>
    </div>
  );
}
