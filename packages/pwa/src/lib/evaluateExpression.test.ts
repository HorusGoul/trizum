import { describe, test, expect } from "vitest";
import { evaluateExpression } from "./evaluateExpression";

describe("evaluateExpression", () => {
  test("should return null for empty string", () => {
    expect(evaluateExpression("")).toBeNull();
  });

  test("should return null for whitespace", () => {
    expect(evaluateExpression("   ")).toBeNull();
  });

  test("should evaluate a single number", () => {
    expect(evaluateExpression("42")).toBe(42);
  });

  test("should evaluate a decimal number", () => {
    expect(evaluateExpression("12.50")).toBe(12.5);
  });

  test("should evaluate addition", () => {
    expect(evaluateExpression("3+4")).toBe(7);
  });

  test("should evaluate subtraction", () => {
    expect(evaluateExpression("10-3")).toBe(7);
  });

  test("should evaluate multiplication", () => {
    expect(evaluateExpression("6*7")).toBe(42);
  });

  test("should evaluate division", () => {
    expect(evaluateExpression("20/4")).toBe(5);
  });

  test("should respect operator precedence (mul before add)", () => {
    expect(evaluateExpression("2+3*4")).toBe(14);
  });

  test("should respect operator precedence (div before sub)", () => {
    expect(evaluateExpression("10-6/2")).toBe(7);
  });

  test("should handle chained additions", () => {
    expect(evaluateExpression("1+2+3+4")).toBe(10);
  });

  test("should handle chained multiplications", () => {
    expect(evaluateExpression("2*3*4")).toBe(24);
  });

  test("should handle mixed operations", () => {
    expect(evaluateExpression("2+3*4-1")).toBe(13);
  });

  test("should handle decimal arithmetic", () => {
    expect(evaluateExpression("12.50+3.25")).toBeCloseTo(15.75);
  });

  test("should handle trailing operator", () => {
    expect(evaluateExpression("12.50+")).toBe(12.5);
  });

  test("should handle trailing multiplication operator", () => {
    expect(evaluateExpression("5*")).toBe(5);
  });

  test("should return null for division by zero", () => {
    expect(evaluateExpression("10/0")).toBeNull();
  });

  test("should handle negative leading number", () => {
    expect(evaluateExpression("-5+10")).toBe(5);
  });

  test("should handle negative number after operator", () => {
    expect(evaluateExpression("10*-2")).toBe(-20);
  });

  test("should handle spaces between tokens", () => {
    expect(evaluateExpression("12 + 3 * 4")).toBe(24);
  });

  test("should return null for invalid input", () => {
    expect(evaluateExpression("abc")).toBeNull();
  });

  test("should handle just a negative number", () => {
    expect(evaluateExpression("-42")).toBe(-42);
  });

  test("should handle complex expression", () => {
    // 100 / 4 + 10 * 2 - 5 = 25 + 20 - 5 = 40
    expect(evaluateExpression("100/4+10*2-5")).toBe(40);
  });

  test("should handle parentheses", () => {
    expect(evaluateExpression("(2+3)*4")).toBe(20);
  });
});
