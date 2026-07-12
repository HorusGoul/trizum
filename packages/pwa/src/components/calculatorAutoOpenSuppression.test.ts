import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  allowCalculatorAutoOpenForUserInteraction,
  isCalculatorAutoOpenSuppressed,
  suppressCalculatorAutoOpen,
} from "./calculatorAutoOpenSuppression.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("calculator auto-open suppression", () => {
  test("expires without requiring another pointer interaction", () => {
    let now = 100;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    suppressCalculatorAutoOpen();
    expect(isCalculatorAutoOpenSuppressed()).toBe(true);

    now = 1_599;
    expect(isCalculatorAutoOpenSuppressed()).toBe(true);

    now = 1_600;
    expect(isCalculatorAutoOpenSuppressed()).toBe(false);
  });

  test("resumes suppression after the pointer allowance until the suppression expires", () => {
    let now = 100;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    suppressCalculatorAutoOpen();
    now = 200;
    allowCalculatorAutoOpenForUserInteraction();
    expect(isCalculatorAutoOpenSuppressed()).toBe(false);

    now = 699;
    expect(isCalculatorAutoOpenSuppressed()).toBe(false);

    now = 700;
    expect(isCalculatorAutoOpenSuppressed()).toBe(true);

    now = 1_600;
    expect(isCalculatorAutoOpenSuppressed()).toBe(false);
  });
});
