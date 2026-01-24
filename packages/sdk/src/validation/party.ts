/**
 * Party and participant validators.
 */

import type { ValidationResult } from "./common.js";
import {
  PARTY_TITLE_REQUIRED,
  PARTY_TITLE_TOO_LONG,
  PARTY_DESCRIPTION_TOO_LONG,
  PARTICIPANT_NAME_REQUIRED,
  PARTICIPANT_NAME_TOO_LONG,
  PHONE_NUMBER_TOO_LONG,
} from "./error-keys.js";

/**
 * Maximum length for party title.
 */
export const MAX_PARTY_TITLE_LENGTH = 50;

/**
 * Maximum length for party description.
 */
export const MAX_PARTY_DESCRIPTION_LENGTH = 500;

/**
 * Maximum length for participant name.
 */
export const MAX_PARTICIPANT_NAME_LENGTH = 50;

/**
 * Maximum length for phone number.
 */
export const MAX_PHONE_NUMBER_LENGTH = 20;

/**
 * Validate a party title.
 *
 * @param title - The title to validate
 * @returns Error key if invalid, null if valid
 */
export function validatePartyTitle(title: string): ValidationResult {
  const trimmed = title.trim();

  if (!trimmed) {
    return PARTY_TITLE_REQUIRED;
  }

  if (trimmed.length > MAX_PARTY_TITLE_LENGTH) {
    return PARTY_TITLE_TOO_LONG;
  }

  return null;
}

/**
 * Validate a party description.
 *
 * @param description - The description to validate
 * @returns Error key if invalid, null if valid
 */
export function validatePartyDescription(
  description: string,
): ValidationResult {
  const trimmed = description.trim();

  if (trimmed.length > MAX_PARTY_DESCRIPTION_LENGTH) {
    return PARTY_DESCRIPTION_TOO_LONG;
  }

  return null;
}

/**
 * Validate a participant name.
 *
 * @param name - The name to validate
 * @returns Error key if invalid, null if valid
 */
export function validateParticipantName(name: string): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return PARTICIPANT_NAME_REQUIRED;
  }

  if (trimmed.length > MAX_PARTICIPANT_NAME_LENGTH) {
    return PARTICIPANT_NAME_TOO_LONG;
  }

  return null;
}

/**
 * Validate a phone number.
 *
 * @param phone - The phone number to validate
 * @returns Error key if invalid, null if valid
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  const trimmed = phone.trim();

  if (trimmed.length > MAX_PHONE_NUMBER_LENGTH) {
    return PHONE_NUMBER_TOO_LONG;
  }

  return null;
}
