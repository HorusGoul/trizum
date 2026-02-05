import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "#src/ui/Button.tsx";

interface CalculatorToolbarProps {
  expression: string;
  onExpressionChange: (expr: string) => void;
  onOperator: (op: "+" | "-" | "*" | "/") => void;
  onCommit: () => void;
  onClear: () => void;
  onDismiss: () => void;
  expressionInputRef: React.RefObject<HTMLInputElement | null>;
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  presenceElementId?: string;
  previewValue: number | null;
}

function useKeyboardBottom() {
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function onResize() {
      const offset = window.innerHeight - (vv!.offsetTop + vv!.height);
      setBottom(Math.max(0, offset));
    }

    onResize();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);

    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  return bottom;
}

const operatorButtons = [
  { op: "+", label: "+", ariaLabel: () => t`Add` },
  { op: "-", label: "−", ariaLabel: () => t`Subtract` },
  { op: "*", label: "×", ariaLabel: () => t`Multiply` },
  { op: "/", label: "÷", ariaLabel: () => t`Divide` },
] as const;

export function CalculatorToolbar({
  expression,
  onExpressionChange,
  onOperator,
  onCommit,
  onClear,
  onDismiss,
  expressionInputRef,
  fieldContainerRef,
  presenceElementId,
  previewValue,
}: CalculatorToolbarProps) {
  const bottom = useKeyboardBottom();
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

    function handlePointerDown(e: PointerEvent) {
      if (isOutside(e.target as Node | null)) {
        onDismiss();
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onDismiss, fieldContainerRef]);

  function handleExpressionInput(e: React.FormEvent<HTMLInputElement>) {
    onExpressionChange(e.currentTarget.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "=") {
      e.preventDefault();
      onCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onDismiss();
    }
  }

  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t`Calculator`}
      data-presence-element-id={presenceElementId}
      className="fixed left-0 right-0 z-50 border-t border-accent-300 bg-white pb-safe dark:border-accent-700 dark:bg-accent-900"
      style={{ bottom: `${bottom}px` }}
    >
      <div className="flex flex-col gap-1.5 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <input
            ref={expressionInputRef}
            type="text"
            inputMode="text"
            value={expression}
            onInput={handleExpressionInput}
            onKeyDown={handleKeyDown}
            aria-label={t`Calculator expression`}
            className="min-w-0 flex-1 rounded-md border border-accent-400 bg-accent-50 px-2 py-1.5 text-sm outline-none dark:border-accent-600 dark:bg-accent-800"
            autoComplete="off"
          />
          {previewValue !== null && (
            <span className="flex-shrink-0 text-sm font-medium text-accent-600 dark:text-accent-400">
              = {previewValue}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {operatorButtons.map(({ op, label, ariaLabel }) => (
            <Button
              key={op}
              color="input-like"
              aria-label={ariaLabel()}
              onPress={() => onOperator(op)}
              className="h-9 w-9 flex-shrink-0 rounded-lg text-base font-medium"
            >
              {label}
            </Button>
          ))}

          <Button
            color="input-like"
            aria-label={t`Clear expression`}
            onPress={onClear}
            className="h-9 w-9 flex-shrink-0 rounded-lg text-sm font-medium"
          >
            C
          </Button>

          <div className="flex-1" />

          <Button
            color="accent"
            aria-label={t`Calculate result`}
            onPress={onCommit}
            className="h-9 w-9 flex-shrink-0 rounded-lg text-base font-medium"
          >
            =
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
