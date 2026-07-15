import { describe, expect, test } from "vite-plus/test";
import { clampCurrencyValue } from "./currencyValue.ts";

describe("clampCurrencyValue", () => {
  test("clamps values below the configured minimum", () => {
    expect(clampCurrencyValue(-10, 0)).toBe(0);
    expect(clampCurrencyValue(10, 0)).toBe(10);
  });

  test("preserves negative values when no minimum is configured", () => {
    expect(clampCurrencyValue(-10)).toBe(-10);
  });
});
