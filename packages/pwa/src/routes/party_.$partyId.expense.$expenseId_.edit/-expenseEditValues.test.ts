import { describe, expect, test } from "vite-plus/test";
import type { Expense } from "#src/models/expense.ts";
import {
  getExpenseEditHash,
  getExpenseEditValues,
  getOrCreateExpenseEditCopy,
} from "./-expenseEditValues.ts";

const NOW = new Date("2026-07-15T12:00:00.000Z");

// SAFETY: These photo IDs are synthetic fixture keys; the hash/value tests do not read media documents.
const UNSAVED_PHOTO = "unsaved-photo" as Expense["photos"][number];

// SAFETY: These photo IDs are synthetic fixture keys; the hash/value tests do not read media documents.
const SAVED_PHOTO = "saved-photo" as Expense["photos"][number];

// SAFETY: These photo IDs are synthetic fixture keys; the hash/value tests do not read media documents.
const EXPIRED_PHOTO = "expired-photo" as Expense["photos"][number];

describe("getExpenseEditHash", () => {
  test("uses the same active edit copy for the initial hash and form values", () => {
    const expense = createExpense({ photos: [SAVED_PHOTO] });
    expense.__editCopy = createExpense({ photos: [UNSAVED_PHOTO] });
    expense.__editCopyLastUpdatedAt = NOW;

    expect(getExpenseEditHash(expense, NOW.getTime())).toBe(expense.__editCopy.__hash);
    expect(getExpenseEditValues(expense, NOW.getTime()).photos).toEqual([UNSAVED_PHOTO]);
  });

  test("uses the saved baseline when the edit copy expires", () => {
    const expense = createExpense({ photos: [SAVED_PHOTO] });
    expense.__editCopy = createExpense({ photos: [EXPIRED_PHOTO] });
    expense.__editCopyLastUpdatedAt = new Date(NOW.getTime() - 5 * 60 * 1000);

    expect(getExpenseEditHash(expense, NOW.getTime())).toBe(expense.__hash);
    expect(getExpenseEditValues(expense, NOW.getTime()).photos).toEqual([SAVED_PHOTO]);
  });
});

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

describe("getOrCreateExpenseEditCopy", () => {
  test("keeps an active edit copy", () => {
    const expense = createExpense({ photos: [SAVED_PHOTO] });
    expense.__editCopy = createExpense({ photos: [UNSAVED_PHOTO] });
    expense.__editCopyLastUpdatedAt = NOW;

    expect(getOrCreateExpenseEditCopy(expense, NOW.getTime()).photos).toEqual([UNSAVED_PHOTO]);
  });

  test("rebuilds an expired edit copy from the saved expense", () => {
    const expense = createExpense({ photos: [SAVED_PHOTO] });
    expense.__editCopy = createExpense({ photos: [EXPIRED_PHOTO] });
    expense.__editCopyLastUpdatedAt = new Date(NOW.getTime() - 5 * 60 * 1000);

    const editCopy = getOrCreateExpenseEditCopy(expense, NOW.getTime());
    editCopy.name = "Updated lunch";

    expect(editCopy.photos).toEqual([SAVED_PHOTO]);
    expect(editCopy).not.toHaveProperty("__editCopy");
    expect(editCopy).not.toHaveProperty("__editCopyLastUpdatedAt");
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
