/**
 * State Code Normalization Utility
 *
 * CRITICAL: The backend API requires lowercase state codes in URLs.
 * For example: /materials/colorado NOT /materials/Colorado
 *
 * FastAPI routes are case-sensitive, so incorrect casing causes 404 errors.
 *
 * This utility is the SINGLE POINT OF NORMALIZATION for all state codes
 * used in API calls. All API functions that accept a state parameter
 * must use this function to normalize the state code.
 */

/**
 * Normalize a state code for API calls.
 *
 * BEHAVIOR:
 * - Trims leading/trailing whitespace
 * - Converts to lowercase
 * - Throws an error if input is empty, undefined, or null
 *
 * EXAMPLES:
 * - "Colorado" → "colorado"
 * - " Oregon " → "oregon"
 * - "COLORADO" → "colorado"
 * - "" → throws Error
 * - undefined → throws Error
 *
 * @param state - The state code to normalize (e.g., "Colorado", "Oregon")
 * @returns The normalized lowercase state code
 * @throws Error if state is empty, undefined, or null
 */
export function normalizeStateCode(state: string | undefined | null): string {
  // Guard against undefined/null
  if (state === undefined || state === null) {
    throw new Error("State code is required but was undefined or null");
  }

  // Trim whitespace
  const trimmed = state.trim();

  // Guard against empty string
  if (trimmed === "") {
    throw new Error("State code is required but was empty");
  }

  // Convert to lowercase
  return trimmed.toLowerCase();
}

/**
 * Check if a state code is valid (non-empty after normalization).
 * This is a non-throwing version for conditional checks.
 *
 * @param state - The state code to check
 * @returns true if the state code can be normalized, false otherwise
 */
export function isValidStateCode(state: string | undefined | null): boolean {
  try {
    normalizeStateCode(state);
    return true;
  } catch {
    return false;
  }
}
