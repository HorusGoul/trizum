/**
 * Test utilities for the Trizum SDK.
 *
 * These utilities help generate valid document IDs and other test data
 * for testing purposes.
 *
 * @example
 * ```ts
 * import { generateTestDocumentId } from "@trizum/sdk/testing";
 *
 * test("my test", () => {
 *   const validId = generateTestDocumentId();
 *   // Use validId in your tests...
 * });
 * ```
 */

import { generateDocumentUrl, parseDocumentUrl } from "./internal/crdt.js";
import type { DocumentId } from "./types.js";

/**
 * Generate a valid document ID for testing purposes.
 *
 * This creates a properly formatted document ID that will pass
 * validation checks without needing to create an actual document.
 *
 * @returns A valid DocumentId string
 */
export function generateTestDocumentId(): DocumentId {
  const url = generateDocumentUrl();
  return parseDocumentUrl(url).documentId as unknown as DocumentId;
}

/**
 * Generate multiple valid document IDs for testing.
 *
 * @param count Number of IDs to generate
 * @returns Array of valid DocumentId strings
 */
export function generateTestDocumentIds(count: number): DocumentId[] {
  return Array.from({ length: count }, () => generateTestDocumentId());
}
