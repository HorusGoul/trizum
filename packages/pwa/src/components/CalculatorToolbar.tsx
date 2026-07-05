import { t } from "@lingui/core/macro";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";

const DRAG_THRESHOLD = 20; // Minimum pixels to trigger a cursor move
const TAP_THRESHOLD = 5; // Maximum movement to consider it a tap (not drag)
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

function useCalculatorCallbacks(callbacks: CalculatorCallbacks) {
  const callbacksRef = useRef(callbacks);

  useLayoutEffect(() => {
    callbacksRef.current = callbacks;
  });

  return callbacksRef;
}

function useCalculatorPopoverPosition(fieldContainerRef: React.RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<CalculatorLayout>({
    isLargeScreen: false,
    popoverPosition: null,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    function updatePosition() {
      if (mediaQuery.matches && fieldContainerRef.current) {
        const rect = fieldContainerRef.current.getBoundingClientRect();
        setLayout((currentLayout) => {
          const currentPosition = currentLayout.popoverPosition;
          const popoverPosition = {
            top: rect.bottom + 8,
            left: rect.left,
            width: Math.max(rect.width, 280),
          };

          if (
            currentLayout.isLargeScreen &&
            currentPosition &&
            currentPosition.top === popoverPosition.top &&
            currentPosition.left === popoverPosition.left &&
            currentPosition.width === popoverPosition.width
          ) {
            return currentLayout;
          }

          return {
            isLargeScreen: true,
            popoverPosition,
          };
        });
      } else {
        setLayout((currentLayout) => {
          if (
            currentLayout.isLargeScreen === mediaQuery.matches &&
            currentLayout.popoverPosition === null
          ) {
            return currentLayout;
          }

          return {
            isLargeScreen: mediaQuery.matches,
            popoverPosition: null,
          };
        });
      }
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
  fieldContainerRef,
  toolbarRef,
}: {
  callbacksRef: React.RefObject<CalculatorCallbacks>;
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
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
  }, [callbacksRef, fieldContainerRef, toolbarRef]);
}

function useCalculatorKeyboard(callbacksRef: React.RefObject<CalculatorCallbacks>) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [callbacksRef]);
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
  useCalculatorDismiss({ callbacksRef, fieldContainerRef, toolbarRef });
  useCalculatorKeyboard(callbacksRef);

  return createPortal(
    <div
      ref={toolbarRef}
      role="application"
      aria-label={t`Calculator`}
      data-presence-element-id={presenceElementId}
      className={
        isLargeScreen && popoverPosition
          ? "border-accent-300 dark:border-accent-700 dark:bg-accent-900 fixed z-50 rounded-lg border bg-white shadow-lg"
          : "border-accent-300 pb-safe dark:border-accent-700 dark:bg-accent-900 fixed right-0 left-0 z-50 border-t bg-white"
      }
      style={
        isLargeScreen && popoverPosition
          ? {
              top: popoverPosition.top,
              left: popoverPosition.left,
              width: popoverPosition.width,
            }
          : { bottom: 0 }
      }
      onPointerDown={(e) => {
        // Prevent any focus changes that could interfere with the calculator
        e.preventDefault();
      }}
    >
      <div className="flex flex-col gap-1.5 px-2 py-2">
        <CalculatorPreview
          currency={currency}
          expression={expression}
          previewValue={previewValue}
        />
        <CalculatorExpressionDisplay
          charRefs={charRefs}
          cursorPosition={cursorPosition}
          expression={expression}
          expressionContentRef={expressionContentRef}
          expressionRef={expressionRef}
          expressionScrollRef={expressionScrollRef}
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
    <div className="flex h-5 items-center justify-end px-1">
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
}: {
  charRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  cursorPosition: number;
  expression: string;
  expressionContentRef: React.RefObject<HTMLSpanElement | null>;
  expressionRef: React.RefObject<HTMLDivElement | null>;
  expressionScrollRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const setCharRef = (index: number) => (el: HTMLSpanElement | null) => {
    charRefs.current[index] = el;
  };

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
                className="relative"
              >
                {index === cursorPosition ? (
                  <span className="animate-blink absolute top-0 left-0 h-full w-0">
                    <span className="absolute -translate-x-1/2">|</span>
                  </span>
                ) : null}
                {char}
              </span>
            ))}
            {cursorPosition === expression.length ? (
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
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <Button
        color="input-like"
        aria-label={t`Clear all`}
        onPress={onClear}
        className="h-12 rounded-xl text-lg font-medium"
      >
        AC
      </Button>
      <Button
        color="input-like"
        aria-label={t`Open parenthesis`}
        onPress={() => onInsert("(")}
        className="h-12 rounded-xl text-lg font-medium"
      >
        (
      </Button>
      <Button
        color="input-like"
        aria-label={t`Close parenthesis`}
        onPress={() => onInsert(")")}
        className="h-12 rounded-xl text-lg font-medium"
      >
        )
      </Button>
      <Button
        color="accent"
        aria-label={t`Divide`}
        onPress={() => onInsert("/")}
        className="h-12 rounded-xl text-lg font-medium"
      >
        ÷
      </Button>

      {["7", "8", "9"].map((digit) => (
        <Button
          key={digit}
          color="input-like"
          aria-label={digit}
          onPress={() => onInsert(digit)}
          className="h-12 rounded-xl text-xl font-medium"
        >
          {digit}
        </Button>
      ))}
      <Button
        color="accent"
        aria-label={t`Multiply`}
        onPress={() => onInsert("*")}
        className="h-12 rounded-xl text-lg font-medium"
      >
        ×
      </Button>

      {["4", "5", "6"].map((digit) => (
        <Button
          key={digit}
          color="input-like"
          aria-label={digit}
          onPress={() => onInsert(digit)}
          className="h-12 rounded-xl text-xl font-medium"
        >
          {digit}
        </Button>
      ))}
      <Button
        color="accent"
        aria-label={t`Subtract`}
        onPress={() => onInsert("-")}
        className="h-12 rounded-xl text-lg font-medium"
      >
        −
      </Button>

      {["1", "2", "3"].map((digit) => (
        <Button
          key={digit}
          color="input-like"
          aria-label={digit}
          onPress={() => onInsert(digit)}
          className="h-12 rounded-xl text-xl font-medium"
        >
          {digit}
        </Button>
      ))}
      <Button
        color="accent"
        aria-label={t`Add`}
        onPress={() => onInsert("+")}
        className="h-12 rounded-xl text-lg font-medium"
      >
        +
      </Button>

      <Button
        color="input-like"
        aria-label="0"
        onPress={() => onInsert("0")}
        className="h-12 rounded-xl text-xl font-medium"
      >
        0
      </Button>
      <Button
        color="input-like"
        aria-label={t`Decimal point`}
        onPress={() => onInsert(".")}
        className="h-12 rounded-xl text-xl font-medium"
      >
        .
      </Button>
      <Button
        color="input-like"
        aria-label={t`Backspace`}
        onPress={onBackspace}
        className="h-12 rounded-xl text-lg font-medium"
      >
        <Icon icon="lucide.delete" className="size-5" />
      </Button>
      <Button
        color="accent"
        aria-label={t`Calculate result`}
        onPress={onCommit}
        className="h-12 rounded-xl text-lg font-medium"
      >
        =
      </Button>
    </div>
  );
}
