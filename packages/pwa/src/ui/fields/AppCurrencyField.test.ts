import { describe, expect, test } from "vite-plus/test";
import { clampCurrencyFieldValue, sanitizeCurrencyFieldInput } from "./currencyFieldValues";

describe("sanitizeCurrencyFieldInput", () => {
  test("strips minus signs from typed currency values", () => {
    expect(sanitizeCurrencyFieldInput("-12.34", 2)).toBe("12.34");
  });

  test("normalizes comma decimals and limits precision", () => {
    expect(sanitizeCurrencyFieldInput("12,345", 2)).toBe("12.34");
  });

  test("removes non-numeric characters", () => {
    expect(sanitizeCurrencyFieldInput("$1a2b.30", 2)).toBe("12.30");
  });
});

describe("clampCurrencyFieldValue", () => {
  test("keeps values above the minimum", () => {
    expect(clampCurrencyFieldValue(12.34, 0)).toBe(12.34);
  });

  test("clamps values below the minimum", () => {
    expect(clampCurrencyFieldValue(-12.34, 0)).toBe(0);
  });

  test("keeps negative values when no minimum is provided", () => {
    expect(clampCurrencyFieldValue(-12.34, undefined)).toBe(-12.34);
  });
});
