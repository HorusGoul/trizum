/**
 * Document ID validators.
 */

import type { ValidationResult } from "./common.js";
import { isValidDocumentId } from "../types.js";
import { DOCUMENT_ID_REQUIRED, DOCUMENT_ID_INVALID } from "./error-keys.js";

/**
 * Validate a document ID.
 *
 * @param id - The document ID to validate
 * @returns Error key if invalid, null if valid
 */
export function validateDocumentId(id: string): ValidationResult {
  const trimmed = id.trim();

  if (!trimmed) {
    return DOCUMENT_ID_REQUIRED;
  }

  if (!isValidDocumentId(trimmed)) {
    return DOCUMENT_ID_INVALID;
  }

  return null;
}
