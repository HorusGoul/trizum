import { t } from "@lingui/core/macro";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "#src/ui/Button.tsx";
import { IconWithFallback } from "#src/ui/Icon.tsx";

interface CalculatorToolbarProps {
  expression: string;
  onExpressionChange: (expr: string) => void;
  onOperator: (op: "+" | "-" | "*" | "/") => void;
  onCommit: () => void;
  onClear: () => void;
  onDismiss: () => void;
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  presenceElementId?: string;
  previewValue: number | null;
}

export function CalculatorToolbar({
  expression,
  onExpressionChange,
  onOperator,
  onCommit,
  onClear,
  onDismiss,
  fieldContainerRef,
  presenceElementId,
  previewValue,
}: CalculatorToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  function appendDigit(digit: string) {
    onExpressionChange(expression + digit);
  }

  function appendDecimal() {
    // Find the last number in the expression to check if it already has a decimal
    const parts = expression.split(/[+\-*/]/);
    const lastPart = parts[parts.length - 1];
    if (!lastPart.includes(".")) {
      onExpressionChange(expression + ".");
    }
  }

  function backspace() {
    if (expression.length > 0) {
      onExpressionChange(expression.slice(0, -1));
    }
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
        {/* Expression display */}
        <div className="flex items-center gap-2 rounded-md border border-accent-400 bg-accent-50 px-3 py-2 dark:border-accent-600 dark:bg-accent-800">
          <span
            className="min-w-0 flex-1 truncate text-right text-lg font-medium"
            aria-live="polite"
            aria-label={t`Calculator expression`}
          >
            {expression || "0"}
          </span>
          {previewValue !== null && expression && (
            <span className="flex-shrink-0 text-sm font-medium text-accent-600 dark:text-accent-400">
              = {previewValue}
            </span>
          )}
        </div>

        {/* Calculator buttons grid */}
        <div className="grid grid-cols-5 gap-1.5">
          {/* Row 1: 7 8 9 ÷ ⌫ */}
          {["7", "8", "9"].map((digit) => (
            <Button
              key={digit}
              color="input-like"
              aria-label={digit}
              onPress={() => appendDigit(digit)}
              className="h-11 rounded-lg text-lg font-medium"
            >
              {digit}
            </Button>
          ))}
          <Button
            color="input-like"
            aria-label={t`Divide`}
            onPress={() => onOperator("/")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            ÷
          </Button>
          <Button
            color="input-like"
            aria-label={t`Backspace`}
            onPress={backspace}
            className="h-11 rounded-lg text-lg font-medium"
          >
            <IconWithFallback name="#lucide/delete" className="size-5" />
          </Button>

          {/* Row 2: 4 5 6 × C */}
          {["4", "5", "6"].map((digit) => (
            <Button
              key={digit}
              color="input-like"
              aria-label={digit}
              onPress={() => appendDigit(digit)}
              className="h-11 rounded-lg text-lg font-medium"
            >
              {digit}
            </Button>
          ))}
          <Button
            color="input-like"
            aria-label={t`Multiply`}
            onPress={() => onOperator("*")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            ×
          </Button>
          <Button
            color="input-like"
            aria-label={t`Clear expression`}
            onPress={onClear}
            className="h-11 rounded-lg text-lg font-medium"
          >
            C
          </Button>

          {/* Row 3: 1 2 3 − (empty or close) */}
          {["1", "2", "3"].map((digit) => (
            <Button
              key={digit}
              color="input-like"
              aria-label={digit}
              onPress={() => appendDigit(digit)}
              className="h-11 rounded-lg text-lg font-medium"
            >
              {digit}
            </Button>
          ))}
          <Button
            color="input-like"
            aria-label={t`Subtract`}
            onPress={() => onOperator("-")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            −
          </Button>
          <Button
            color="input-like"
            aria-label={t`Close calculator`}
            onPress={onDismiss}
            className="h-11 rounded-lg text-lg font-medium"
          >
            <IconWithFallback name="#lucide/x" className="size-5" />
          </Button>

          {/* Row 4: 0 . + = */}
          <Button
            color="input-like"
            aria-label="0"
            onPress={() => appendDigit("0")}
            className="h-11 rounded-lg text-lg font-medium"
          >
            0
          </Button>
          <Button
            color="input-like"
            aria-label={t`Decimal point`}
            onPress={appendDecimal}
            className="h-11 rounded-lg text-lg font-medium"
          >
            .
          </Button>
          <Button
            color="input-like"
            aria-label={t`Add`}
            onPress={() => onOperator("+")}
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
