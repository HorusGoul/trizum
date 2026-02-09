import { useState } from "react";
import { evaluateExpression } from "#src/lib/evaluateExpression.ts";

interface UseCalculatorModeOptions {
  value: number;
  onChange: (value: number) => void;
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
  currency?: string;
}

function getCurrencyDecimals(currency: string | undefined): number | null {
  if (!currency) return null;

  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "code",
    });
    const parts = formatter.formatToParts(1.23456789);
    const fractionPart = parts.find((part) => part.type === "fraction");
    return fractionPart?.value.length ?? 2;
  } catch {
    return null;
  }
}

function roundToDecimals(value: number, decimals: number | null): number {
  if (decimals === null) return value;
  // Financial rounding: round half away from zero
  // This ensures 0.005 -> 0.01 and -0.005 -> -0.01
  const factor = Math.pow(10, decimals);
  const sign = value < 0 ? -1 : 1;
  // Add a small epsilon to handle floating point precision issues
  return (sign * Math.round(Math.abs(value) * factor + 1e-10)) / factor;
}

export interface CalculatorState {
  isActive: boolean;
  expression: string;
  cursorPosition: number;
  previewValue: number | null;
}

export interface CalculatorActions {
  activate: () => void;
  deactivate: () => void;
  insertAtCursor: (text: string) => void;
  backspace: () => void;
  moveCursor: (direction: "left" | "right") => void;
  setCursorPosition: (position: number) => void;
  commit: () => void;
  clear: () => void;
}

export function useCalculatorMode({
  value,
  onChange,
  fieldContainerRef,
  currency,
}: UseCalculatorModeOptions): [CalculatorState, CalculatorActions] {
  const [isActive, setIsActive] = useState(false);
  const [expression, setExpressionRaw] = useState("");
  const [cursorPosition, setCursorPositionRaw] = useState(0);

  const decimals = getCurrencyDecimals(currency);
  const rawPreviewValue = evaluateExpression(expression);
  const previewValue =
    rawPreviewValue !== null
      ? roundToDecimals(rawPreviewValue, decimals)
      : null;

  function applyValue(val: number) {
    onChange(roundToDecimals(val, decimals));
  }

  function focusField() {
    requestAnimationFrame(() => {
      const input = fieldContainerRef.current?.querySelector("input");
      input?.focus();
    });
  }

  function activate() {
    const initialExpr = value === 0 ? "" : String(value);
    setExpressionRaw(initialExpr);
    setCursorPositionRaw(initialExpr.length);
    setIsActive(true);
  }

  function deactivate() {
    const result = evaluateExpression(expression);
    if (result !== null) {
      applyValue(result);
    }
    setIsActive(false);
    setExpressionRaw("");
    setCursorPositionRaw(0);
    focusField();
  }

  function insertAtCursor(text: string) {
    const before = expression.slice(0, cursorPosition);
    const after = expression.slice(cursorPosition);
    const newExpr = before + text + after;
    setExpressionRaw(newExpr);
    setCursorPositionRaw(cursorPosition + text.length);

    const result = evaluateExpression(newExpr);
    if (result !== null) {
      applyValue(result);
    }
  }

  function backspace() {
    if (cursorPosition > 0) {
      const before = expression.slice(0, cursorPosition - 1);
      const after = expression.slice(cursorPosition);
      const newExpr = before + after;
      setExpressionRaw(newExpr);
      setCursorPositionRaw(cursorPosition - 1);

      const result = evaluateExpression(newExpr);
      if (result !== null) {
        applyValue(result);
      } else if (newExpr === "") {
        applyValue(0);
      }
    }
  }

  function moveCursor(direction: "left" | "right") {
    if (direction === "left" && cursorPosition > 0) {
      setCursorPositionRaw(cursorPosition - 1);
    } else if (direction === "right" && cursorPosition < expression.length) {
      setCursorPositionRaw(cursorPosition + 1);
    }
  }

  function setCursorPosition(position: number) {
    const clampedPosition = Math.max(0, Math.min(position, expression.length));
    setCursorPositionRaw(clampedPosition);
  }

  function commit() {
    const result = evaluateExpression(expression);
    if (result !== null) {
      applyValue(result);
    }
    setIsActive(false);
    setExpressionRaw("");
    setCursorPositionRaw(0);
  }

  function clear() {
    setExpressionRaw("");
    setCursorPositionRaw(0);
    applyValue(0);
  }

  return [
    { isActive, expression, cursorPosition, previewValue },
    {
      activate,
      deactivate,
      insertAtCursor,
      backspace,
      moveCursor,
      setCursorPosition,
      commit,
      clear,
    },
  ];
}
