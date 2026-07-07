import { useState } from "react";
import { evaluateExpression } from "#src/lib/evaluateExpression.ts";

const currencyDecimalsCache = new Map<string, number | null>();

interface UseCalculatorModeOptions {
  value: number;
  onChange: (value: number) => void;
  currency?: string;
}

function getCurrencyDecimals(currency: string | undefined): number | null {
  if (!currency) return null;

  if (currencyDecimalsCache.has(currency)) {
    return currencyDecimalsCache.get(currency) ?? null;
  }

  try {
    const formatter = Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "code",
    });
    const parts = formatter.formatToParts(1.23456789);
    const fractionPart = parts.find((part) => part.type === "fraction");
    const decimals = fractionPart?.value.length ?? 2;
    currencyDecimalsCache.set(currency, decimals);
    return decimals;
  } catch {
    currencyDecimalsCache.set(currency, null);
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
  selectionRange: CalculatorSelectionRange | null;
  previewValue: number | null;
}

export interface CalculatorSelectionRange {
  start: number;
  end: number;
}

export interface CalculatorActions {
  activate: (options?: { selectAll?: boolean }) => void;
  deactivate: () => void;
  insertAtCursor: (text: string) => void;
  backspace: () => void;
  moveCursor: (direction: "left" | "right") => void;
  setCursorPosition: (position: number) => void;
  commit: () => void;
  clear: () => void;
}

interface CalculatorTextEditOptions {
  expression: string;
  cursorPosition: number;
  selectionRange: CalculatorSelectionRange | null;
}

interface CalculatorTextEditResult {
  expression: string;
  cursorPosition: number;
}

function getActiveSelectionRange({
  expression,
  selectionRange,
}: Pick<CalculatorTextEditOptions, "expression" | "selectionRange">) {
  if (!selectionRange || selectionRange.start === selectionRange.end) {
    return null;
  }

  const start = Math.max(0, Math.min(selectionRange.start, selectionRange.end, expression.length));
  const end = Math.max(
    0,
    Math.min(Math.max(selectionRange.start, selectionRange.end), expression.length),
  );

  if (start === end) {
    return null;
  }

  return { start, end };
}

export function insertCalculatorText({
  expression,
  cursorPosition,
  selectionRange,
  text,
}: CalculatorTextEditOptions & { text: string }): CalculatorTextEditResult {
  const activeSelectionRange = getActiveSelectionRange({ expression, selectionRange });
  const start = activeSelectionRange?.start ?? cursorPosition;
  const end = activeSelectionRange?.end ?? cursorPosition;
  const nextExpression = expression.slice(0, start) + text + expression.slice(end);

  return {
    expression: nextExpression,
    cursorPosition: start + text.length,
  };
}

export function deleteCalculatorText({
  expression,
  cursorPosition,
  selectionRange,
}: CalculatorTextEditOptions): CalculatorTextEditResult | null {
  const activeSelectionRange = getActiveSelectionRange({ expression, selectionRange });

  if (activeSelectionRange) {
    return {
      expression:
        expression.slice(0, activeSelectionRange.start) +
        expression.slice(activeSelectionRange.end),
      cursorPosition: activeSelectionRange.start,
    };
  }

  if (cursorPosition <= 0) {
    return null;
  }

  return {
    expression: expression.slice(0, cursorPosition - 1) + expression.slice(cursorPosition),
    cursorPosition: cursorPosition - 1,
  };
}

export function useCalculatorMode({
  value,
  onChange,
  currency,
}: UseCalculatorModeOptions): [CalculatorState, CalculatorActions] {
  const [isActive, setIsActive] = useState(false);
  const [expression, setExpressionRaw] = useState("");
  const [cursorPosition, setCursorPositionRaw] = useState(0);
  const [selectionRange, setSelectionRangeRaw] = useState<CalculatorSelectionRange | null>(null);

  const decimals = getCurrencyDecimals(currency);
  const rawPreviewValue = evaluateExpression(expression);
  const previewValue = rawPreviewValue !== null ? roundToDecimals(rawPreviewValue, decimals) : null;

  function applyValue(val: number) {
    onChange(roundToDecimals(val, decimals));
  }

  function activate({ selectAll = true }: { selectAll?: boolean } = {}) {
    const initialExpr = value === 0 ? "" : String(value);
    setExpressionRaw(initialExpr);
    setCursorPositionRaw(initialExpr.length);
    setSelectionRangeRaw(
      selectAll && initialExpr.length > 0 ? { start: 0, end: initialExpr.length } : null,
    );
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
    setSelectionRangeRaw(null);
  }

  function insertAtCursor(text: string) {
    const edit = insertCalculatorText({
      expression,
      cursorPosition,
      selectionRange,
      text,
    });
    setExpressionRaw(edit.expression);
    setCursorPositionRaw(edit.cursorPosition);
    setSelectionRangeRaw(null);

    const result = evaluateExpression(edit.expression);
    if (result !== null) {
      applyValue(result);
    }
  }

  function backspace() {
    const edit = deleteCalculatorText({
      expression,
      cursorPosition,
      selectionRange,
    });

    if (!edit) {
      return;
    }

    setExpressionRaw(edit.expression);
    setCursorPositionRaw(edit.cursorPosition);
    setSelectionRangeRaw(null);

    const result = evaluateExpression(edit.expression);
    if (result !== null) {
      applyValue(result);
    } else if (edit.expression === "") {
      applyValue(0);
    }
  }

  function moveCursor(direction: "left" | "right") {
    if (direction === "left" && cursorPosition > 0) {
      setCursorPositionRaw(cursorPosition - 1);
      setSelectionRangeRaw(null);
    } else if (direction === "right" && cursorPosition < expression.length) {
      setCursorPositionRaw(cursorPosition + 1);
      setSelectionRangeRaw(null);
    }
  }

  function setCursorPosition(position: number) {
    const clampedPosition = Math.max(0, Math.min(position, expression.length));
    setCursorPositionRaw(clampedPosition);
    setSelectionRangeRaw(null);
  }

  function commit() {
    const result = evaluateExpression(expression);
    if (result !== null) {
      applyValue(result);
    }
    setIsActive(false);
    setExpressionRaw("");
    setCursorPositionRaw(0);
    setSelectionRangeRaw(null);
  }

  function clear() {
    setExpressionRaw("");
    setCursorPositionRaw(0);
    setSelectionRangeRaw(null);
    applyValue(0);
  }

  return [
    { isActive, expression, cursorPosition, selectionRange, previewValue },
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
