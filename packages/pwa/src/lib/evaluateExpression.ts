import { evaluate } from "mathjs";

export function evaluateExpression(expr: string): number | null {
  const trimmed = expr.trim();
  if (trimmed === "") return null;

  // Strip trailing operator so incomplete expressions still resolve
  const cleaned = trimmed.replace(/[+\-*/]\s*$/, "").trim();
  if (cleaned === "") return null;

  try {
    const result: unknown = evaluate(cleaned);
    if (typeof result !== "number" || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}
