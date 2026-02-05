import { t } from "@lingui/core/macro";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "#src/ui/Button.tsx";
import { IconWithFallback } from "#src/ui/Icon.tsx";

const DRAG_THRESHOLD = 20; // Minimum pixels to trigger a cursor move
const TAP_THRESHOLD = 5; // Maximum movement to consider it a tap (not drag)

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
  const pointerStartRef = useRef<{ x: number; totalMovement: number } | null>(
    null,
  );
  const [dragAccumulator, setDragAccumulator] = useState(0);
  const scrollOffsetRef = useRef(0);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Detect large screen and calculate popover position
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    function updatePosition() {
      setIsLargeScreen(mediaQuery.matches);

      if (mediaQuery.matches && fieldContainerRef.current) {
        const rect = fieldContainerRef.current.getBoundingClientRect();
        setPopoverPosition({
          top: rect.bottom + 8,
          left: rect.left,
          width: Math.max(rect.width, 280),
        });
      } else {
        setPopoverPosition(null);
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

  // Scroll cursor into view when cursor position changes
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

    // Get cursor position relative to content
    let cursorX: number;
    if (cursorPosition === 0 && charRefs.current[0]) {
      cursorX = charRefs.current[0].offsetLeft;
    } else if (
      cursorPosition === expression.length &&
      charRefs.current[cursorPosition - 1]
    ) {
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

    // No need to scroll if content fits
    if (contentWidth <= containerWidth) {
      scrollOffsetRef.current = 0;
      contentEl.style.transform = "translateX(0px)";
      return;
    }

    // Calculate visible range with current offset
    const visibleStart = scrollOffset;
    const visibleEnd = scrollOffset + containerWidth;

    // Scroll if cursor is outside visible area
    let newOffset = scrollOffset;
    if (cursorX < visibleStart + padding) {
      newOffset = Math.max(0, cursorX - padding);
    } else if (cursorX > visibleEnd - padding) {
      newOffset = Math.min(
        contentWidth - containerWidth,
        cursorX - containerWidth + padding,
      );
    }

    if (newOffset !== scrollOffset) {
      scrollOffsetRef.current = newOffset;
      contentEl.style.transform = `translateX(-${newOffset}px)`;
    }
  }, [cursorPosition, expression]);

  // Handle pointer gestures on expression display for cursor movement
  useEffect(() => {
    const expressionEl = expressionRef.current;
    if (!expressionEl) return;

    function handlePointerDown(e: PointerEvent) {
      pointerStartRef.current = { x: e.clientX, totalMovement: 0 };
      setDragAccumulator(0);
      expressionEl!.setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e: PointerEvent) {
      if (!pointerStartRef.current) return;

      const deltaX = e.clientX - pointerStartRef.current.x;
      pointerStartRef.current.totalMovement += Math.abs(deltaX);
      const newAccumulator = dragAccumulator + deltaX;

      // Check if we've accumulated enough movement to trigger a cursor move
      if (Math.abs(newAccumulator) >= DRAG_THRESHOLD) {
        const direction = newAccumulator > 0 ? "right" : "left";
        onMoveCursor(direction);
        setDragAccumulator(0);
      } else {
        setDragAccumulator(newAccumulator);
      }
      pointerStartRef.current.x = e.clientX;
    }

    function handlePointerUp(e: PointerEvent) {
      // Check if this was a tap (minimal movement)
      if (
        pointerStartRef.current &&
        pointerStartRef.current.totalMovement < TAP_THRESHOLD
      ) {
        // Find the closest character position based on click location
        const clickX = e.clientX;
        let bestPosition = 0;
        let bestDistance = Infinity;

        // Check position before each character and after the last one
        for (let i = 0; i <= expression.length; i++) {
          let posX: number;

          if (i === 0 && charRefs.current[0]) {
            // Position before first character
            posX = charRefs.current[0].getBoundingClientRect().left;
          } else if (i === expression.length && charRefs.current[i - 1]) {
            // Position after last character
            posX = charRefs.current[i - 1]!.getBoundingClientRect().right;
          } else if (charRefs.current[i]) {
            // Position before character i (which is left edge of char i)
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

        onSetCursorPosition(bestPosition);
      }

      pointerStartRef.current = null;
      setDragAccumulator(0);
      if (expressionEl!.hasPointerCapture(e.pointerId)) {
        expressionEl!.releasePointerCapture(e.pointerId);
      }
    }

    function handlePointerCancel(e: PointerEvent) {
      pointerStartRef.current = null;
      setDragAccumulator(0);
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
  }, [dragAccumulator, expression, onMoveCursor, onSetCursorPosition]);

  useEffect(() => {
    function isOutside(target: Node | null) {
      if (!target) return false;

      const inToolbar = toolbarRef.current?.contains(target);
      const inField = fieldContainerRef.current?.contains(target);

      return !inToolbar && !inField;
    }

    function handleFocusIn(e: FocusEvent) {
      if (isOutside(e.target as Node | null)) {
        onDismiss();
      }
    }

    function handlePointerUp(e: PointerEvent) {
      if (isOutside(e.target as Node | null)) {
        onDismiss();
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onDismiss, fieldContainerRef]);

  // Handle keyboard input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is typing in another input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Number keys
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        onInsert(e.key);
        return;
      }

      // Operators and symbols
      switch (e.key) {
        case "+":
        case "-":
        case "*":
        case "/":
        case ".":
        case "(":
        case ")":
          e.preventDefault();
          onInsert(e.key);
          break;
        case "Backspace":
          e.preventDefault();
          onBackspace();
          break;
        case "Delete":
          e.preventDefault();
          onClear();
          break;
        case "Enter":
        case "=":
          e.preventDefault();
          onCommit();
          break;
        case "Escape":
          e.preventDefault();
          onDismiss();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onMoveCursor("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          onMoveCursor("right");
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onInsert, onBackspace, onClear, onCommit, onDismiss, onMoveCursor]);

  // Callback ref setter for character spans
  const setCharRef = (index: number) => (el: HTMLSpanElement | null) => {
    charRefs.current[index] = el;
  };

  // Format preview value based on currency decimals
  function formatPreviewValue(value: number): string {
    if (!currency) {
      return value.toString();
    }

    try {
      const formatter = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "code",
      });

      // Get decimal precision from currency
      const parts = formatter.formatToParts(1.23456789);
      const fractionPart = parts.find((part) => part.type === "fraction");
      const decimals = fractionPart?.value.length ?? 2;

      return value.toFixed(decimals);
    } catch {
      return value.toString();
    }
  }

  return createPortal(
    <div
      ref={toolbarRef}
      role="application"
      aria-label={t`Calculator`}
      data-presence-element-id={presenceElementId}
      className={
        isLargeScreen && popoverPosition
          ? "fixed z-50 rounded-lg border border-accent-300 bg-white shadow-lg dark:border-accent-700 dark:bg-accent-900"
          : "fixed left-0 right-0 z-50 border-t border-accent-300 bg-white pb-safe dark:border-accent-700 dark:bg-accent-900"
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
        {/* Preview value on its own line to avoid layout shifts */}
        <div className="flex h-5 items-center justify-end px-1">
          {previewValue !== null && expression && (
            <span className="text-sm font-medium text-accent-600 dark:text-accent-400">
              = {formatPreviewValue(previewValue)}
            </span>
          )}
        </div>

        {/* Expression display with cursor - tap to position, drag to move cursor */}
        <div
          ref={expressionRef}
          className="flex cursor-text touch-none select-none items-center overflow-hidden rounded-md border border-accent-400 bg-accent-50 px-3 py-2 dark:border-accent-600 dark:bg-accent-800"
        >
          <span
            ref={expressionScrollRef}
            className="min-w-0 flex-1 whitespace-nowrap text-right font-mono text-xl font-medium"
            aria-live="polite"
            aria-label={t`Calculator expression`}
          >
            {!expression ? (
              <span className="animate-blink">|</span>
            ) : (
              <span
                ref={expressionContentRef}
                className="relative inline-flex"
              >
                {expression.split("").map((char, index) => (
                  <span
                    key={index}
                    ref={setCharRef(index)}
                    className="relative"
                  >
                    {index === cursorPosition && (
                      <span className="absolute left-0 top-0 h-full w-0 animate-blink">
                        <span className="absolute -translate-x-1/2">|</span>
                      </span>
                    )}
                    {char}
                  </span>
                ))}
                {cursorPosition === expression.length && (
                  <span className="absolute right-0 top-0 h-full w-0 animate-blink">
                    <span className="absolute -translate-x-1/2">|</span>
                  </span>
                )}
              </span>
            )}
          </span>
        </div>

        {/* iOS-style calculator buttons grid - 4 columns */}
        <div className="grid grid-cols-4 gap-1.5">
          {/* Row 1: AC ( ) ÷ */}
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

          {/* Row 2: 7 8 9 × */}
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

          {/* Row 3: 4 5 6 − */}
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

          {/* Row 4: 1 2 3 + */}
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

          {/* Row 5: 0 . ⌫ = */}
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
            <IconWithFallback name="#lucide/delete" className="size-5" />
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
      </div>
    </div>,
    document.body,
  );
}
