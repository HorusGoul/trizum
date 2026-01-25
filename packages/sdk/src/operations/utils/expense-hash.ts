/**
 * Expense hash utilities for conflict detection.
 */

import type { Expense, ExpenseShare } from "../../models/expense.js";
import { clone } from "@opentf/std";

/**
 * Calculate a hash of an expense for conflict detection.
 * Uses a simple string concatenation approach that's fast and deterministic.
 */
export function calculateExpenseHash(expense: Partial<Expense>): string {
  const copy = clone(expense);

  // Exclude transient fields
  delete copy.__hash;
  delete copy.__editCopy;
  delete copy.__editCopyLastUpdatedAt;

  const input = [
    copy.id ?? "",
    copy.name ?? "",
    copy.paidAt?.toISOString() ?? "",
    serializePaidBy(copy.paidBy ?? {}),
    serializeShares(copy.shares ?? {}),
    (copy.photos ?? []).join(","),
  ].join("|");

  // Simple hash function (djb2)
  return djb2Hash(input);
}

function serializePaidBy(paidBy: Record<string, number>): string {
  return Object.entries(paidBy)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(",");
}

function serializeShares(shares: Record<string, ExpenseShare>): string {
  return Object.entries(shares)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, share]) => `${key}:${share.type}:${share.value}`)
    .join(",");
}

/**
 * djb2 hash function - fast and simple string hash.
 * Returns a hex string.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer, then to hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}
