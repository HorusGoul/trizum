import { describe, expect, test } from "vite-plus/test";
import {
  deleteCalculatorText,
  getChangedCalculatorValue,
  insertCalculatorText,
} from "./useCalculatorMode.ts";

describe("calculator text editing", () => {
  test("replaces selected expression text on insert", () => {
    expect(
      insertCalculatorText({
        expression: "12.5",
        cursorPosition: 4,
        selectionRange: { start: 0, end: 4 },
        text: "7",
      }),
    ).toEqual({
      expression: "7",
      cursorPosition: 1,
    });
  });

  test("inserts at the cursor when there is no active selection", () => {
    expect(
      insertCalculatorText({
        expression: "12",
        cursorPosition: 2,
        selectionRange: null,
        text: "3",
      }),
    ).toEqual({
      expression: "123",
      cursorPosition: 3,
    });
  });

  test("backspace removes selected expression text before deleting individual characters", () => {
    expect(
      deleteCalculatorText({
        expression: "1234",
        cursorPosition: 4,
        selectionRange: { start: 1, end: 3 },
      }),
    ).toEqual({
      expression: "14",
      cursorPosition: 1,
    });

    expect(
      deleteCalculatorText({
        expression: "14",
        cursorPosition: 1,
        selectionRange: null,
      }),
    ).toEqual({
      expression: "4",
      cursorPosition: 0,
    });
  });
});

describe("calculator value changes", () => {
  test("ignores values that do not change after rounding", () => {
    expect(
      getChangedCalculatorValue({
        currentValue: 50,
        decimals: 2,
        nextValue: 50,
      }),
    ).toBeNull();

    expect(
      getChangedCalculatorValue({
        currentValue: 50,
        decimals: 2,
        nextValue: 50.004,
      }),
    ).toBeNull();
  });

  test("returns the rounded value when it changes", () => {
    expect(
      getChangedCalculatorValue({
        currentValue: 50,
        decimals: 2,
        nextValue: 50.005,
      }),
    ).toBe(50.01);
  });
});
