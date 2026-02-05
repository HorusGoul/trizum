import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
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
}: CalculatorToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const expressionRef = useRef<HTMLDivElement>(null);
  const expressionTextRef = useRef<HTMLSpanElement>(null);
  const pointerStartRef = useRef<{ x: number; totalMovement: number } | null>(
    null,
  );
  const [dragAccumulator, setDragAccumulator] = useState(0);

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
        // Reset accumulator but keep tracking from current position
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
        pointerStartRef.current.totalMovement < TAP_THRESHOLD &&
        expression.length > 0
      ) {
        // Calculate cursor position based on click location
        const textEl = expressionTextRef.current;
        if (textEl) {
          const rect = textEl.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const charWidth = rect.width / (expression.length + 1); // +1 for cursor
          const newPosition = Math.round(clickX / charWidth);
          onSetCursorPosition(
            Math.max(0, Math.min(newPosition, expression.length)),
          );
        }
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

  // Render expression with cursor indicator
  function renderExpressionWithCursor() {
    if (!expression) {
      return <span className="animate-blink">|</span>;
    }

    const before = expression.slice(0, cursorPosition);
    const after = expression.slice(cursorPosition);

    return (
      <>
        {before}
        <span className="animate-blink">|</span>
        {after}
      </>
    );
  }

  return createPortal(
    <div
      ref={toolbarRef}
      role="application"
      aria-label={t`Calculator`}
      data-presence-element-id={presenceElementId}
      className="fixed left-0 right-0 z-50 border-t border-accent-300 bg-white pb-safe dark:border-accent-700 dark:bg-accent-900"
      style={{ bottom: 0 }}
      onPointerDown={(e) => {
        // Prevent any focus changes that could interfere with the calculator
        e.preventDefault();
      }}
    >
      <div className="flex flex-col gap-1.5 px-2 py-2">
        {/* Expression display with cursor - tap to position, drag to move cursor */}
        <div
          ref={expressionRef}
          className="flex cursor-text touch-none select-none items-center gap-2 rounded-md border border-accent-400 bg-accent-50 px-3 py-2 dark:border-accent-600 dark:bg-accent-800"
        >
          <span
            ref={expressionTextRef}
            className="min-w-0 flex-1 text-right font-mono text-lg font-medium"
            aria-live="polite"
            aria-label={t`Calculator expression`}
          >
            {renderExpressionWithCursor()}
          </span>
          {previewValue !== null && expression && (
            <span className="flex-shrink-0 text-sm font-medium text-accent-600 dark:text-accent-400">
              = {previewValue}
            </span>
          )}
        </div>

        {/* Calculator buttons grid - 6 columns */}
        <div className="grid grid-cols-6 gap-1.5">
          {/* Row 1: ( ) 7 8 9 ÷ */}
          <Button
            color="input-like"
            aria-label={t`Open parenthesis`}
            onPress={() => onInsert("(")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            (
          </Button>
          <Button
            color="input-like"
            aria-label={t`Close parenthesis`}
            onPress={() => onInsert(")")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            )
          </Button>
          {["7", "8", "9"].map((digit) => (
            <Button
              key={digit}
              color="input-like"
              aria-label={digit}
              onPress={() => onInsert(digit)}
              className="h-11 rounded-lg text-lg font-medium"
            >
              {digit}
            </Button>
          ))}
          <Button
            color="input-like"
            aria-label={t`Divide`}
            onPress={() => onInsert("/")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            ÷
          </Button>

          {/* Row 2: ← → 4 5 6 × */}
          <Button
            color="input-like"
            aria-label={t`Move cursor left`}
            onPress={() => onMoveCursor("left")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            <IconWithFallback name="#lucide/chevron-left" className="size-5" />
          </Button>
          <Button
            color="input-like"
            aria-label={t`Move cursor right`}
            onPress={() => onMoveCursor("right")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            <IconWithFallback name="#lucide/chevron-right" className="size-5" />
          </Button>
          {["4", "5", "6"].map((digit) => (
            <Button
              key={digit}
              color="input-like"
              aria-label={digit}
              onPress={() => onInsert(digit)}
              className="h-11 rounded-lg text-lg font-medium"
            >
              {digit}
            </Button>
          ))}
          <Button
            color="input-like"
            aria-label={t`Multiply`}
            onPress={() => onInsert("*")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            ×
          </Button>

          {/* Row 3: C ⌫ 1 2 3 − */}
          <Button
            color="input-like"
            aria-label={t`Clear expression`}
            onPress={onClear}
            className="h-11 rounded-lg text-lg font-medium"
          >
            C
          </Button>
          <Button
            color="input-like"
            aria-label={t`Backspace`}
            onPress={onBackspace}
            className="h-11 rounded-lg text-lg font-medium"
          >
            <IconWithFallback name="#lucide/delete" className="size-5" />
          </Button>
          {["1", "2", "3"].map((digit) => (
            <Button
              key={digit}
              color="input-like"
              aria-label={digit}
              onPress={() => onInsert(digit)}
              className="h-11 rounded-lg text-lg font-medium"
            >
              {digit}
            </Button>
          ))}
          <Button
            color="input-like"
            aria-label={t`Subtract`}
            onPress={() => onInsert("-")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            −
          </Button>

          {/* Row 4: ✕ 0 . + = */}
          <Button
            color="input-like"
            aria-label={t`Close calculator`}
            onPress={onDismiss}
            className="h-11 rounded-lg text-lg font-medium"
          >
            <IconWithFallback name="#lucide/x" className="size-5" />
          </Button>
          <Button
            color="input-like"
            aria-label="0"
            onPress={() => onInsert("0")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            0
          </Button>
          <Button
            color="input-like"
            aria-label={t`Decimal point`}
            onPress={() => onInsert(".")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            .
          </Button>
          <Button
            color="input-like"
            aria-label={t`Add`}
            onPress={() => onInsert("+")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            +
          </Button>
          <Button
            color="accent"
            aria-label={t`Calculate result`}
            onPress={onCommit}
            className="col-span-2 h-11 rounded-lg text-lg font-medium"
          >
            =
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
