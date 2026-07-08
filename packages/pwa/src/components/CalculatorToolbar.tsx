import { t } from "@lingui/core/macro";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { cn } from "#src/ui/utils.ts";
import type { CalculatorSelectionRange } from "#src/hooks/useCalculatorMode.ts";

const DRAG_THRESHOLD = 20; // Minimum pixels to trigger a cursor move
const TAP_THRESHOLD = 5; // Maximum movement to consider it a tap (not drag)
const DESKTOP_POPOVER_MARGIN = 8;
const DESKTOP_POPOVER_ESTIMATED_HEIGHT = 360;
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
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  presenceElementId?: string;
  previewValue: number | null;
  currency?: string;
  dismissOnOutsideInteraction?: boolean;
  fieldLabel?: string;
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
  callbacksRef,
  enabled,
  fieldContainerRef,
  toolbarRef,
}: {
  callbacksRef: React.RefObject<CalculatorCallbacks>;
  enabled: boolean;
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function isOutside(target: Node | null) {
      if (!target) return false;

      const inToolbar = toolbarRef.current?.contains(target);
      const inField = fieldContainerRef.current?.contains(target);

      return !inToolbar && !inField;
    }

    function handleFocusIn(e: FocusEvent) {
      if (isOutside(e.target as Node | null)) {
        callbacksRef.current.onDismiss();
      }
    }

    function handlePointerUp(e: PointerEvent) {
      if (isOutside(e.target as Node | null)) {
        callbacksRef.current.onDismiss();
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [callbacksRef, enabled, fieldContainerRef, toolbarRef]);
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
  fieldContainerRef,
  presenceElementId,
  previewValue,
  currency,
  dismissOnOutsideInteraction = true,
  fieldLabel,
}: CalculatorToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const expressionRef = useRef<HTMLDivElement>(null);
  const expressionScrollRef = useRef<HTMLSpanElement>(null);
  const expressionContentRef = useRef<HTMLSpanElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pointerStartRef = useRef<{ x: number; totalMovement: number } | null>(null);
  const dragAccumulatorRef = useRef(0);
  const scrollOffsetRef = useRef(0);
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

  useExpressionCursorScroll({
    charRefs,
    cursorPosition,
    expression,
    expressionContentRef,
    expressionScrollRef,
    scrollOffsetRef,
  });
  useExpressionPointerGestures({
    callbacksRef,
    charRefs,
    dragAccumulatorRef,
    expression,
    expressionRef,
    pointerStartRef,
  });
  useCalculatorDismiss({
    callbacksRef,
    enabled: dismissOnOutsideInteraction,
    fieldContainerRef,
    toolbarRef,
  });
  useCalculatorKeyboard({ callbacksRef, fieldContainerRef, toolbarRef });

  if (isLargeScreen && !popoverPosition) {
    return null;
  }

  return createPortal(
    <div
      ref={toolbarRef}
      role="application"
      aria-label={t`Calculator`}
      data-presence-proxy-element-id={presenceElementId}
      className={
        isLargeScreen && popoverPosition
          ? "border-accent-300 dark:border-accent-700 dark:bg-accent-900 fixed z-50 overflow-y-auto rounded-lg border bg-white shadow-lg"
          : "border-accent-300 pb-safe dark:border-accent-700 dark:bg-accent-900 fixed right-0 left-0 z-50 border-t bg-white"
      }
      style={
        isLargeScreen && popoverPosition
          ? {
              top: popoverPosition.top,
              left: popoverPosition.left,
              width: popoverPosition.width,
              maxHeight: `calc(100vh - ${DESKTOP_POPOVER_MARGIN * 2}px)`,
            }
          : { bottom: 0 }
      }
    >
      <div className="flex flex-col gap-1.5 px-2 py-2">
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
        <CalculatorExpressionDisplay
          charRefs={charRefs}
          cursorPosition={cursorPosition}
          expression={expression}
          expressionContentRef={expressionContentRef}
          expressionRef={expressionRef}
          expressionScrollRef={expressionScrollRef}
          selectionRange={selectionRange}
        />
        <CalculatorKeypad
          onBackspace={onBackspace}
          onClear={onClear}
          onCommit={onCommit}
          onInsert={onInsert}
        />
      </div>
    </div>,
    document.body,
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
