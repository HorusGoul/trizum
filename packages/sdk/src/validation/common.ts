/**
 * Common validation utilities and types.
 */

/**
 * Result of a validation operation.
 * Returns null if valid, or an error key string if invalid.
 */
export type ValidationResult = string | null;

/**
 * A validator function that takes a value and returns a validation result.
 */
export type Validator<T> = (value: T) => ValidationResult;

/**
 * Create a composed validator from multiple validators.
 * Returns the first error encountered, or null if all pass.
 *
 * @param validators - Array of validators to compose
 * @returns A composed validator
 */
export function composeValidators<T>(
  ...validators: Validator<T>[]
): Validator<T> {
  return (value: T): ValidationResult => {
    for (const validator of validators) {
      const result = validator(value);
      if (result !== null) {
        return result;
      }
    }
    return null;
  };
}

/**
 * Create a validator that checks if a value is required (non-empty string).
 *
 * @param errorKey - The error key to return if validation fails
 * @returns A validator function
 */
export function required(errorKey: string): Validator<string> {
  return (value: string): ValidationResult => {
    return value.trim() === "" ? errorKey : null;
  };
}

/**
 * Create a validator that checks maximum length.
 *
 * @param max - Maximum allowed length
 * @param errorKey - The error key to return if validation fails
 * @returns A validator function
 */
export function maxLength(max: number, errorKey: string): Validator<string> {
  return (value: string): ValidationResult => {
    return value.trim().length > max ? errorKey : null;
  };
}

/**
 * Create a validator that checks minimum length.
 *
 * @param min - Minimum required length
 * @param errorKey - The error key to return if validation fails
 * @returns A validator function
 */
export function minLength(min: number, errorKey: string): Validator<string> {
  return (value: string): ValidationResult => {
    return value.trim().length < min ? errorKey : null;
  };
}

/**
 * Create a validator that checks if a number is positive.
 *
 * @param errorKey - The error key to return if validation fails
 * @returns A validator function
 */
export function positive(errorKey: string): Validator<number> {
  return (value: number): ValidationResult => {
    return value <= 0 ? errorKey : null;
  };
}

/**
 * Create a validator that checks if a number is non-negative.
 *
 * @param errorKey - The error key to return if validation fails
 * @returns A validator function
 */
export function nonNegative(errorKey: string): Validator<number> {
  return (value: number): ValidationResult => {
    return value < 0 ? errorKey : null;
  };
}

/**
 * Create a validator using a custom predicate function.
 *
 * @param predicate - Function that returns true if value is valid
 * @param errorKey - The error key to return if validation fails
 * @returns A validator function
 */
export function createValidator<T>(
  predicate: (value: T) => boolean,
  errorKey: string,
): Validator<T> {
  return (value: T): ValidationResult => {
    return predicate(value) ? null : errorKey;
  };
}
