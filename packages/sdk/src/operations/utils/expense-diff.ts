/**
 * Expense diff utilities for applying updates.
 */

import type { Expense } from "../../models/expense.js";
import { diff, type DiffResult } from "@opentf/obj-diff";
import { clone } from "@opentf/std";

/**
 * Calculate the diff between two expense objects.
 */
export function getExpenseDiff(base: Expense, updated: Expense): DiffResult[] {
  return diff(clone(base), clone(updated));
}

/**
 * Apply a diff to mutate the base expense in place.
 * This is designed for use inside a document change callback.
 */
export function applyExpenseDiff(base: Expense, updated: Expense): void {
  const expenseDiff = getExpenseDiff(base, updated);

  if (expenseDiff.length === 0) {
    return;
  }

  patchMutate(base, expenseDiff);
}

/**
 * Apply diff patches to mutate an object in place.
 * Handles add, update, and remove operations.
 * DiffResult.t: 0 = Add, 1 = Update, 2 = Remove
 */
function patchMutate<T extends object>(target: T, patches: DiffResult[]): void {
  for (const patch of patches) {
    const path = patch.p;
    let current: unknown = target;

    // Navigate to parent
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      current = (current as Record<string | number, unknown>)[key];
    }

    const lastKey = path[path.length - 1];
    const parent = current as Record<string | number, unknown>;

    switch (patch.t) {
      case 0: // Add
      case 1: // Update
        parent[lastKey] = patch.v;
        break;
      case 2: // Remove
        if (Array.isArray(parent)) {
          parent.splice(lastKey as number, 1);
        } else {
          delete parent[lastKey];
        }
        break;
    }
  }
}
