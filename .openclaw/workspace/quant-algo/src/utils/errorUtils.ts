/**
 * Safe error-coercion utilities.
 *
 * In catch blocks the caught value is `unknown`.  These helpers convert it
 * to a concrete `Error` (or extract the message) without type assertions.
 */

/**
 * Coerce an `unknown` caught value into an `Error` instance.
 *
 * - If the value is already an `Error`, return it as-is.
 * - Otherwise wrap `String(value)` in a new `Error`.
 */
export function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Extract a human-readable message from an `unknown` caught value.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
