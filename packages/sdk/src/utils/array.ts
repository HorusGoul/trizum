/**
 * Array mutation utilities for working with Automerge documents.
 *
 * These functions provide safe array operations that work within
 * Automerge document change callbacks.
 */

import { amInsertAt, amDeleteAt } from "../internal/automerge.js";

/**
 * Insert elements at a specific index in an array.
 *
 * Use this inside a `handle.change()` callback to insert elements
 * into an array property of an Automerge document.
 *
 * @param array - The array to insert into
 * @param index - The index at which to insert
 * @param values - The values to insert
 *
 * @example
 * ```ts
 * handle.change(doc => {
 *   insertAt(doc.items, 0, "first", "second");
 * });
 * ```
 */
export function insertAt<T>(array: T[], index: number, ...values: T[]): void {
  amInsertAt(array, index, ...values);
}

/**
 * Delete elements at a specific index in an array.
 *
 * Use this inside a `handle.change()` callback to delete elements
 * from an array property of an Automerge document.
 *
 * @param array - The array to delete from
 * @param index - The index at which to start deleting
 * @param count - The number of elements to delete (default: 1)
 *
 * @example
 * ```ts
 * handle.change(doc => {
 *   deleteAt(doc.items, 2); // Delete element at index 2
 *   deleteAt(doc.items, 0, 3); // Delete 3 elements starting at index 0
 * });
 * ```
 */
export function deleteAt<T>(array: T[], index: number, count?: number): void {
  amDeleteAt(array, index, count);
}
