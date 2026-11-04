import { z } from "zod";
import { evaluate } from "mathjs";

const expressionResultSchema = z.number();

export function evaluateExpression(expr: string): number | null {
  const trimmed = expr.trim();

  if (trimmed === "") return null;

  // Strip trailing operator so incomplete expressions still resolve
  const cleaned = trimmed.replace(/[+\-*/]\s*$/, "").trim();

  if (cleaned === "") return null;

  try {
    const result: unknown = evaluate(cleaned);

    const parsed = expressionResultSchema.safeParse(result);

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
