import type Dinero from "dinero.js";
import { describe, test, expect } from "vitest";
import {
  calculateLogStatsBetweenTwoUsers,
  calculateLogStatsOfUser,
  convertToUnits,
  type ExpenseInput,
} from "./expenses";

describe("convertToUnits", () => {
  test("should convert display amounts to cents correctly", () => {
    expect(convertToUnits(10)).toBe(1000);
    expect(convertToUnits(10.5)).toBe(1050);
    expect(convertToUnits(10.99)).toBe(1099);
    expect(convertToUnits(0.01)).toBe(1);
    expect(convertToUnits(0.99)).toBe(99);
  });

  test("should handle floating-point precision issues", () => {
    // These are common floating-point precision issues
    expect(convertToUnits(0.1 + 0.2)).toBe(30); // 0.1 + 0.2 = 0.30000000000000004
    expect(convertToUnits(0.3)).toBe(30);
  });
});

describe("calculateLogStatsBetweenTwoUsers", () => {
  test("should return diffUnsplitted=0 when users spend the same amount", () => {
    const user = "user1";
    const otherUser = "user2";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 100,
        paidBy: "user1",
        paidFor: { user1: 50, user2: 50 },
      },
      {
        version: 1,
        expense: 200,
        paidBy: "user1",
        paidFor: { user1: 100, user2: 100 },
      },
      {
        version: 1,
        expense: 300,
        paidBy: "user2",
        paidFor: { user1: 150, user2: 150 },
      },
    ];

    const result = calculateLogStatsBetweenTwoUsers(user, otherUser, expenses);

    expectDinero(result.diffUnsplitted).toEqual(0);
  });

  test("should return diffUnsplitted=-100 when expenses splits are 50%, user1 paid 100, and user1 paid 300", () => {
    const user = "user1";
    const otherUser = "user2";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 100,
        paidBy: "user1",
        paidFor: { user1: 50, user2: 50 },
      },
      {
        version: 1,
        expense: 300,
        paidBy: "user2",
        paidFor: { user1: 150, user2: 150 },
      },
    ];

    const result = calculateLogStatsBetweenTwoUsers(user, otherUser, expenses);

    expectDinero(result.diffUnsplitted).toEqual(-100);
  });

  test("should return diffUnsplitted=100 when expenses splits are 50%, user1 paid 300, and user2 paid 100", () => {
    const user = "user1";
    const otherUser = "user2";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 300,
        paidBy: "user1",
        paidFor: { user1: 150, user2: 150 },
      },
      {
        version: 1,
        expense: 100,
        paidBy: "user2",
        paidFor: { user1: 50, user2: 50 },
      },
    ];

    const result = calculateLogStatsBetweenTwoUsers(user, otherUser, expenses);

    expectDinero(result.diffUnsplitted).toEqual(100);
  });

  test("should return diffUnsplitted=0 when expenses are splitted evenly", () => {
    const user = "user1";
    const otherUser = "user2";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 200,
        paidBy: "user1",
        paidFor: { user1: 150, user2: 50 },
      },
      {
        version: 1,
        expense: 100,
        paidBy: "user2",
        paidFor: { user1: 50, user2: 50 },
      },
    ];

    const result = calculateLogStatsBetweenTwoUsers(user, otherUser, expenses);

    expectDinero(result.diffUnsplitted).toEqual(0);
  });

  test("should return diffUnsplitted=-50 when user1 pays something for themselves", () => {
    const user = "user1";
    const otherUser = "user2";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 200,
        paidBy: "user1",
        paidFor: { user1: 200 },
      },
      {
        version: 1,
        expense: 100,
        paidBy: "user2",
        paidFor: { user1: 50, user2: 50 },
      },
    ];

    const result = calculateLogStatsBetweenTwoUsers(user, otherUser, expenses);

    expectDinero(result.diffUnsplitted).toEqual(-50);
  });

  test("should return diffUnsplitted=50 when user1 pays something for themselves", () => {
    const user = "user2";
    const otherUser = "user1";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 200,
        paidBy: "user1",
        paidFor: { user1: 200 },
      },
      {
        version: 1,
        expense: 100,
        paidBy: "user2",
        paidFor: { user1: 50, user2: 50 },
      },
    ];

    const result = calculateLogStatsBetweenTwoUsers(user, otherUser, expenses);

    expectDinero(result.diffUnsplitted).toEqual(50);
  });

  test("should return diffUnsplitted=0 when user2 pays a debt to user1", () => {
    const user = "user1";
    const otherUser = "user2";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 50,
        paidBy: "user2",
        paidFor: { user1: 50, user2: 0 },
      },
      {
        version: 1,
        expense: 100,
        paidBy: "user1",
        paidFor: { user1: 50, user2: 50 },
      },
    ];

    let result = calculateLogStatsBetweenTwoUsers(user, otherUser, expenses);

    expectDinero(result.diffUnsplitted).toEqual(0);

    result = calculateLogStatsBetweenTwoUsers(otherUser, user, expenses);

    expectDinero(result.diffUnsplitted).toEqual(0);
  });

  test("should return diffUnsplitted=-1667 for user2, diffUnsplitted=3333 for user3", () => {
    const user1 = "user1";
    const user2 = "user2";
    const user3 = "user3";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 10000,
        paidBy: user2,
        paidFor: { [user1]: 5000, [user2]: 5000 },
      },
      {
        version: 1,
        expense: 10000,
        paidBy: user1,
        paidFor: {
          [user1]: 3334,
          [user2]: 3333,
          [user3]: 3333,
        },
      },
    ];

    let result = calculateLogStatsBetweenTwoUsers(user1, user2, expenses);

    expectDinero(result.diffUnsplitted).toEqual(-1667);

    result = calculateLogStatsBetweenTwoUsers(user1, user3, expenses);

    expectDinero(result.diffUnsplitted).toEqual(3333);
  });

  test("should return diffUnsplitted=3333 for user2, diffUnsplitted=3333 for user3", () => {
    const user1 = "user1";
    const user2 = "user2";
    const user3 = "user3";
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 10000,
        paidBy: user2,
        paidFor: { [user1]: 5000, [user2]: 5000 },
      },
      {
        version: 1,
        expense: 5000,
        paidBy: user1,
        paidFor: {
          [user1]: 0,
          [user2]: 5000,
        },
      },
      {
        version: 1,
        expense: 10000,
        paidBy: user1,
        paidFor: {
          [user1]: 3334,
          [user2]: 3333,
          [user3]: 3333,
        },
      },
    ];

    let result = calculateLogStatsBetweenTwoUsers(user1, user2, expenses);

    expectDinero(result.diffUnsplitted).toEqual(3333);

    result = calculateLogStatsBetweenTwoUsers(user1, user3, expenses);

    expectDinero(result.diffUnsplitted).toEqual(3333);
  });

  test("should return diffUnsplited=100 for user1, and diffUnsplited=-100 for user2, when user1 pays something for user2", () => {
    const user1 = "user1";
    const user2 = "user2";

    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 100,
        paidBy: user1,
        paidFor: { [user2]: 100 },
      },
    ];

    let result = calculateLogStatsBetweenTwoUsers(user1, user2, expenses);
    expectDinero(result.diffUnsplitted).toEqual(100);

    result = calculateLogStatsBetweenTwoUsers(user2, user1, expenses);
    expectDinero(result.diffUnsplitted).toEqual(-100);
  });
});

describe("calculateLogStatsOfUser", () => {
  test("should owe 0 to user2, and 100 to user3", () => {
    const user = "user1";
    const otherUsers = ["user2", "user3"];
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 100,
        paidBy: "user1",
        paidFor: { user1: 34, user2: 33, user3: 33 },
      },
      {
        version: 1,
        expense: 200,
        paidBy: "user1",
        paidFor: { user1: 66, user2: 67, user3: 67 },
      },
      {
        version: 1,
        expense: 300,
        paidBy: "user2",
        paidFor: { user1: 100, user2: 100, user3: 100 },
      },
      {
        version: 1,
        expense: 600,
        paidBy: "user3",
        paidFor: { user1: 200, user2: 200, user3: 200 },
      },
    ];

    const result = calculateLogStatsOfUser(user, otherUsers, expenses);

    expectDinero(result.userOwes).toEqual(100);
    expectDinero(result.owedToUser).toEqual(0);

    expectDinero(result.diffs.user2.diffUnsplitted).toEqual(0);
    expectDinero(result.diffs.user3.diffUnsplitted).toEqual(-100);
  });

  test("user2 should owe 2 to user1", () => {
    const user = "user1";
    const otherUsers = ["user2"];
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 100,
        paidBy: "user1",
        paidFor: { user1: 50, user2: 50 },
      },
      {
        version: 1,
        expense: 200,
        paidBy: "user1",
        paidFor: { user1: 100, user2: 100 },
      },
      {
        version: 1,
        expense: 100,
        paidBy: "user2",
        paidFor: { user1: 50, user2: 50 },
      },
    ];

    const result = calculateLogStatsOfUser(user, otherUsers, expenses);

    expectDinero(result.userOwes).toEqual(0);
    expectDinero(result.owedToUser).toEqual(100);
    expectDinero(result.diffs.user2.diffUnsplitted).toEqual(100);
  });

  test("user2 should owe 200 to user1, and user3 should owe 150 to user1, but user3 should only owe 50 to user2", () => {
    const expenses: ExpenseInput[] = [
      {
        version: 1,
        expense: 100,
        paidBy: "user1",
        paidFor: { user1: 34, user2: 33, user3: 33 },
      },
      {
        version: 1,
        expense: 200,
        paidBy: "user1",
        paidFor: { user1: 66, user2: 67, user3: 67 },
      },
      {
        version: 1,
        expense: 100,
        paidBy: "user2",
        paidFor: { user1: 34, user2: 33, user3: 33 },
      },
    ];

    let result = calculateLogStatsOfUser("user1", ["user2", "user3"], expenses);

    expectDinero(result.userOwes).toEqual(0);
    expectDinero(result.owedToUser).toEqual(166);
    expectDinero(result.diffs.user2.diffUnsplitted).toEqual(66);

    result = calculateLogStatsOfUser("user3", ["user2", "user1"], expenses);

    expectDinero(result.userOwes).toEqual(133);
    expectDinero(result.owedToUser).toEqual(0);
    expectDinero(result.diffs.user2.diffUnsplitted).toEqual(-33);
  });
});

function expectDinero(dinero: Dinero.Dinero) {
  return expect(dinero.getAmount());
}
