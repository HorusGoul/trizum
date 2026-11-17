import { expect, it } from "vite-plus/test";
import { formatAmount } from "./expenseService";

it.each([
  [0, "0.00"],
  [-333, "-3.33"],
  [Number.MAX_SAFE_INTEGER, "90071992547409.91"],
  [-Number.MAX_SAFE_INTEGER, "-90071992547409.91"],
] as const)("preserves the MCP decimal-string contract for %s minor units", (amount, expected) => {
  expect(formatAmount(amount)).toBe(expected);
});

it.each([NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  "rejects an unsupported balance %s",
  (amount) => {
    expect(() => formatAmount(amount)).toThrow("unsupported amount");
  },
);
