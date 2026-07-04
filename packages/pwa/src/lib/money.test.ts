import { describe, expect, test } from "vite-plus/test";
import {
  createMoney,
  getDineroCurrency,
  getDisplayDineroCurrency,
  getMoneyAmount,
  isCurrencyCode,
} from "./money.ts";

describe("money", () => {
  test("creates app money values in minor units", () => {
    expect(getMoneyAmount(createMoney(1234))).toBe(1234);
  });

  test("resolves Dinero v2 currencies for persisted app currency codes", () => {
    expect(getDineroCurrency("EUR").code).toBe("EUR");
    expect(getDineroCurrency("HRK")).toStrictEqual({
      code: "HRK",
      base: 10,
      exponent: 2,
    });
  });

  test("validates app currency codes", () => {
    expect(isCurrencyCode("EUR")).toBe(true);
    expect(isCurrencyCode("HRK")).toBe(true);
    expect(isCurrencyCode("missing")).toBe(false);
  });

  test("resolves display currencies as decimal app amounts", () => {
    expect(getDisplayDineroCurrency("MGA")).toStrictEqual({
      code: "MGA",
      base: 10,
      exponent: 2,
    });
  });
});
