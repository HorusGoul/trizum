import { describe, expect, test } from "vite-plus/test";
import type { Expense } from "#src/models/expense.ts";
import { getExpenseEditValues } from "./-expenseEditValues.ts";

const NOW = new Date("2026-07-15T12:00:00.000Z");
const UNSAVED_PHOTO = "unsaved-photo" as Expense["photos"][number];
const SAVED_PHOTO = "saved-photo" as Expense["photos"][number];
const EXPIRED_PHOTO = "expired-photo" as Expense["photos"][number];

describe("getExpenseEditValues", () => {
  test("includes an attachment added to an unsaved edit", () => {
    const expense = createExpense({ photos: [] });
    expense.__editCopy = createExpense({ photos: [UNSAVED_PHOTO] });
    expense.__editCopyLastUpdatedAt = NOW;

    expect(getExpenseEditValues(expense, NOW.getTime()).photos).toEqual([UNSAVED_PHOTO]);
  });

  test("discards an expired edit copy", () => {
    const expense = createExpense({ photos: [SAVED_PHOTO] });
    expense.__editCopy = createExpense({ photos: [EXPIRED_PHOTO] });
    expense.__editCopyLastUpdatedAt = new Date(NOW.getTime() - 5 * 60 * 1000);

    expect(getExpenseEditValues(expense, NOW.getTime()).photos).toEqual([SAVED_PHOTO]);
  });
});

function createExpense({ photos }: { photos: Expense["photos"] }): Expense {
  return {
    id: "expense-id:chunk-id",
    name: "Lunch",
    paidAt: NOW,
    paidBy: { participant: 1200 },
    shares: { participant: { type: "divide", value: 1 } },
    photos,
    __hash: photos.join(","),
  };
}
