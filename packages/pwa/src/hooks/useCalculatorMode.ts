import { useState } from "react";
import { evaluateExpression } from "#src/lib/evaluateExpression.ts";

interface UseCalculatorModeOptions {
  value: number;
  onChange: (value: number) => void;
  expressionInputRef: React.RefObject<HTMLInputElement | null>;
  fieldContainerRef: React.RefObject<HTMLDivElement | null>;
}

export interface CalculatorState {
  isActive: boolean;
  expression: string;
  previewValue: number | null;
}

export interface CalculatorActions {
  activate: () => void;
  deactivate: () => void;
  setExpression: (expr: string) => void;
  appendOperator: (op: "+" | "-" | "*" | "/") => void;
  commit: () => void;
  clear: () => void;
}

export function useCalculatorMode({
  value,
  onChange,
  expressionInputRef,
  fieldContainerRef,
}: UseCalculatorModeOptions): [CalculatorState, CalculatorActions] {
  const [isActive, setIsActive] = useState(false);
  const [expression, setExpressionRaw] = useState("");

  const previewValue = evaluateExpression(expression);

  function focusField() {
    requestAnimationFrame(() => {
      const input = fieldContainerRef.current?.querySelector("input");
      input?.focus();
    });
  }

  function activate() {
    const initialExpr = value === 0 ? "" : String(value);
    setExpressionRaw(initialExpr);
    setIsActive(true);
    requestAnimationFrame(() => {
      expressionInputRef.current?.focus();
    });
  }

  function deactivate() {
    const result = evaluateExpression(expression);
    if (result !== null) {
      onChange(result);
    }
    setIsActive(false);
    setExpressionRaw("");
    focusField();
  }

  function setExpression(expr: string) {
    setExpressionRaw(expr);

    const result = evaluateExpression(expr);
    if (result !== null) {
      onChange(result);
    }
  }

  function appendOperator(op: "+" | "-" | "*" | "/") {
    const newExpr = expression + op;
    setExpressionRaw(newExpr);
  }

  function commit() {
    const result = evaluateExpression(expression);
    if (result !== null) {
      onChange(result);
    }
    setIsActive(false);
    setExpressionRaw("");
    focusField();
  }

  function clear() {
    setExpressionRaw("");
    onChange(0);
  }

  return [
    { isActive, expression, previewValue },
    {
      activate,
      deactivate,
      setExpression,
      appendOperator,
      commit,
      clear,
    },
  ];
}
